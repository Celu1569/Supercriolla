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
  const DEFAULT_COVER = "/images/default-cover.svg";
  let cachedMetadata = { 
    title: "BUENÍSIMA", 
    artist: "La Radio de la Buena Vibra", 
    cover: DEFAULT_COVER,
    updatedAt: Date.now()
  };
  let lastMetadataFetch = 0;
  let activeStreamUrl = "https://redradioypc.com:8010/live";

  // Realtime SSE connected clients
  const sseClients = new Set<express.Response>();

  const broadcastRadioMetadata = (data: typeof cachedMetadata) => {
    cachedMetadata = data;
    lastMetadataFetch = Date.now();
    // Emit via Socket.IO
    try {
      io.emit("radio-metadata", data);
    } catch (_) {}
    // Emit via Server-Sent Events
    for (const client of sseClients) {
      try {
        client.write(`data: ${JSON.stringify(data)}\n\n`);
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
    // If it's all uppercase and longer than 3 chars, title-case it nicely
    if (str === str.toUpperCase() && str.length > 3) {
      return str.toLowerCase().replace(/(?:^|\s|\/|-)\S/g, (char) => char.toUpperCase());
    }
    return str;
  };

  // Helper to search iTunes with multiple fallbacks and match validation
  const searchItunesCover = async (artist: string, title: string) => {
    const cleanArtist = artist.replace(/\s*\([^)]*\)/g, '').replace(/feat\..*$/i, '').trim();
    const cleanTitle = title.replace(/\s*\([^)]*\)/g, '').trim();

    const queries = [
      cleanArtist && cleanTitle ? `${cleanArtist} ${cleanTitle}` : null,
      cleanTitle && cleanArtist ? `${cleanTitle} ${cleanArtist}` : null,
      cleanTitle && cleanTitle.length > 3 ? cleanTitle : null,
      cleanArtist && cleanArtist.length > 2 ? cleanArtist : null,
    ].filter(Boolean) as string[];

    for (const q of queries) {
      try {
        const itunesRes = await axios.get(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&limit=2`, {
          headers: { 'User-Agent': 'curl/8.5.0' },
          timeout: 2500
        });
        if (itunesRes.data.results && itunesRes.data.results.length > 0) {
          // Verify that at least one significant word matches to avoid unrelated album covers
          const queryWords = q.toLowerCase().split(/\s+/).filter(w => w.length >= 4);
          
          for (const item of itunesRes.data.results) {
            const trackLower = (item.trackName || '').toLowerCase();
            const artistLower = (item.artistName || '').toLowerCase();
            
            const matchesQuery = queryWords.length === 0 || queryWords.some(w => 
              trackLower.includes(w) || artistLower.includes(w)
            );

            if (matchesQuery && item.artworkUrl100) {
              const cover = item.artworkUrl100.replace('100x100', '600x600');
              return {
                cover: cover || DEFAULT_COVER,
                title: item.trackName || formatTitleCase(title),
                artist: item.artistName || formatTitleCase(artist)
              };
            }
          }
        }
      } catch (_) {}
    }
    return { cover: DEFAULT_COVER, title: formatTitleCase(title), artist: formatTitleCase(artist) };
  };

  const fetchLiveMetadata = async (streamUrl: string) => {
    if (!streamUrl) return cachedMetadata;

    let rawTitle = "";

    // Method 1: Fast Icecast status-json.xsl check (requires curl/browser UA to bypass server 403)
    try {
      const urlModule = (await import('url')).default;
      const parsed = urlModule.parse(streamUrl);
      const jsonStatusUrl = `${parsed.protocol}//${parsed.host}/status-json.xsl`;
      const statusRes = await axios.get(jsonStatusUrl, {
        httpsAgent: httpsAgent,
        headers: {
          'User-Agent': 'curl/8.5.0',
          'Accept': '*/*'
        },
        timeout: 2500
      });

      if (statusRes.data && statusRes.data.icestats) {
        const source = statusRes.data.icestats.source;
        if (Array.isArray(source)) {
          const matchSource = source.find((s: any) => s.listenurl && streamUrl.includes(s.listenurl.replace('http:', '').replace('https:', ''))) || source[0];
          if (matchSource && matchSource.title) rawTitle = matchSource.title.trim();
        } else if (source && source.title) {
          rawTitle = source.title.trim();
        }
      }
    } catch (_) {}

    // Method 2: ICY Socket fallback with curl User-Agent
    if (!rawTitle) {
      try {
        const icy = (await import('icy')).default;
        const urlModule = (await import('url')).default;
        const parsedUrl = urlModule.parse(streamUrl);
        const isHttps = parsedUrl.protocol === 'https:';

        const options = {
          ...parsedUrl,
          agent: isHttps ? httpsAgent : undefined,
          rejectUnauthorized: false,
          headers: {
            'User-Agent': 'curl/8.5.0',
            'Icy-MetaData': '1'
          }
        };

        rawTitle = await new Promise<string>((resolve) => {
          let isDone = false;
          const timer = setTimeout(() => {
            if (!isDone) { isDone = true; resolve(""); }
          }, 4000);

          try {
            const request = icy.get(options as any, (response: any) => {
              response.on('metadata', (metadataBuffer: Buffer) => {
                if (isDone) return;
                isDone = true;
                clearTimeout(timer);
                try {
                  const parsed = icy.parse(metadataBuffer);
                  if (parsed && parsed.StreamTitle) {
                    try { response.destroy(); } catch (_) {}
                    resolve(parsed.StreamTitle.trim());
                    return;
                  }
                } catch (_) {}
                try { response.destroy(); } catch (_) {}
                resolve("");
              });
              response.on('data', () => {});
              response.on('error', () => { if (!isDone) { isDone = true; clearTimeout(timer); resolve(""); } });
            });
            request.on('error', () => { if (!isDone) { isDone = true; clearTimeout(timer); resolve(""); } });
          } catch (_) {
            if (!isDone) { isDone = true; clearTimeout(timer); resolve(""); }
          }
        });
      } catch (_) {}
    }

    if (rawTitle) {
      let artist = "";
      let title = rawTitle;

      if (rawTitle.includes(" - ")) {
        const parts = rawTitle.split(" - ");
        // Some streams send Track - Artist, others Artist - Track
        artist = parts[0].trim();
        title = parts.slice(1).join(" - ").trim();
      } else if (rawTitle.includes("-")) {
        const parts = rawTitle.split("-");
        artist = parts[0].trim();
        title = parts.slice(1).join("-").trim();
      } else {
        // No dash in stream title
        title = rawTitle;
        artist = "Buenísima 87.7 FM";
      }

      const itunesData = await searchItunesCover(artist, title);
      const result = {
        title: itunesData.title || formatTitleCase(title) || "Buenísima en Vivo",
        artist: itunesData.artist || formatTitleCase(artist) || "La Radio de la Buena Vibra",
        cover: itunesData.cover || DEFAULT_COVER,
        updatedAt: Date.now()
      };

      // If data changed, broadcast to all socket.io clients and SSE streams
      if (
        result.title !== cachedMetadata.title || 
        result.artist !== cachedMetadata.artist || 
        result.cover !== cachedMetadata.cover
      ) {
        broadcastRadioMetadata(result);
      } else {
        cachedMetadata.updatedAt = Date.now();
      }

      return result;
    }

    return cachedMetadata;
  };

  // Periodic background refresh for stream metadata (every 5 seconds for real-time detection)
  setInterval(() => {
    fetchLiveMetadata(activeStreamUrl).catch(() => {});
  }, 5000);

  // Initial fetch on server startup
  setTimeout(() => {
    fetchLiveMetadata(activeStreamUrl).catch(() => {});
  }, 500);

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
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const streamUrl = (req.query.url as string) || activeStreamUrl;
    if (streamUrl) activeStreamUrl = streamUrl;

    // Return fresh cache if updated within last 4 seconds
    if (Date.now() - lastMetadataFetch < 4000 && cachedMetadata.title) {
      return res.json(cachedMetadata);
    }

    try {
      const data = await fetchLiveMetadata(streamUrl);
      res.json(data);
    } catch (error) {
      res.json(cachedMetadata);
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
