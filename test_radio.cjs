const axios = require('axios');
const https = require('https');

async function test() {
  const stream = "https://redradioypc.com:8010/live";
  const urlObj = new URL(stream);
  const baseUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.port ? ':' + urlObj.port : ''}`;
  console.log("Base:", baseUrl);
  
  const fetchUrls = [
     `${baseUrl}/status-json.xsl`,
     `${baseUrl}/status.json`,
     `${baseUrl}/json.xsl`,
     `${baseUrl}/stats?json=1`,
     `${baseUrl}/7.html`,
     `${baseUrl}/stats?sid=1`
  ];
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  for (const url of fetchUrls) {
     try {
        const res = await axios.get(url, { httpsAgent, timeout: 5000 });
        if(res.data) console.log("SUCCESS on", url, res.data);
     } catch(e) {
        // console.error("failed", url, e.message);
     }
  }
}
test();
