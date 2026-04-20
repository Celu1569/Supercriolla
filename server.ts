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

  app.get("/api/radio/metadata", async (req, res) => {
    const now = Date.now();
    // Cache for 15 seconds
    if (now - metadataCache.lastUpdate < 15000) {
      return res.json(metadataCache);
    }

    try {
      // Try to fetch from Icecast status-json.xsl
      // Note: We use the base URL of the stream
      const icecastUrl = "https://redradioypc.com:8010/status-json.xsl";
      const response = await axios.get(icecastUrl, { 
        timeout: 5000,
        httpsAgent: httpsAgent // Use the agent to bypass SSL verification issues
      });
      
      let title = "Supercriolla 98.7 FM";
      let artist = "En Vivo";

      if (response.data && response.data.icestats && response.data.icestats.source) {
        const sources = Array.isArray(response.data.icestats.source) 
          ? response.data.icestats.source 
          : [response.data.icestats.source];
        
        // Find the source that matches our mount point or just take the first one
        const source = sources.find((s: any) => s.listenurl && s.listenurl.includes('/live')) || sources[0];
        
        if (source && source.title) {
          const fullTitle = source.title;
          if (fullTitle.includes(' - ')) {
            [artist, title] = fullTitle.split(' - ').map((s: string) => s.trim());
          } else {
            title = fullTitle;
          }
        }
      }

      // If title changed, fetch new cover
      if (title !== metadataCache.title || artist !== metadataCache.artist) {
        try {
          const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(`${artist} ${title}`)}&media=music&limit=1`;
          const itunesResponse = await axios.get(itunesUrl, { timeout: 3000 });
          
          if (itunesResponse.data && itunesResponse.data.results && itunesResponse.data.results.length > 0) {
            metadataCache.cover = itunesResponse.data.results[0].artworkUrl100.replace('100x100', '600x600');
          } else {
            // Fallback cover if not found on iTunes
            metadataCache.cover = 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=600&auto=format&fit=crop';
          }
        } catch (e) {
          console.error("iTunes API error:", e);
        }
      }

      metadataCache.title = title;
      metadataCache.artist = artist;
      metadataCache.lastUpdate = now;

      res.json(metadataCache);
    } catch (error) {
      console.error("Metadata fetch error:", error);
      // Return cached version on error
      res.json(metadataCache);
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
