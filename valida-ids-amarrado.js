/* Cruza IDs usados em amarrado-app.js contra os declarados em amarrado.html */
'use strict';
const fs = require('fs');
const html = fs.readFileSync('amarrado.html', 'utf8');
const app = fs.readFileSync('amarrado-app.js', 'utf8');
const declared = new Set([...html.matchAll(/id="([a-zA-Z0-9]+)"/g)].map(m => m[1]));
const used = new Set([...app.matchAll(/\$\('([a-zA-Z0-9]+)'\)/g)].map(m => m[1]));
const missing = [...used].filter(u => !declared.has(u));
console.log('usados no JS:', used.size, '| declarados no HTML:', declared.size, '| faltando:', missing.length);
if (missing.length) { console.log(missing.join(', ')); process.exit(1); }
console.log('IDS OK');
