import { Handler } from '@netlify/functions';
import axios from 'axios';
import https from 'https';

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

export const handler: Handler = async (event, context) => {
  // Use a shorter global timeout for the whole function to avoid Netlify killing it
  // and allowing us to return a cached or fallback response
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000);

  try {
    const stream = event.queryStringParameters?.stream;
    const logo = event.queryStringParameters?.logo;
    const stationName = event.queryStringParameters?.station || "";
    
    // Log for debugging (Netlify console)
    console.log(`[Metadata] Request for stream: ${stream}`);

    let title = ""; 
    let artist = "";
    
    let fetchUrls: string[] = [];
    if (stream) {
      try {
        const urlObj = new URL(stream);
        const baseUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.port ? ':' + urlObj.port : ''}`;
        
        // Prioritize known working paths
        fetchUrls.push(`${baseUrl}/status-json.xsl`);
        fetchUrls.push(`${baseUrl}/7.html`);
        fetchUrls.push(`${baseUrl}/status.json`);
        fetchUrls.push(`${baseUrl}/stats?json=1`);
        fetchUrls.push(`${baseUrl}/json.xsl`);
        fetchUrls.push(`${baseUrl}/stats?sid=1`);
        
        if (urlObj.hostname.includes('zeno.fm')) {
          const pathParts = urlObj.pathname.split('/');
          const streamId = pathParts[pathParts.length - 1];
          if (streamId) fetchUrls.push(`https://api.zeno.fm/external/status?stream_id=${streamId}`);
        }
      } catch (e) {}
    }
    
    let metadataFound = false;

    // Helper to parse metadata from various responses
    const parseMetadata = (responseText: string) => {
        let t = "";
        let a = "";

        // Shoutcast 1 (7.html format: 123,1,45,200,45,128,Artist - Title)
        const shoutcastMatch = responseText.match(/^\d+,\d+,\d+,\d+,\d+,\d+,(.*)/);
        if (shoutcastMatch) {
            const fullTitle = shoutcastMatch[1];
            if (fullTitle && !fullTitle.toLowerCase().includes("transmision")) {
                if (fullTitle.includes(' - ')) {
                    [a, t] = fullTitle.split(' - ').map(s => s.trim());
                } else {
                    t = fullTitle;
                }
                return { t, a };
            }
        }

        // JSON Parsing
        let data: any;
        try { 
            data = JSON.parse(responseText.replace(/,\s*([\]}])/g, '$1')); 
        } catch (e) {
            // Manual regex fallback for common keys
            const tm = responseText.match(/"title"\s*:\s*"([^"]+)"/);
            const am = responseText.match(/"yp_currently_playing"\s*:\s*"([^"]+)"/);
            const sm = responseText.match(/"songtitle"\s*:\s*"([^"]+)"/);
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
                const source = sources.find((s: any) => s.yp_currently_playing || s.title) || sources[0];
                const et = source?.yp_currently_playing || source?.title || "";
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

    // Try top 3 URLs in parallel for speed
    const firstBatch = fetchUrls.slice(0, 3);
    const batchResults = await Promise.all(firstBatch.map(async (url) => {
        try {
            const res = await axios.get(url, { 
                timeout: 4000, 
                httpsAgent, 
                signal: controller.signal,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
            });
            return { url, data: res.data };
        } catch (e) { return null; }
    }));

    for (const res of batchResults) {
        if (!res || !res.data) continue;
        const { t, a } = parseMetadata(String(res.data));
        if (t || a) {
            title = t;
            artist = a;
            metadataFound = true;
            break;
        }
    }

    // If still not found, try the rest sequentially (but we probably won't have much time left)
    if (!metadataFound && fetchUrls.length > 3) {
        for (const url of fetchUrls.slice(3)) {
            try {
                const res = await axios.get(url, { timeout: 2000, httpsAgent, signal: controller.signal });
                const { t, a } = parseMetadata(String(res.data));
                if (t || a) {
                    title = t;
                    artist = a;
                    metadataFound = true;
                    break;
                }
            } catch (e) {}
        }
    }

    const isGeneric = (val: string) => {
      if (!val) return true;
      const l = val.toLowerCase();
      return l.includes("señal") || l.includes("recuperando") || l.includes("conectando") || 
             l.includes("en vivo") || l.includes("transmision") || l.includes("icecast") || 
             l.includes("shoutcast") || l.includes("unknown") || l.includes("stream") ||
             l.includes("no title") || l.includes("undefined");
    };
    
    let cover = logo || '';
    const stationLower = stationName.toLowerCase();
    const isStationName = (s: string) => stationLower && (s.toLowerCase().includes(stationLower) || stationLower.includes(s.toLowerCase()));

    // Song metadata cleaning (sometimes they are flipped or have extra text)
    // If it looks like "SONG - ARTIST", the parsing above handled it as a=SONG, t=ARTIST
    // Let's ensure if one is generic, we try to use the other
    const finalTitle = isGeneric(title) ? "" : title;
    const finalArtist = isGeneric(artist) ? "" : artist;

    if (finalTitle && finalArtist && !isStationName(finalTitle) && !isStationName(finalArtist)) {
        try {
          // Search with a clean term
          const searchTerm = `${finalArtist} ${finalTitle}`.replace(/[\[\(\{].*?[\]\)\}]/g, '').trim();
          const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&media=music&limit=1`;
          const itunesResponse = await axios.get(itunesUrl, { timeout: 3000, signal: controller.signal });
          if (itunesResponse.data?.results?.[0]?.artworkUrl100) {
            cover = itunesResponse.data.results[0].artworkUrl100.replace('100x100', '600x600');
          }
        } catch (e) { console.error("[Metadata] iTunes error", e); }
    }

    clearTimeout(timeoutId);

    return {
      statusCode: 200,
      body: JSON.stringify({ title: finalTitle, artist: finalArtist, cover }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        // Edge caching for 20 seconds, browser caching for 10 seconds
        'Cache-Control': 'public, s-maxage=20, max-age=10, stale-while-revalidate=30',
      },
    };
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("[Metadata] Function error:", error);
    return {
      statusCode: 200, // Return 200 even on error to avoid breaking frontend, just return empty data
      body: JSON.stringify({ title: "", artist: "", cover: event.queryStringParameters?.logo || "" }),
      headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
      }
    };
  }
};
