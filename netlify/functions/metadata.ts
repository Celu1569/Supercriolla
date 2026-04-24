import { Handler } from '@netlify/functions';
import axios from 'axios';
import https from 'https';

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

export const handler: Handler = async (event, context) => {
  try {
    const stream = event.queryStringParameters?.stream;
    const logo = event.queryStringParameters?.logo;
    
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
        timeout: 8000,
        httpsAgent: httpsAgent,
        responseType: 'text',
        headers: { 'User-Agent': 'Mozilla/5.0' }
      }).catch(e => null)
    );

    const responses = await Promise.all(fetchPromises);

    for (const response of responses) {
      if (metadataFound || !response || !response.data) continue;
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
                  continue;
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
      } else if (data && data.songtitle) {
          metadataFound = true;
          if (data.songtitle.includes(' - ')) [artist, title] = data.songtitle.split(' - ').map((s: string) => s.trim());
          else title = data.songtitle;
      } else if (data && data.now_playing) {
           metadataFound = true;
           artist = data.now_playing.artist || "";
           title = data.now_playing.title || "";
      }
    }

    const isGeneric = (val: string) => {
      if (!val) return true;
      const l = val.toLowerCase();
      return l === "señal en directo" || l === "recuperando señal..." || l === "conectando..." || 
             l === "en vivo" || l === "transmision" || l.includes("icecast") || l.includes("shoutcast") ||
             l === "unknown" || l === "stream";
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
