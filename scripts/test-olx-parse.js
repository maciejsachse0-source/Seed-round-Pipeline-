const got = require('got');
(async () => {
  const res = await got.default.get('https://www.olx.pl/d/oferta/pamiatka-i-komunii-swietej-aniolek-dziewczynka-prezent-premium-CID4042-ID1a4bxL.html', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    timeout: { request: 15000 }
  });
  const m = res.body.match(/window\.__PRERENDERED_STATE__\s*=\s*"(.*?)";/);
  if (!m) { console.log('No __PRERENDERED_STATE__'); return; }
  const decoded = JSON.parse('"' + m[1] + '"');
  const data = JSON.parse(decoded);
  const ad = data.ad.ad;
  console.log('location:', JSON.stringify(ad.location));
  console.log('map:', JSON.stringify(ad.map));
  console.log('user:', JSON.stringify(ad.user));
  console.log('category:', JSON.stringify(ad.category));
})();
