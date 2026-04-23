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
        fetchUrls.push(`${baseUrl}/stats?json=1`);
      } catch (e) {}
    }
    
    // Fallback based on old configs just in case
    fetchUrls.push("https://redradioypc.com:8010/status-json.xsl");
    
    let metadataFound = false;

    // Run parallel fetches to avoid Netlify 10s timeout limits
    const fetchPromises = fetchUrls.map(fetchUrl => 
      axios.get(fetchUrl, {
        timeout: 3000,
        httpsAgent: httpsAgent
      }).catch(e => null) // Suppress errors so Promise.all behaves
    );

    const responses = await Promise.all(fetchPromises);

    for (const response of responses) {
      if (metadataFound || !response || !response.data) continue;
      
      try {
        // Icecast format
        if (response.data.icestats && response.data.icestats.source) {
          metadataFound = true;
          const sources = Array.isArray(response.data.icestats.source) 
            ? response.data.icestats.source 
            : [response.data.icestats.source];
          
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
              source = sources.find((s: any) => s.listenurl && s.listenurl.includes('/live')) || sources[0];
          }
          
          const extractedTitle = source?.yp_currently_playing || source?.title || "";
          if (extractedTitle) {
            if (extractedTitle.includes(' - ')) {
              [artist, title] = extractedTitle.split(' - ').map((s: string) => s.trim());
            } else {
              title = extractedTitle;
              if (source?.server_name) {
                 artist = source.server_name;
              }
            }
          }
        } 
        // Shoutcast format
        else if (response.data.songtitle) {
          metadataFound = true;
          const fullTitle = response.data.songtitle;
          if (fullTitle.includes(' - ')) {
            [artist, title] = fullTitle.split(' - ').map((s: string) => s.trim());
          } else {
            title = fullTitle;
          }
        }
      } catch (e) {
        // Try next valid response
      }
    }

    // Try iTunes only if we have a real song name
    let itunesCover = '';
    if (title && artist && title !== "Transmisión" && artist !== "En Vivo") {
        try {
          const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(`${artist} ${title}`)}&media=music&limit=1`;
          const itunesResponse = await axios.get(itunesUrl, { timeout: 3000 });
          
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
