const axios = require('axios');
const https = require('https');
const httpsAgent = new https.Agent({ rejectUnauthorized: false });
axios.get('https://redradioypc.com:8010/status-json.xsl', { httpsAgent, responseType: 'text' }).then(response => {
  const responseText = response.data.trim();
  let data;
  try {
     data = JSON.parse(responseText.replace(/,\s*([\]}])/g, '$1'));
     console.log('Parsed successfully:', data.icestats.source[0].yp_currently_playing);
  } catch (e) {
     console.log('Parse failed:', e.message);
     const am = responseText.match(/"yp_currently_playing"\s*:\s*"([^"]+)"/);
     console.log('Regex am:', am ? am[1] : null);
  }
});
