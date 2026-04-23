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
    
    let title = ""; // Let frontend default it
    let artist = "";
    let cover = logo || ''; // Starts as logo, if empty then ''
    
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
        
        // If it's a specific provider like Zeno
        if (urlObj.hostname.includes('zeno.fm')) {
          const pathParts = urlObj.pathname.split('/');
          const streamId = pathParts[pathParts.length - 1];
          if (streamId) {
              fetchUrls.push(`https://api.zeno.fm/external/status?stream_id=${streamId}`);
          }
        }
      } catch (e) {}
    }
    
    // Fallback based on old configs just in case
    fetchUrls.push("https://redradioypc.com:8010/status-json.xsl");
    
    let metadataFound = false;

    // Run parallel fetches to avoid Netlify 10s timeout limits
    const fetchPromises = fetchUrls.map(fetchUrl => 
      axios.get(fetchUrl, {
        timeout: 4000,
        httpsAgent: httpsAgent,
        responseType: 'text', // Fetch as text
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      }).catch(e => null)
    );

    const responses = await Promise.all(fetchPromises);

    for (const response of responses) {
      if (metadataFound || !response || !response.data) continue;
      
      const responseText = response.data.trim();
      if (!responseText) continue;

      // Try Shoutcast 1 extraction
      if (responseText.match(/^\d+,\d+,\d+,\d+,\d+,\d+,/)) {
          const parts = responseText.split(',');
          if (parts.length >= 7) {
              const fullTitle = parts.slice(6).join(',');
              if (fullTitle) {
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
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        try {
          const fixedText = responseText.replace(/,\s*([\]}])/g, '$1');
          data = JSON.parse(fixedText);
        } catch (e2) {
          // Extraction via regex
          const titleMatch = responseText.match(/"title"\s*:\s*"([^"]+)"/);
          const artistMatch = responseText.match(/"yp_currently_playing"\s*:\s*"([^"]+)"/);
          const songTitleMatch = responseText.match(/"songtitle"\s*:\s*"([^"]+)"/);

          if (titleMatch || artistMatch || songTitleMatch) {
              const fullTitle = songTitleMatch ? songTitleMatch[1] : (artistMatch ? artistMatch[1] : (titleMatch ? titleMatch[1] : ""));
              if (fullTitle) {
                  if (fullTitle.includes(' - ')) {
                      [artist, title] = fullTitle.split(' - ').map((s: string) => s.trim());
                  } else {
                      title = fullTitle;
                  }
                  metadataFound = true;
              }
          }
          continue;
        }
      }

      try {
        // Icecast format
        if (data && data.icestats && data.icestats.source) {
          metadataFound = true;
          const sources = Array.isArray(data.icestats.source) 
            ? data.icestats.source 
            : [data.icestats.source];
          
          let source;
          if (stream) {
              try {
                  const urlObj = new URL(stream);
                  const path = urlObj.pathname;
                  source = sources.find((s: any) => s.listenurl && s.listenurl.includes(path)) || sources[0];
              } catch (e) {
                  source = sources[0];
              }
          } else {
              source = sources.find((s: any) => s.listenurl && (s.listenurl.includes('/live') || s.listenurl.includes('/stream'))) || sources[0];
          }
          
          const extractedTitle = source?.yp_currently_playing || source?.title || "";
          if (extractedTitle) {
            if (extractedTitle.includes(' - ')) {
              [artist, title] = extractedTitle.split(' - ').map((s: string) => s.trim());
            } else {
              title = extractedTitle;
              if (source?.server_name && !source.server_name.toLowerCase().includes('icecast')) {
                 artist = source.server_name;
              }
            }
          }
        } 
        // Shoutcast 2 format
        else if (data && data.songtitle) {
          metadataFound = true;
          const fullTitle = data.songtitle;
          if (fullTitle.includes(' - ')) {
            [artist, title] = fullTitle.split(' - ').map((s: string) => s.trim());
          } else {
            title = fullTitle;
          }
        }
        // Zeno format
        else if (data && data.now_playing) {
            metadataFound = true;
            artist = data.now_playing.artist || "";
            title = data.now_playing.title || "";
         }
      } catch (e) {
        // Try next valid response
      }
    }

    // Try iTunes only if we have a real song name and it's not generic
    let itunesCover = '';
    const isGeneric = (val: string) => {
      if (!val) return true;
      const lower = val.toLowerCase();
      return lower === "señal en directo" || 
             lower === "recuperando señal..." || 
             lower === "conectando..." || 
             lower === "en vivo" ||
             lower === "transmision" ||
             lower === "transmisión" ||
             lower === "pasion por lo nuestro" ||
             lower === "pasión por lo nuestro" ||
             lower === "unknown" ||
             lower === "stream" ||
             lower === "radio" ||
             lower.includes("icecast") ||
             lower.includes("shoutcast");
    };
    
    if (title && artist && !isGeneric(title) && !isGeneric(artist)) {
        try {
          const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(`${artist} ${title}`)}&media=music&limit=1`;
          const itunesResponse = await axios.get(itunesUrl, { 
              timeout: 3000,
              headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          
          if (itunesResponse.data && itunesResponse.data.results && itunesResponse.data.results.length > 0) {
            itunesCover = itunesResponse.data.results[0].artworkUrl100.replace('100x100', '600x600');
          }
        } catch (e) {
          console.error("iTunes API error:", e);
        }
    }

    // Use iTunes cover if found, otherwise keep fallback (logo)
    if (itunesCover) {
        cover = itunesCover;
    }

    // Final cleanup of generic strings
    if (isGeneric(title)) title = "";
    if (isGeneric(artist)) artist = "";

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
