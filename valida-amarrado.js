/* Validador do banco TÁ NA BÍBLIA OU TÁ AMARRADO? */
'use strict';
const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync('./amarrado-banco.js', 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(src, ctx);
const Q = ctx.QUESTIONS_ALL;
const CATS = ctx.CATS;
const lvl = { 1: 0, 2: 0, 3: 0 };
const cats = {};
const bad = [];
const frases = {};
Q.forEach(q => {
  lvl[q.lvl] = (lvl[q.lvl] || 0) + 1;
  cats[q.cat] = (cats[q.cat] || 0) + 1;
  frases[q.frase] = (frases[q.frase] || 0) + 1;
  if (!q.frase || typeof q.resp !== 'number' || (q.resp !== 0 && q.resp !== 1) ||
      typeof q.exp !== 'string' || !q.exp || !CATS.includes(q.cat) || ![1, 2, 3].includes(q.lvl)) {
    bad.push(q);
  }
});
const dupsId = Q.length - new Set(Q.map(q => q.id)).size;
const dupsFrase = Object.values(frases).filter(n => n > 1).length;
console.log('TOTAL:', Q.length);
console.log('por nivel:', JSON.stringify(lvl));
console.log('por categoria:', JSON.stringify(cats, null, 0));
console.log('ids duplicados:', dupsId);
console.log('frases duplicadas:', dupsFrase);
console.log('invalidas:', bad.length);
bad.forEach(q => console.log('  BAD:', q.id, q.cat, String(q.frase).slice(0, 50)));
if (bad.length || dupsId || dupsFrase) process.exit(1);
console.log('BANCO OK');
