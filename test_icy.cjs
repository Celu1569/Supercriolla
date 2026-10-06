const icy = require('icy');
const url = 'http://redradioypc.com:8010/live';

console.log("Connecting to", url);

icy.get(url, (res) => {
  console.log("Headers:", res.headers);
  
  res.on('metadata', (metadata) => {
    const parsed = icy.parse(metadata);
    console.log("METADATA UPDATE:", parsed);
  });
  
  res.on('data', (chunk) => {
    // Just keep connection alive
  });
});

setTimeout(() => {
  console.log("Finished 15s listen.");
  process.exit(0);
}, 15000);
