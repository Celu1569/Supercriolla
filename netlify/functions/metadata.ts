import { Handler } from '@netlify/functions';
import axios from 'axios';
import https from 'https';

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

export const handler: Handler = async (event, context) => {
  try {
    const icecastUrl = "https://redradioypc.com:8010/status-json.xsl";
    
    // 1. Obtener datos del servidor de Radio
    const response = await axios.get(icecastUrl, { 
      timeout: 5000,
      httpsAgent: httpsAgent 
    });
    
    let title = "Supercriolla 98.7 FM";
    let artist = "En Vivo";

    if (response.data && response.data.icestats && response.data.icestats.source) {
      const sources = Array.isArray(response.data.icestats.source) 
        ? response.data.icestats.source 
        : [response.data.icestats.source];
      
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

    // 2. Buscar carátula en iTunes API
    let cover = 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=600&auto=format&fit=crop';
    try {
      const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(`${artist} ${title}`)}&media=music&limit=1`;
      const itunesResponse = await axios.get(itunesUrl, { timeout: 3000 });
      
      if (itunesResponse.data && itunesResponse.data.results && itunesResponse.data.results.length > 0) {
        cover = itunesResponse.data.results[0].artworkUrl100.replace('100x100', '600x600');
      }
    } catch (e) {
      console.error("iTunes API error:", e);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ title, artist, cover }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    };
  } catch (error) {
    console.error("Error fetching metadata:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch metadata' }),
    };
  }
};
