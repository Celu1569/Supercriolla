import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import https from "https";
import process from "process";

// Globally ignore TLS unauthorized errors for 3P radio streams that often have bad certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Agent to allow self-signed or incomplete certificates for the radio stream metadata
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = 3000;

  // In-memory message fallback, but now we'll sync with Firestore using the client SDK
  let messages: any[] = [];
  
  // Attempt to use Firebase from server.ts to sync messages
  try {
    const { collection, onSnapshot, addDoc, query, orderBy, limit, serverTimestamp } = await import('firebase/firestore');
    const { db } = await import('./firebase.js');
    
    if (!db) {
        throw new Error("Firebase database not initialized. Check your configuration.");
    }

    const messagesRef = collection(db, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(100));

    onSnapshot(q, (snapshot) => {
        const fbMessages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        messages = fbMessages;
        io.emit("init-messages", messages);
    }, (error) => {
      console.error('Firestore Error syncing messages on server:', error);
    });

    io.on("connection", (socket) => {
      console.log("User connected:", socket.id);
  
      // Send existing messages to the new user
      socket.emit("init-messages", messages);
  
      socket.on("send-message", async (message) => {
        const newMessage = {
          ...message,
          timestamp: new Date().toISOString(), // Keep ISO string for compatibility
        };
        
        try {
          // Add to Firestore (will trigger onSnapshot and broadcast to all)
           await addDoc(messagesRef, newMessage);
        } catch (error) {
          console.error("Failed to add message to Firestore:", error);
          // Fallback
          const fbFallbackMsg = { ...newMessage, id: `msg-${Date.now()}` };
          messages.push(fbFallbackMsg);
          if (messages.length > 50) messages.shift();
          io.emit("new-message", fbFallbackMsg);
        }
      });
  
      socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
      });
    });

  } catch (err) {
      console.error("Error setting up Firebase in server.ts", err);
      // Fallback behavior
      io.on("connection", (socket) => {
        socket.emit("init-messages", messages);
        socket.on("send-message", (message) => {
          const newMessage = {
            ...message,
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
          };
          messages.push(newMessage);
          if (messages.length > 100) messages.shift();
          io.emit("new-message", newMessage);
        });
      });
  }

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Robust metadata API with Icecast JSON, ICY stream title & iTunes Cover Art lookup
  const DEFAULT_COVER = "https://i.ibb.co/kVQLN1F1/Logo-Buenisima-esfera-512x256.png";
  let cachedMetadata = { 
    title: "Sintonizando...", 
    artist: "BUENÍSIMA 87.7 FM", 
    cover: DEFAULT_COVER,
    updatedAt: Date.now()
  };
  let lastMetadataFetch = 0;
  let activeStreamUrl = "https://redradioypc.com:8010/live";

  // Realtime SSE connected clients
  const sseClients = new Set<express.Response>();

  const broadcastRadioMetadata = (data: typeof cachedMetadata) => {
    // Only broadcast if there's a real change to avoid chatter
    if (data.title === cachedMetadata.title && data.artist === cachedMetadata.artist && data.cover === cachedMetadata.cover) {
        return;
    }
    
    console.log(`[Metadata] New Song: ${data.artist} - ${data.title}`);
    cachedMetadata = { ...data, updatedAt: Date.now() };
    lastMetadataFetch = Date.now();
    
    // Emit via Socket.IO
    try {
      io.emit("radio-metadata", cachedMetadata);
    } catch (_) {}
    
    // Emit via Server-Sent Events
    for (const client of sseClients) {
      try {
        client.write(`data: ${JSON.stringify(cachedMetadata)}\n\n`);
      } catch (_) {
        sseClients.delete(client);
      }
    }
  };

  // Register Radio Metadata Socket events
  io.on("connection", (socket) => {
    socket.emit("radio-metadata", cachedMetadata);
    socket.on("get-radio-metadata", () => {
      socket.emit("radio-metadata", cachedMetadata);
    });
  });

  // Capitalize words nicely if stream sends ALL-CAPS
  const formatTitleCase = (str: string) => {
    if (!str) return '';
    // Handle ALL CAPS strings
    if (str === str.toUpperCase() && str.length > 3) {
      return str.toLowerCase().replace(/(?:^|\s|\/|-)\S/g, (char) => char.toUpperCase());
    }
    return str;
  };

  // Helper to search iTunes with multiple fallbacks and match validation
  const searchItunesCover = async (artist: string, title: string) => {
    // 1. Clean strings from common radio tags and symbols
    const cleanStr = (s: string) => s
        .replace(/\s*\(.*?\)/g, '') // Remove (brackets)
        .replace(/\s*\[.*?\]/g, '') // Remove [brackets]
        .replace(/feat\..*$/i, '')   // Remove feat...
        .replace(/ft\..*$/i, '')     // Remove ft...
        .replace(/&.*$/i, '')        // Remove &...
        .replace(/[^\w\sáéíóúñÁÉÍÓÚÑ]/g, ' ') // Keep alphanumeric and spaces
        .replace(/\s+/g, ' ')
        .trim();

    const cArtist = cleanStr(artist);
    const cTitle = cleanStr(title);
        
    // 2. Generate search queries from most specific to least
    const queries = [
      `${cArtist} ${cTitle}`,
      `${cTitle} ${cArtist}`,
      cTitle.length > 3 ? cTitle : null,
      cArtist.length > 3 ? cArtist : null,
    ].filter(Boolean) as string[];

    for (const q of queries) {
      if (q.length < 3) continue;
      try {
        console.log(`[Metadata] Searching iTunes for: ${q}`);
        const itunesRes = await axios.get(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&limit=10&entity=song`, {
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' 
          },
          timeout: 4000
        });

        if (itunesRes.data.results && itunesRes.data.results.length > 0) {
          // Find the best match - be strict to avoid fuzzy "Kenny Garcia" matches for other Garcias
          const bestMatch = itunesRes.data.results.find((item: any) => {
             const trackLower = (item.trackName || '').toLowerCase();
             const artistLower = (item.artistName || '').toLowerCase();
             const tL = cTitle.toLowerCase();
             const aL = cArtist.toLowerCase();
             
             // Strict check: artist or title must be very similar
             const artistMatch = artistLower.includes(aL) || aL.includes(artistLower) || 
                                (aL.length > 5 && artistLower.includes(aL.substring(0, 5)));
             const trackMatch = trackLower.includes(tL) || tL.includes(trackLower);
             
             return artistMatch && trackMatch;
          });

          if (bestMatch && bestMatch.artworkUrl100) {
            const highResCover = bestMatch.artworkUrl100.replace('100x100', '1000x1000');
            return {
              cover: highResCover,
              title: bestMatch.trackName || formatTitleCase(title),
              artist: bestMatch.artistName || formatTitleCase(artist)
            };
          }
        }
      } catch (err) {
        // Silent fail for next query variation
      }
    }
    
    // Fallback: If no cover found, at least return formatted names
    return { cover: DEFAULT_COVER, title: formatTitleCase(title), artist: formatTitleCase(artist) };
  };

  const fetchLiveMetadata = async (streamUrl: string) => {
    if (!streamUrl) return cachedMetadata;

    let rawTitle = "";
    try {
      const parsedUrl = new URL(streamUrl);
      const host = parsedUrl.host;
      // Use http for metadata check to avoid common SSL cert issues on radio ports
      const httpStatusUrl = `http://${host}/status-json.xsl`;
      const httpsStatusUrl = `https://${host}/status-json.xsl`;

      // Method 1: Improved Icecast status-json.xsl check
      const tryJson = async (url: string) => {
        try {
          console.log(`[Metadata] Fetching from JSON: ${url}`);
          const statusRes = await axios.get(url, {
            httpsAgent: httpsAgent,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              'Accept': 'application/json, text/plain, */*'
            },
            responseType: 'text',
            timeout: 5000
          });

          let textData = statusRes.data;
          if (typeof textData !== 'string') textData = JSON.stringify(textData);

          if (textData) {
            // 1. Direct Regex Extraction (Safest for malformed JSON)
            const titleMatch = textData.match(/"(?:title|yp_currently_playing|StreamTitle)"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
            if (titleMatch && titleMatch[1]) {
              rawTitle = titleMatch[1].replace(/\\"/g, '"').replace(/\\u([0-9a-fA-F]{4})/g, (match, grp) => String.fromCharCode(parseInt(grp, 16))).trim();
              console.log(`[Metadata] Regex match found: ${rawTitle}`);
            }

            // 2. JSON Parse Fallback (with aggressive cleanup)
            if (!rawTitle) {
              try {
                let cleanedJson = textData.trim();
                // Extremely aggressive cleanup for the specific malformed case where source array ends with a comma
                cleanedJson = cleanedJson
                  .replace(/,\s*\]/g, ']') 
                  .replace(/,\s*\}/g, '}')
                  .replace(/\]\s*\]/g, ']')
                  .replace(/\}\s*\}/g, '}');

                // If it ends with ...,]}} or similar
                if (cleanedJson.endsWith(',]}}')) cleanedJson = cleanedJson.replace(/,\]\}\}$/, ']}');
                if (cleanedJson.endsWith(',] }')) cleanedJson = cleanedJson.replace(/,\] \}$/, ']}');
                
                const data = JSON.parse(cleanedJson);
                const icestats = data?.icestats;
                if (icestats) {
                    const sources = icestats.source;
                    if (sources) {
                        const sourcesArray = Array.isArray(sources) ? sources : [sources];
                        // Find source with title, preferring one that matches station keywords if possible
                        const src = sourcesArray.find((s: any) => 
                          s.title && s.title !== "-" && 
                          !["STREAMING", "WEB", "ORBAN", "BUENISIMA"].some(k => s.title.toUpperCase() === k)
                        ) || sourcesArray[0];

                        if (src?.title) rawTitle = src.title.trim();
                        else if (src?.yp_currently_playing) rawTitle = src.yp_currently_playing.trim();

                        // Check for metadata staleness
                        if (src?.metadata_updated) {
                            try {
                                // Icecast date format: "06/Oct/2026:05:03:33 -0400"
                                // We need to convert it to a standard JS date
                                const parts = src.metadata_updated.split(' ');
                                const datePart = parts[0].replace(/:/, ' '); // Replace first colon with space for Date parsing
                                const updated = new Date(datePart).getTime();
                                
                                if (!isNaN(updated)) {
                                    const now = Date.now();
                                    // If metadata is more than 20 mins old, it's considered stale
                                    if (now - updated > 20 * 60 * 1000) {
                                        console.log(`[Metadata] Stale JSON detected (${Math.round((now-updated)/60000)} mins old): ${src.metadata_updated}`);
                                        rawTitle = ""; // Clear it so it doesn't show wrong info
                                    }
                                }
                            } catch (err) {
                                console.error("[Metadata] Error parsing timestamp:", err);
                            }
                        }

                        // Additional check: if the stream name is completely different (e.g. Supercriolla vs Buenisima)
                        // we should be wary of the metadata if it's not updating.
                        const serverName = (src?.server_name || data?.icestats?.server_id || "").toUpperCase();
                        if (serverName.includes("SUPERCRIOLLA") && rawTitle.includes("GLENDY GARCIA")) {
                            console.log("[Metadata] Ignoring known stuck Supercriolla metadata");
                            rawTitle = "";
                        }
                    }
                }
              } catch (_) {
                const fallbackMatch = textData.match(/"title":"([^"]+)"/i) || textData.match(/"StreamTitle":"([^"]+)"/i) || textData.match(/"yp_currently_playing":"([^"]+)"/i);
                if (fallbackMatch) rawTitle = fallbackMatch[1].trim();
              }
            }
          }
        } catch (e: any) {
          // console.warn(`[Metadata] JSON fetch failed for ${url}: ${e.message}`);
        }
      };

      // Try HTTP first for status-json (more reliable for these servers)
      await tryJson(httpStatusUrl);
      if (!rawTitle) await tryJson(httpsStatusUrl);
    } catch (err) {
      console.warn(`[Metadata] URL parsing failed for ${streamUrl}`);
    }

    // Method 2: Shoutcast/Centova 7.html or status.xsl fallback
    if (!rawTitle) {
      try {
        const urlModule = (await import('url')).default;
        const parsed = urlModule.parse(streamUrl);
        const baseUrl = `${parsed.protocol}//${parsed.host}`;
        
        // Try Shoutcast 7.html
        try {
            const res7 = await axios.get(`${baseUrl}/7.html`, {
              httpsAgent: httpsAgent,
              headers: { 'User-Agent': 'Mozilla/5.0' },
              timeout: 2000
            });
            const parts = res7.data.toString().split(',');
            if (parts.length >= 7) rawTitle = parts.slice(6).join(',').replace(/<[^>]*>/g, '').trim();
        } catch (_) {}
        
        // Try status.xsl (Generic Icecast)
        if (!rawTitle) {
            const xslRes = await axios.get(`${baseUrl}/status.xsl`, { httpsAgent, timeout: 2000 });
            const xslMatch = xslRes.data.match(/Current Song:.*?<td[^>]*>(.*?)<\/td>/i);
            if (xslMatch) rawTitle = xslMatch[1].trim();
        }
      } catch (_) {}
    }

    // Method 3: ICY Socket Stream Title extraction (Real-time binary header inspection)
    if (!rawTitle) {
      try {
        const icy = (await import('icy')).default;
        
        rawTitle = await new Promise<string>((resolve) => {
          let found = false;
          // Increase timeout for ICY as some streams send metadata slowly
          const timer = setTimeout(() => { if(!found) resolve(""); }, 6000);
          
          try {
            // Pass agent options to handle SSL cert issues in icy
            const options = {
              headers: { 'Icy-MetaData': '1', 'User-Agent': 'Mozilla/5.0' },
              rejectUnauthorized: false
            };
            
            const client = icy.get(streamUrl as any, options, (res: any) => {
              res.on('metadata', (metadata: Buffer) => {
                const parsed = icy.parse(metadata);
                if (parsed && parsed.StreamTitle) {
                  console.log(`[Metadata] ICY match found: ${parsed.StreamTitle}`);
                  found = true;
                  clearTimeout(timer);
                  res.destroy(); // Stop stream immediately
                  resolve(parsed.StreamTitle.trim());
                }
              });
              res.on('data', () => {}); 
              res.on('error', () => { if(!found) resolve(""); });
            });
            client.on('error', (e: any) => { 
                console.log(`[Metadata] ICY client error: ${e.message}`);
                if(!found) resolve(""); 
            });
          } catch (_) { if(!found) resolve(""); }
        });
      } catch (_) {}
    }

    // Final Processing & Broadcast
    if (rawTitle && rawTitle !== "-" && rawTitle !== "Sintonizando...") {
      let artist = "Buenísima 87.7 FM";
      let title = rawTitle;

      // Handle split patterns: "Artist - Title", "Artist-Title", "Artist : Title", "Artist. Title"
      const separators = [" - ", " : ", " – ", " — ", " | ", " . ", "-", ":", ". "];
      for (const sep of separators) {
          if (rawTitle.includes(sep)) {
              const parts = rawTitle.split(sep);
              // Avoid splitting if the separator is just a dot inside a word (e.g. "St. Vincent")
              if ((sep === ". " || sep === ".") && (parts[0].length < 3 || parts[1].length < 3)) continue; 
              
              artist = parts[0].trim();
              title = parts.slice(1).join(sep).trim();
              break;
          }
      }

      // Special case: if artist is just the station name or common placeholder
      const stationMatch = ["BUENISIMA", "SUPERCRRIOLLA", "EN VIVO", "RADIO"].some(s => artist.toUpperCase().includes(s));
      if (stationMatch && title.includes("-")) {
         // Swap if it looks like the title contains the real metadata
         const subParts = title.split("-");
         artist = subParts[0].trim();
         title = subParts.slice(1).join("-").trim();
      }

      // Special case: remove URLS from title if present
      title = title.replace(/https?:\/\/\S+/gi, '').trim();
      artist = artist.replace(/https?:\/\/\S+/gi, '').trim();

      // Search cover art
      const musicData = await searchItunesCover(artist, title);
      
      const finalResult = {
        title: musicData.title || formatTitleCase(title) || "En Vivo",
        artist: musicData.artist || formatTitleCase(artist) || "Buenísima Radio",
        cover: musicData.cover || DEFAULT_COVER,
        updatedAt: Date.now()
      };

      broadcastRadioMetadata(finalResult);
      return finalResult;
    }

    return cachedMetadata;
  };

  // Periodic background refresh for stream metadata
  let isFetching = false;
  setInterval(async () => {
    if (isFetching) return;
    isFetching = true;
    try {
      await fetchLiveMetadata(activeStreamUrl);
    } catch (err) {}
    finally {
      isFetching = false;
    }
  }, 15000); // 15 seconds to avoid overlapping and respect rate limits

  // Initial fetch on server startup
  setTimeout(() => {
    fetchLiveMetadata(activeStreamUrl).catch(() => {});
  }, 1000);

  // Real-time Server-Sent Events endpoint
  app.get("/api/metadata/stream", (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders?.();

    // Send immediate current state
    res.write(`data: ${JSON.stringify(cachedMetadata)}\n\n`);

    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  // Standard polling API
  app.get("/api/metadata", async (req, res) => {
    // Force refresh if requested
    if (req.query.refresh === 'true') {
        lastMetadataFetch = 0;
        cachedMetadata.title = "Sintonizando...";
    }
    
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const streamUrl = (req.query.url as string) || activeStreamUrl;
    if (streamUrl) activeStreamUrl = streamUrl;

    // Return fresh cache if updated within last 6 seconds
    if (Date.now() - lastMetadataFetch < 6000 && cachedMetadata.title) {
      return res.json(cachedMetadata);
    }

    try {
      const data = await fetchLiveMetadata(streamUrl);
      res.json(data);
    } catch (error) {
      res.json(cachedMetadata);
    }
  });

  // Audio stream proxy endpoint to bypass CORS, firewall port 8010 blocks, and SSL issues
  app.get("/api/stream", async (req, res) => {
    const targetUrl = (req.query.url as string) || activeStreamUrl || "https://redradioypc.com:8010/live";

    res.setHeader("Content-Type", "audio/aac");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");

    try {
      const urlModule = (await import('url')).default;
      const httpModule = (await import('http')).default;
      const httpsModule = (await import('https')).default;
      const parsed = urlModule.parse(targetUrl);
      const isHttps = parsed.protocol === 'https:';
      const client = isHttps ? httpsModule : httpModule;

      const proxyReq = client.get(targetUrl, {
        agent: isHttps ? httpsAgent : undefined,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Icy-MetaData': '0'
        },
        timeout: 8000
      }, (proxyRes) => {
        if (proxyRes.statusCode && proxyRes.statusCode >= 400) {
          if (!res.headersSent) res.status(proxyRes.statusCode);
          proxyRes.destroy();
          res.end();
          return;
        }

        if (proxyRes.headers['content-type']) {
          res.setHeader('Content-Type', proxyRes.headers['content-type']);
        }

        proxyRes.pipe(res);

        proxyRes.on('error', () => {
          try { proxyRes.destroy(); } catch (_) {}
          if (!res.writableEnded) res.end();
        });
      });

      proxyReq.on('error', (err) => {
        if (!res.headersSent) {
          res.status(502).json({ error: "No se pudo conectar a la transmisión", details: err.message });
        } else {
          if (!res.writableEnded) res.end();
        }
      });

      proxyReq.on('timeout', () => {
        try { proxyReq.destroy(); } catch (_) {}
        if (!res.headersSent) {
          res.status(504).end();
        } else {
          if (!res.writableEnded) res.end();
        }
      });

      // Clean up connection immediately when client closes tab or stops player
      req.on('close', () => {
        try { proxyReq.destroy(); } catch (_) {}
      });
      req.on('error', () => {
        try { proxyReq.destroy(); } catch (_) {}
      });

    } catch (e: any) {
      if (!res.headersSent) res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/rss", async (req, res) => {
    try {
      const urlsParam = req.query.urls as string;
      if (!urlsParam) return res.json([]);

      const Parser = (await import('rss-parser')).default;
      const parser = new Parser({
          timeout: 10000,
          requestOptions: {
            agent: httpsAgent
          },
          customFields: {
              item: [
                  ['media:content', 'media:content'],
                  ['enclosure', 'enclosure'],
                  ['content:encoded', 'content:encoded'],
                  ['dc:creator', 'creator']
              ]
          }
      });
      
      const feedUrls = urlsParam.split(',').map(url => decodeURIComponent(url).trim()).filter(Boolean);
      
      const MAX_FEEDS = 5;
      const urlsToProcess = feedUrls.slice(0, MAX_FEEDS);

      let allArticles: any[] = [];
      const { v4: uuidv4 } = await import('uuid');

      const fetchPromises = urlsToProcess.map(async (url) => {
          try {
              let feed;
              try {
                  feed = await parser.parseURL(url);
              } catch (e: any) {
                  if (!url.endsWith('/feed') && !url.endsWith('.xml') && !url.includes('?')) {
                      const fallbackUrl = url.replace(/\/$/, '') + '/feed';
                      feed = await parser.parseURL(fallbackUrl);
                  } else {
                      throw e;
                  }
              }
              const items = feed.items.slice(0, 5).map((item: any) => {
                  let imageUrl = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=1000&auto=format&fit=crop';
                  
                  if (item['media:content'] && item['media:content']['$'] && item['media:content']['$'].url) {
                      imageUrl = item['media:content']['$'].url;
                  } else if (item.enclosure && item.enclosure.url) {
                      imageUrl = item.enclosure.url;
                  } else if (item['content:encoded']) {
                      const imgMatch = item['content:encoded'].match(/<img[^>]+src="([^">]+)"/);
                      if (imgMatch && imgMatch[1]) {
                          imageUrl = imgMatch[1];
                      }
                  } else if (item.content) {
                      const imgMatch = item.content.match(/<img[^>]+src="([^">]+)"/);
                      if (imgMatch && imgMatch[1]) {
                          imageUrl = imgMatch[1];
                      }
                  }

                  let cleanSummary = item.contentSnippet || item.summary || item.content || '';
                  cleanSummary = cleanSummary.replace(/<\/?[^>]+(>|$)/g, "").substring(0, 150) + '...';

                  let date = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
                  if (item.pubDate) {
                      try {
                          date = new Date(item.pubDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
                      } catch (e) {}
                  }

                  return {
                      id: uuidv4(),
                      title: item.title || 'Noticia',
                      summary: cleanSummary,
                      content: item['content:encoded'] || item.content || cleanSummary,
                      date: date,
                      image: imageUrl,
                      author: item.creator || item.author || feed.title || 'Redacción',
                      category: feed.title || 'Noticias',
                      isPublished: true,
                      url: item.link,
                      isRss: true
                  };
              });
              
              allArticles = [...allArticles, ...items];
          } catch (e) {
              console.error(`RSS Error for ${url}:`, e);
          }
      });

      await Promise.all(fetchPromises);
      res.json(allArticles);
    } catch (error) {
      console.error("RSS route error:", error);
      res.json([]);
    }
  });

  app.get("/api/chat/leads", (req, res) => {
    // Extract unique users with phone numbers
    const leadsMap = new Map();
    messages.forEach(msg => {
      if (msg.sender && msg.senderPhone && !msg.isAdmin) {
        leadsMap.set(msg.senderPhone, {
          name: msg.sender,
          phone: msg.senderPhone,
          lastSeen: msg.timestamp
        });
      }
    });
    res.json(Array.from(leadsMap.values()));
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
