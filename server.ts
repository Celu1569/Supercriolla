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

// Cache for metadata to avoid hitting external APIs too much
let metadataCache = {
  title: 'Supercriolla 98.7 FM',
  artist: 'En Vivo',
  cover: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=200&auto=format&fit=crop',
  lastUpdate: 0
};

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
    const logo = req.query.logo as string;
    const now = Date.now();

    // Use cache if it's for the same stream and fresh (30s)
    if (metadataCache.streamUrl === stream && (now - metadataCache.lastUpdate < 30000)) {
        return res.json({ 
            title: metadataCache.title, 
            artist: metadataCache.artist, 
            cover: metadataCache.cover || logo || '' 
        });
    }

    try {
      let title = ""; 
      let artist = "";
      
      let fetchUrls = [];
      if (stream) {
        try {
          const urlObj = new URL(stream);
          const baseUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.port ? ':' + urlObj.port : ''}`;
          fetchUrls.push(`${baseUrl}/status-json.xsl`);
          fetchUrls.push(`${baseUrl}/status.json`);
          fetchUrls.push(`${baseUrl}/json.xsl`);
          fetchUrls.push(`${baseUrl}/stats?json=1`);
          fetchUrls.push(`${baseUrl}/7.html`);
          fetchUrls.push(`${baseUrl}/stats?sid=1`);
          
          if (urlObj.hostname.includes('zeno.fm')) {
            const pathParts = urlObj.pathname.split('/');
            const streamId = pathParts[pathParts.length - 1];
            if (streamId) fetchUrls.push(`https://api.zeno.fm/external/status?stream_id=${streamId}`);
          }
        } catch (e) {}
      }
      
      let metadataFound = false;
      const fetchPromises = fetchUrls.map(fetchUrl => 
        axios.get(fetchUrl, {
          timeout: 4000,
          httpsAgent: httpsAgent,
          responseType: 'text',
          headers: { 'User-Agent': 'Mozilla/5.0' }
        }).catch(e => null)
      );

      // Process responses as they come in to return faster
      for await (const response of fetchPromises) {
        if (metadataFound) break;
        if (!response || !response.data) continue;
        const responseText = response.data.trim();
        if (!responseText) continue;

        // Shoutcast 1
        if (responseText.match(/^\d+,\d+,\d+,\d+,\d+,\d+,/)) {
            const parts = responseText.split(',');
            if (parts.length >= 7) {
                const fullTitle = parts.slice(6).join(',');
                if (fullTitle && !fullTitle.toLowerCase().includes("transmision")) {
                    if (fullTitle.includes(' - ')) {
                        [artist, title] = fullTitle.split(' - ').map((s: string) => s.trim());
                    } else {
                        title = fullTitle;
                    }
                    metadataFound = true;
                    break;
                }
            }
        }

        let data: any;
        try { data = JSON.parse(responseText.replace(/,\s*([\]}])/g, '$1')); } catch (e) {
            const tm = responseText.match(/"title"\s*:\s*"([^"]+)"/);
            const am = responseText.match(/"yp_currently_playing"\s*:\s*"([^"]+)"/);
            const sm = responseText.match(/"songtitle"\s*:\s*"([^"]+)"/);
            if (tm || am || sm) {
                const ft = sm ? sm[1] : (am ? am[1] : (tm ? tm[1] : ""));
                if (ft) {
                    if (ft.includes(' - ')) [artist, title] = ft.split(' - ').map((s: string) => s.trim());
                    else title = ft;
                    metadataFound = true;
                    break;
                }
            }
            continue;
        }

        if (data && data.icestats && data.icestats.source) {
            metadataFound = true;
            const sources = Array.isArray(data.icestats.source) ? data.icestats.source : [data.icestats.source];
            const source = sources[0];
            const et = source?.yp_currently_playing || source?.title || "";
            if (et) {
              if (et.includes(' - ')) [artist, title] = et.split(' - ').map((s: string) => s.trim());
              else title = et;
            }
            break;
        } else if (data && data.songtitle) {
            metadataFound = true;
            if (data.songtitle.includes(' - ')) [artist, title] = data.songtitle.split(' - ').map((s: string) => s.trim());
            else title = data.songtitle;
            break;
        } else if (data && data.now_playing) {
             metadataFound = true;
             artist = data.now_playing.artist || "";
             title = data.now_playing.title || "";
             break;
        }
      }

      const isGeneric = (val: string) => {
        if (!val) return true;
        const l = val.toLowerCase();
        return l.includes("señal") || l.includes("recuperando") || l.includes("conectando") || 
               l.includes("en vivo") || l.includes("transmision") || l.includes("icecast") || 
               l.includes("shoutcast") || l.includes("unknown") || l.includes("stream") ||
               l.includes("supercriolla") || l.includes("nueva era") || l.includes("pasion por lo");
      };
      
      let cover = logo || '';
      if (title && artist && !isGeneric(title) && !isGeneric(artist)) {
          try {
            const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(`${artist} ${title}`)}&media=music&limit=1`;
            const itunesResponse = await axios.get(itunesUrl, { timeout: 3000 });
            if (itunesResponse.data?.results?.[0]?.artworkUrl100) {
              cover = itunesResponse.data.results[0].artworkUrl100.replace('100x100', '600x600');
            }
          } catch (e) { console.error("iTunes error", e); }
      }

      const cleanTitle = isGeneric(title) ? "" : title;
      const cleanArtist = isGeneric(artist) ? "" : artist;

      // Update cache
      metadataCache = {
        title: cleanTitle,
        artist: cleanArtist,
        cover: cover,
        lastUpdate: now,
        streamUrl: stream
      };

      res.json({ title: cleanTitle, artist: cleanArtist, cover });
    } catch (error) {
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
