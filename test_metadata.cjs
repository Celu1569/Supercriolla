const axios = require('axios');
axios.get('http://127.0.0.1:3000/api/metadata?stream=https://redradioypc.com:8010/live').then(response => {
  console.log('Metadata API Response:', response.data);
}).catch(console.error);
