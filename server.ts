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
  app.use(express.json({ limit: '1mb' }));
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

  // In-memory artwork cache: real artwork cached 30m, misses expire in 60s so retries succeed
  const serverArtworkCache = new Map<string, { data: { title: string; artist: string; cover: string }; expiresAt: number }>();

  const STOP_WORDS = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'al', 'y', 'e', 'the', 'a', 'an', 'of', 'in', 'on', 'con', 'ft', 'feat']);
  const normalizeTokens = (str: string): string[] =>
    (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/['’`´]/g, ' ')
      .replace(/\s*\([^)]*\)/g, ' ')
      .replace(/\s*\[[^\]]*\]/g, ' ')
      .replace(/(?:feat|ft)\.?\s+.*$/i, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 0 && !STOP_WORDS.has(w));

  const tokenOverlapScore = (queryStr: string, candidateStr: string): number => {
    const qTokens = normalizeTokens(queryStr);
    const cTokens = normalizeTokens(candidateStr);
    if (qTokens.length === 0 || cTokens.length === 0) return 0;
    const cSet = new Set(cTokens);
    let matches = 0;
    for (const t of qTokens) {
      if (cSet.has(t) || cTokens.some((ct) => ct.length >= 4 && t.length >= 4 && (ct.includes(t) || t.includes(ct)))) {
        matches++;
      }
    }
    return (matches / qTokens.length) * 0.7 + (matches / cTokens.length) * 0.3;
  };

  // Helper to search iTunes & Deezer with bidirectional matching and inversion correction
  const searchMusicArtwork = async (tokenA: string, tokenB: string = '') => {
    // 1. Clean strings from common radio tags, URLs, and symbols
    const cleanStr = (s: string) => s
      .replace(/\s*\([^)]*(?:oficial|audio|video|remaster|letra|lyrics|hd|4k|version)[^)]*\)/gi, '')
      .replace(/\s*\[[^\]]*(?:oficial|audio|video|remaster|letra|lyrics|hd|4k|version)[^\]]*\]/gi, '')
      .replace(/\s*\(.*?\)/g, '')
      .replace(/\s*\[.*?\]/g, '')
      .replace(/feat\..*$/i, '')
      .replace(/ft\..*$/i, '')
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/[^\w\sáéíóúñÁÉÍÓÚÑ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const cA = cleanStr(tokenA);
    const cB = cleanStr(tokenB);
    const cacheKey = `${cA.toLowerCase()}:::${cB.toLowerCase()}`;

    const cachedEntry = serverArtworkCache.get(cacheKey);
    if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
      return cachedEntry.data;
    }

    const pickBestCandidate = (items: { title: string; artist: string; cover: string }[]) => {
      let best: { score: number; title: string; artist: string; cover: string } | null = null;
      for (const item of items) {
        if (!item.cover) continue;
        if (cB) {
          const aToArtist = tokenOverlapScore(cA, item.artist);
          const bToTrack = tokenOverlapScore(cB, item.title);
          const directScore = (aToArtist + bToTrack) / 2;
          const minDirect = Math.min(aToArtist, bToTrack);

          const aToTrack = tokenOverlapScore(cA, item.title);
          const bToArtist = tokenOverlapScore(cB, item.artist);
          const invertedScore = (aToTrack + bToArtist) / 2;
          const minInverted = Math.min(aToTrack, bToArtist);

          const isDirect = minDirect >= 0.45 && directScore >= 0.55;
          const isInverted = minInverted >= 0.45 && invertedScore >= 0.55;
          const score = Math.max(isDirect ? directScore : 0, isInverted ? invertedScore : 0);

          if (score > 0 && (!best || score > best.score)) {
            best = { score, ...item };
          }
        } else {
          const combinedScore = tokenOverlapScore(cA, `${item.artist} ${item.title}`);
          if (combinedScore >= 0.6 && (!best || combinedScore > best.score)) {
            best = { score: combinedScore, ...item };
          }
        }
      }
      return best ? { cover: best.cover, title: best.title, artist: best.artist } : null;
    };

    // 2. Generate search queries
    const queries = [
      cB ? `${cA} ${cB}` : cA,
      cB ? `${cB} ${cA}` : null,
      cA.length > 3 ? cA : null,
      cB.length > 3 ? cB : null,
    ].filter(Boolean) as string[];

    // Strategy 1: iTunes API
    for (const q of queries) {
      if (q.length < 3) continue;
      try {
        const itunesRes = await axios.get(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&limit=10&entity=song`, {
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' 
          },
          timeout: 3200
        });

        const items = (itunesRes.data?.results || [])
          .filter((item: any) => item.artworkUrl100)
          .map((item: any) => ({
            title: item.trackName || '',
            artist: item.artistName || '',
            cover: String(item.artworkUrl100).replace('100x100', '1000x1000')
          }));

        const resolved = pickBestCandidate(items);
        if (resolved) {
          serverArtworkCache.set(cacheKey, { data: resolved, expiresAt: Date.now() + 30 * 60 * 1000 });
          return resolved;
        }
      } catch (_) {}
    }

    // Strategy 2: Deezer API fallback (very fast and vast Latin music catalog)
    const deezerQueries = [
      cB ? `${cA} ${cB}` : cA,
      cB ? `${cB} ${cA}` : null
    ].filter(Boolean) as string[];

    for (const q of deezerQueries) {
      try {
        const deezerRes = await axios.get(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=8`, {
          timeout: 2800
        });
        const items = (deezerRes.data?.data || [])
          .map((item: any) => ({
            title: item.title || '',
            artist: item.artist?.name || '',
            cover: item.album?.cover_xl || item.album?.cover_big || item.album?.cover_medium || ''
          }))
          .filter((x: any) => x.cover);

        const resolved = pickBestCandidate(items);
        if (resolved) {
          serverArtworkCache.set(cacheKey, { data: resolved, expiresAt: Date.now() + 30 * 60 * 1000 });
          return resolved;
        }
      } catch (_) {}
    }

    // Fallback if neither found artwork (short 45s TTL so transient errors never lock the cover permanently)
    const fallback = {
      cover: DEFAULT_COVER,
      title: formatTitleCase(cB || cA) || "En Vivo",
      artist: cB ? formatTitleCase(cA) : "Buenísima 87.7 FM"
    };
    serverArtworkCache.set(cacheKey, { data: fallback, expiresAt: Date.now() + 45 * 1000 });
    return fallback;
  };

  const fetchLiveMetadata = async (streamUrl: string) => {
    if (!streamUrl) return cachedMetadata;

    let rawTitle = "";
    try {
      const parsedUrl = new URL(streamUrl);
      const host = parsedUrl.host;
      const mountPath = parsedUrl.pathname && parsedUrl.pathname !== '/' ? parsedUrl.pathname : '/live';
      const httpStatusUrl = `http://${host}/status-json.xsl`;
      const httpsStatusUrl = `https://${host}/status-json.xsl`;

      // Method 1: Icecast status-json.xsl check
      const tryJson = async (url: string) => {
        try {
          const statusRes = await axios.get(url, {
            httpsAgent: httpsAgent,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              'Accept': 'application/json, text/plain, */*'
            },
            responseType: 'text',
            timeout: 3500
          });

          let textData = statusRes.data;
          if (typeof textData !== 'string') textData = JSON.stringify(textData);

          if (textData) {
            // Parse cleaned JSON first so we select the exact matching mountpoint
            try {
              const cleanedJson = textData.trim().replace(/,\s*([}\]])/g, '$1');
              const data = JSON.parse(cleanedJson);
              const sources = data?.icestats?.source;
              if (sources) {
                const sourcesArray = Array.isArray(sources) ? sources : [sources];
                const src =
                  sourcesArray.find((s: any) => s?.listenurl?.includes(mountPath) && s?.title && s.title !== "-") ||
                  sourcesArray.find((s: any) =>
                    s?.title && s.title !== "-" &&
                    !["STREAMING", "WEB", "ORBAN", "BUENISIMA"].some(k => String(s.title).toUpperCase() === k)
                  ) ||
                  sourcesArray[0];

                if (src?.title && src.title !== "-") rawTitle = String(src.title).trim();
                else if (src?.yp_currently_playing && src.yp_currently_playing !== "-") rawTitle = String(src.yp_currently_playing).trim();
              }
            } catch (_) {}

            // Regex fallback if JSON parsing failed
            if (!rawTitle) {
              const titleMatch = textData.match(/"(?:title|yp_currently_playing|StreamTitle)"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
              if (titleMatch && titleMatch[1] && titleMatch[1] !== "-") {
                rawTitle = titleMatch[1]
                  .replace(/\\"/g, '"')
                  .replace(/\\u([0-9a-fA-F]{4})/g, (_, grp) => String.fromCharCode(parseInt(grp, 16)))
                  .trim();
              }
            }
          }
        } catch (_) {}
      };

      // Try HTTP first, then HTTPS
      await tryJson(httpStatusUrl);
      if (!rawTitle) await tryJson(httpsStatusUrl);
    } catch (err) {
      console.warn(`[Metadata] URL parsing failed for ${streamUrl}`);
    }

    // Method 2: Shoutcast 7.html or status.xsl fallback
    if (!rawTitle) {
      try {
        const urlModule = (await import('url')).default;
        const parsed = urlModule.parse(streamUrl);
        const baseUrl = `${parsed.protocol}//${parsed.host}`;
        
        try {
          const res7 = await axios.get(`${baseUrl}/7.html`, {
            httpsAgent: httpsAgent,
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 2000
          });
          const parts = res7.data.toString().split(',');
          if (parts.length >= 7) rawTitle = parts.slice(6).join(',').replace(/<[^>]*>/g, '').trim();
        } catch (_) {}
        
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
        const icyTitle = await new Promise<string>((resolve) => {
          let found = false;
          const timer = setTimeout(() => { if (!found) resolve(""); }, 3500);
          
          try {
            const options = {
              headers: { 'Icy-MetaData': '1', 'User-Agent': 'Mozilla/5.0' },
              rejectUnauthorized: false
            };
            
            const client = icy.get(streamUrl as any, options, (res: any) => {
              res.on('metadata', (metadata: Buffer) => {
                const parsed = icy.parse(metadata);
                if (parsed && parsed.StreamTitle) {
                  found = true;
                  clearTimeout(timer);
                  res.destroy(); 
                  resolve(parsed.StreamTitle.trim());
                }
              });
              res.on('data', () => {}); 
              res.on('error', () => { if (!found) resolve(""); });
            });
            client.on('error', () => { if (!found) resolve(""); });
          } catch (_) { if (!found) resolve(""); }
        });

        if (icyTitle) {
          rawTitle = icyTitle;
        }
      } catch (_) {}
    }

    // Final Processing & Broadcast
    if (rawTitle && rawTitle !== "-" && rawTitle !== "Sintonizando...") {
      // Split patterns: "Artist - Title" or "Title - Artist"
      let partA = rawTitle;
      let partB = "";
      const separators = [" - ", " : ", " – ", " — ", " | "];
      for (const sep of separators) {
        if (rawTitle.includes(sep)) {
          const parts = rawTitle.split(sep);
          partA = parts[0].trim();
          partB = parts.slice(1).join(sep).trim();
          break;
        }
      }

      // Check if one part is just the station name or placeholder
      const stationMatch = ["BUENISIMA", "SUPERCRRIOLLA", "EN VIVO", "RADIO"].some(s => partA.toUpperCase().includes(s));
      if (stationMatch && partB.includes("-")) {
        const subParts = partB.split("-");
        partA = subParts[0].trim();
        partB = subParts.slice(1).join("-").trim();
      }

      // Resolve high-resolution album artwork & real artist/track names
      const musicData = await searchMusicArtwork(partA, partB);
      
      const finalResult = {
        title: musicData.title || formatTitleCase(partB || partA) || "En Vivo",
        artist: musicData.artist || (partB ? formatTitleCase(partA) : "BUENÍSIMA 87.7 FM"),
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

    // Return fresh cache ONLY if updated within last 6s AND we actually have a resolved song title
    if (
      Date.now() - lastMetadataFetch < 6000 &&
      cachedMetadata.title &&
      cachedMetadata.title !== "Sintonizando..."
    ) {
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

  // Live Push Notifications real-time relay (complements Firestore settings/config)
  let activeLivePush: any = null;

  io.on("connection", (socket) => {
    if (activeLivePush && activeLivePush.active) {
      socket.emit("live-push", activeLivePush);
    }
    socket.on("get-live-push", () => {
      if (activeLivePush && activeLivePush.active) {
        socket.emit("live-push", activeLivePush);
      }
    });
    socket.on("send-live-push", (payload) => {
      if (!payload || typeof payload.title !== "string" || typeof payload.message !== "string") return;
      activeLivePush = {
        id: payload.id || `push-${Date.now()}`,
        title: payload.title.trim().slice(0, 140),
        message: payload.message.trim().slice(0, 400),
        category: payload.category || "live",
        badgeText: payload.badgeText ? String(payload.badgeText).slice(0, 30) : undefined,
        imageUrl: payload.imageUrl ? String(payload.imageUrl).slice(0, 600) : undefined,
        actionLabel: payload.actionLabel ? String(payload.actionLabel).slice(0, 50) : undefined,
        actionUrl: payload.actionUrl ? String(payload.actionUrl).slice(0, 600) : undefined,
        playSound: payload.playSound !== false,
        durationSeconds: typeof payload.durationSeconds === "number" ? payload.durationSeconds : 18,
        sentAt: payload.sentAt || new Date().toISOString(),
        active: payload.active !== false
      };
      io.emit("live-push", activeLivePush);
    });
    socket.on("clear-live-push", () => {
      activeLivePush = null;
      io.emit("live-push-cleared");
    });
  });

  app.get("/api/push/latest", (_req, res) => {
    res.json({ notification: activeLivePush });
  });

  app.post("/api/push", (req, res) => {
    const payload = req.body;
    if (!payload || typeof payload.title !== "string" || !payload.title.trim() || typeof payload.message !== "string" || !payload.message.trim()) {
      return res.status(400).json({ error: "Se requiere título y mensaje para enviar la notificación." });
    }
    activeLivePush = {
      id: typeof payload.id === "string" && payload.id ? payload.id : `push-${Date.now()}`,
      title: payload.title.trim().slice(0, 140),
      message: payload.message.trim().slice(0, 400),
      category: payload.category || "live",
      badgeText: payload.badgeText ? String(payload.badgeText).slice(0, 30) : undefined,
      imageUrl: payload.imageUrl ? String(payload.imageUrl).slice(0, 600) : undefined,
      actionLabel: payload.actionLabel ? String(payload.actionLabel).slice(0, 50) : undefined,
      actionUrl: payload.actionUrl ? String(payload.actionUrl).slice(0, 600) : undefined,
      playSound: payload.playSound !== false,
      durationSeconds: typeof payload.durationSeconds === "number" ? Math.min(Math.max(payload.durationSeconds, 5), 120) : 18,
      sentAt: typeof payload.sentAt === "string" && payload.sentAt ? payload.sentAt : new Date().toISOString(),
      active: payload.active !== false
    };
    io.emit("live-push", activeLivePush);
    return res.json({ ok: true, notification: activeLivePush });
  });

  app.delete("/api/push", (_req, res) => {
    activeLivePush = null;
    io.emit("live-push-cleared");
    return res.json({ ok: true });
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
