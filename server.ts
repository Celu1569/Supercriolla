import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import https from "https";

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

  // Global metadata cache
  let metadataCache = {
    title: "",
    artist: "",
    cover: "",
    lastUpdate: 0,
    streamUrl: ""
  };

  app.get("/api/metadata", async (req, res) => {
    const stream = req.query.stream as string;
    const logo = (req.query.logo as string) || "";
    const station = (req.query.station as string) || "";
    const now = Date.now();

    // Use cache if it's for the same stream and fresh (15s)
    // ONLY use cache if it has real metadata (title/artist)
    if (metadataCache.streamUrl === stream && 
        (now - metadataCache.lastUpdate < 15000) && 
        metadataCache.title && 
        metadataCache.artist) {
        return res.json({ 
            title: metadataCache.title, 
            artist: metadataCache.artist, 
            cover: metadataCache.cover || logo || '' 
        });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      let title = ""; 
      let artist = "";
      
      let fetchUrls: string[] = [];
      if (stream) {
        try {
          const urlObj = new URL(stream);
          const baseUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.port ? ':' + urlObj.port : ''}`;
          const mount = urlObj.pathname.startsWith('/') ? urlObj.pathname : `/${urlObj.pathname}`;
          
          // Try specific mount status first, then general
          if (mount && mount !== '/' && mount !== '/live') {
            fetchUrls.push(`${baseUrl}/status-json.xsl?mount=${mount}`);
          }
          
          fetchUrls.push(`${baseUrl}/status-json.xsl`);
          fetchUrls.push(`${baseUrl}/7.html`);
          fetchUrls.push(`${baseUrl}/status.json`);
          fetchUrls.push(`${baseUrl}/json.xsl`);
          fetchUrls.push(`${baseUrl}/stats?json=1`);
          fetchUrls.push(`${baseUrl}/stats?sid=1`);
          
          if (urlObj.hostname.includes('zeno.fm')) {
            const pathParts = urlObj.pathname.split('/');
            const streamId = pathParts[pathParts.length - 1];
            if (streamId) fetchUrls.push(`https://api.zeno.fm/external/status?stream_id=${streamId}`);
          }
        } catch (e) {}
      }
      
      const parseMetadata = (responseText: string) => {
        let t = "";
        let a = "";

        if (!responseText || typeof responseText !== 'string') return { t, a };

        let content = responseText;
        try {
            const potentialJson = JSON.parse(responseText);
            if (potentialJson && potentialJson.contents) {
                content = potentialJson.contents;
            }
        } catch (e) {}

        const shoutcastMatch = content.match(/^\d+,\d+,\d+,\d+,\d+,\d+,(.*)/);
        if (shoutcastMatch) {
            const fullTitle = shoutcastMatch[1];
            if (fullTitle && !fullTitle.toLowerCase().includes("transmision")) {
                if (fullTitle.includes(' - ')) [a, t] = fullTitle.split(' - ').map(s => s.trim());
                else t = fullTitle;
                return { t, a };
            }
        }

        let data: any;
        try { 
            data = JSON.parse(content.replace(/,\s*([\]}])/g, '$1')); 
        } catch (e) {
            const tm = content.match(/"title"\s*:\s*"([^"]+)"/);
            const am = content.match(/"yp_currently_playing"\s*:\s*"([^"]+)"/);
            const sm = content.match(/"songtitle"\s*:\s*"([^"]+)"/);
            if (tm || am || sm) {
                const ft = sm ? sm[1] : (am ? am[1] : (tm ? tm[1] : ""));
                if (ft) {
                    if (ft.includes(' - ')) [a, t] = ft.split(' - ').map(s => s.trim());
                    else t = ft;
                }
            }
            return { t, a };
        }

        if (data) {
            if (data.icestats && data.icestats.source) {
                const sources = Array.isArray(data.icestats.source) ? data.icestats.source : [data.icestats.source];
                // Prefer source with a title, then fallback to first source
                const source = sources.find((s: any) => (s.yp_currently_playing || s.title || s.song_title)) || sources[0];
                const et = source?.yp_currently_playing || source?.title || source?.song_title || "";
                if (et.includes(' - ')) [a, t] = et.split(' - ').map((s: string) => s.trim());
                else t = et;
            } else if (data.songtitle) {
                if (data.songtitle.includes(' - ')) [a, t] = data.songtitle.split(' - ').map((s: string) => s.trim());
                else t = data.songtitle;
            } else if (data.now_playing) {
                a = data.now_playing.artist || "";
                t = data.now_playing.title || "";
            } else if (data.title && data.artist) {
                t = data.title;
                a = data.artist;
            }
        }
        return { t, a };
      };

      const urlsToTry = fetchUrls.slice(0, 4);
      const results = await Promise.all(urlsToTry.map(async (url) => {
          const controllerLocal = new AbortController();
          const timeoutIdLocal = setTimeout(() => controllerLocal.abort(), 6000);

          try {
              const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
              
              const directPromise = axios.get(url, { 
                  timeout: 5000, 
                  httpsAgent, 
                  signal: controllerLocal.signal,
                  headers
              }).then(r => r.data).catch(() => null);

              const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
              const proxyPromise = axios.get(proxyUrl, { 
                  timeout: 5000, 
                  signal: controllerLocal.signal,
                  headers: { 'User-Agent': 'Mozilla/5.0' }
              }).then(r => r.data?.contents).catch(() => null);

              const fastRes = await Promise.race([directPromise, proxyPromise]);
              clearTimeout(timeoutIdLocal);
              if (fastRes) {
                  const { t, a } = parseMetadata(String(fastRes));
                  if (t || a) return { t, a };
              }
              const slowRes = fastRes === directPromise ? await proxyPromise : await directPromise;
              if (slowRes) {
                  const { t, a } = parseMetadata(String(slowRes));
                  if (t || a) return { t, a };
              }
          } catch (e) {
              clearTimeout(timeoutIdLocal);
          }
          return null;
      }));

      const foundResult = results.find(r => r && (r.t || r.a));
      if (foundResult) {
          title = foundResult.t;
          artist = foundResult.a;
      }

      const isGeneric = (val: string) => {
        if (!val) return true;
        const l = val.toLowerCase();
        return l.includes("señal") || l.includes("recuperando") || l.includes("conectando") || 
               l.includes("transmision") || l.includes("icecast") || 
               l.includes("shoutcast") || l.includes("unknown") || l.includes("undefined") ||
               l.includes("no title") || l.includes("stream") || l.trim() === "-";
      };
      
      let cover = logo || '';
      const stationLower = station.toLowerCase();
      const isStationName = (s: string) => stationLower && (s.toLowerCase().includes(stationLower) || stationLower.includes(s.toLowerCase()));

      let finalTitle = isGeneric(title) ? "" : title;
      let finalArtist = isGeneric(artist) ? "" : artist;

      // If we only have one part, try to use it as title
      if (!finalTitle && finalArtist) {
          finalTitle = finalArtist;
          finalArtist = "";
      }

      if (finalTitle && finalArtist && !isStationName(finalTitle) && !isStationName(finalArtist)) {
          try {
            const searchTerm = `${finalArtist} ${finalTitle}`.replace(/[\[\(\{].*?[\]\)\}]/g, '').trim();
            const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&media=music&limit=1`;
            const itunesResponse = await axios.get(itunesUrl, { timeout: 4000, signal: controller.signal });
            if (itunesResponse.data?.results?.[0]?.artworkUrl100) {
              cover = itunesResponse.data.results[0].artworkUrl100.replace('100x100', '600x600');
            }
          } catch (e) {}
      }

      clearTimeout(timeoutId);

      // Cache the result
      metadataCache = {
        title: finalTitle,
        artist: finalArtist,
        cover: cover,
        lastUpdate: now,
        streamUrl: stream
      };

      res.json({ title: finalTitle, artist: finalArtist, cover });
    } catch (error) {
      clearTimeout(timeoutId);
      console.error("Metadata error:", error);
      res.json({ title: metadataCache.title || '', artist: metadataCache.artist || '', cover: metadataCache.cover || logo || '' });
    }
  });

  app.get("/api/rss", async (req, res) => {
    try {
      const urlsParam = req.query.urls as string;
      if (!urlsParam) return res.json([]);

      const Parser = (await import('rss-parser')).default;
      const parser = new Parser({
          timeout: 10000,
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
