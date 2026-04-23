const https = require('https');
https.get('https://redradioypc.com:8010/status-json.xsl', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data));
}).on('error', err => console.log('Error:', err.message));
