const res = await fetch('https://arcco-web.onrender.com/assets/index-B045Ayi2.js');
const js = await res.text();
const re = /https?:\/\/[a-zA-Z0-9._:-]+/g;
const hits = [...new Set(js.match(re) || [])];
console.log(hits.filter((u) => /onrender|localhost|arcco/.test(u)).join('\n'));
console.log('has localhost', js.includes('localhost:3000') || js.includes('localhost:3001'));
console.log('has arcco-api', js.includes('arcco-api.onrender.com'));
