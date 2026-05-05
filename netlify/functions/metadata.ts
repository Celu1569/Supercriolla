import { Handler } from '@netlify/functions';

// Prevent native fetch from rejecting streams with invalid/self-signed SSL certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

export const handler: Handler = async (event, context) => {
  try {
    const stream = event.queryStringParameters?.stream;
    const logo = event.queryStringParameters?.logo;
    const stationName = event.queryStringParameters?.station || "";
    
    let title = ""; 
    let artist = "";
    
    let fetchUrls: string[] = [];
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

    // Helper for fetch with timeout
    const fetchWithTimeout = async (url: string, timeoutMs: number) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, { 
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        clearTimeout(id);
        if (!response.ok) return null;
        return await response.text();
      } catch (error) {
        clearTimeout(id);
        return null;
      }
    };

    const fetchPromises = fetchUrls.map(url => fetchWithTimeout(url, 4000));

    for await (const responseText of fetchPromises) {
      if (metadataFound) break;
      if (!responseText) continue;
      const cleanText = responseText.trim();
      if (!cleanText) continue;

      // Shoutcast 1
      if (cleanText.match(/^\d+,\d+,\d+,\d+,\d+,\d+,/)) {
          const parts = cleanText.split(',');
          if (parts.length >= 7) {
              const fullTitle = parts.slice(6).join(',');
              if (fullTitle && !fullTitle.toLowerCase().includes("transmision")) {
                  if (fullTitle.includes(' - ')) {
                      [title, artist] = fullTitle.split(' - ').map((s: string) => s.trim());
                  } else {
                      title = fullTitle;
                  }
                  metadataFound = true;
                  break;
              }
          }
      }

      let data: any;
      try { data = JSON.parse(cleanText.replace(/,\s*([\]}])/g, '$1')); } catch (e) {
          const tm = cleanText.match(/"title"\s*:\s*"([^"]+)"/);
          const am = cleanText.match(/"yp_currently_playing"\s*:\s*"([^"]+)"/);
          const sm = cleanText.match(/"songtitle"\s*:\s*"([^"]+)"/);
          if (tm || am || sm) {
              const ft = sm ? sm[1] : (am ? am[1] : (tm ? tm[1] : ""));
              if (ft) {
                  if (ft.includes(' - ')) [title, artist] = ft.split(' - ').map((s: string) => s.trim());
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
            if (et.includes(' - ')) [title, artist] = et.split(' - ').map((s: string) => s.trim());
            else title = et;
          }
          break;
      } else if (data && data.songtitle) {
          metadataFound = true;
          if (data.songtitle.includes(' - ')) [title, artist] = data.songtitle.split(' - ').map((s: string) => s.trim());
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
    const stationLower = stationName.toLowerCase();
    const isStationName = (s: string) => stationLower && (s.toLowerCase().includes(stationLower) || stationLower.includes(s.toLowerCase()));

    if (title && artist && !isGeneric(title) && !isGeneric(artist) && !isStationName(title) && !isStationName(artist)) {
        try {
          const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(`${artist} ${title}`)}&media=music&limit=1`;
          const itunesResponse = await fetchWithTimeout(itunesUrl, 3000);
          if (itunesResponse) {
             const itunesData = JSON.parse(itunesResponse);
             if (itunesData?.results?.[0]?.artworkUrl100) {
               cover = itunesData.results[0].artworkUrl100.replace('100x100', '600x600');
             }
          }
        } catch (e) { console.error("iTunes error", e); }
    }

    const cleanTitle = isGeneric(title) ? "" : title;
    const cleanArtist = isGeneric(artist) ? "" : artist;

    return {
      statusCode: 200,
      body: JSON.stringify({ title: cleanTitle, artist: cleanArtist, cover }),
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
