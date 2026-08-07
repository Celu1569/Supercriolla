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
    
    // Use cache if it's for the same stream and fresh (20s)
    // ONLY use cache if it has real metadata (title/artist)
    // Note: Netlify functions are stateless, but we might get lucky with some warm containers
    
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
    
    // Helper to parse metadata from various responses
    const parseMetadata = (responseText: string) => {
        let t = "";
        let a = "";

        if (!responseText || typeof responseText !== 'string') return { t, a };

        // Handle AllOrigins response format if it's used
        let content = responseText;
        try {
            const potentialJson = JSON.parse(responseText);
            if (potentialJson && potentialJson.contents) {
                content = potentialJson.contents;
            }
        } catch (e) {}

        // Shoutcast 1 (7.html format: 123,1,45,200,45,128,Artist - Title)
        const shoutcastMatch = content.match(/^\d+,\d+,\d+,\d+,\d+,\d+,(.*)/);
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
            data = JSON.parse(content.replace(/,\s*([\]}])/g, '$1')); 
        } catch (e) {
            // Manual regex fallback for common keys
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
                const source = sources.find((s: any) => s.yp_currently_playing || s.title || s.song_title) || sources[0];
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

    // Try URLs in parallel. For each URL, try direct and via proxy fallback
    const urlsToTry = fetchUrls.slice(0, 4);
    const results = await Promise.all(urlsToTry.map(async (url) => {
        // Race direct vs proxy for this specific URL
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
            // If the faster one failed or had no metadata, try the slower one
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
    const stationLower = stationName.toLowerCase();
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
