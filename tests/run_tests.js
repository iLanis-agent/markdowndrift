/* MarkdownDrift node runner: engine findings vs oracle-derived PM labels */
'use strict';
const fs = require('fs');
const path = require('path');
const MD = require(path.join(__dirname, '..', 'engine.js'));
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'cases.json'), 'utf8'));
const expected = JSON.parse(fs.readFileSync(path.join(__dirname, 'expected.json'), 'utf8'));

let checks = 0, fails = [];
function chk(c, m) { checks++; if (!c) fails.push(m); }

cases.forEach((c, i) => {
  const exp = expected[i];
  const got = MD.findings(c.input);
  const gotKinds = {};
  got.forEach(f => { gotKinds[f.kind] = f.outcomes.pm; });
  const expKinds = Object.keys(exp.kinds);
  const gotList = Object.keys(gotKinds);
  chk(JSON.stringify(gotList.slice().sort()) === JSON.stringify(expKinds.slice().sort()),
    `${c.name}: kinds js=${JSON.stringify(gotList)} expected=${JSON.stringify(expKinds)}`);
  expKinds.forEach(k => {
    chk(gotKinds[k] === exp.kinds[k], `${c.name}/${k}: pm label js=${gotKinds[k]} oracle=${exp.kinds[k]}`);
  });
  got.forEach(f => {
    chk(typeof f.line === 'number' && f.line >= 1, `${c.name}/${f.kind}: bad line ${f.line}`);
    chk(f.name && f.explain && f.outcomes.cm && f.outcomes.gfm && f.outcomes.pl, `${c.name}/${f.kind}: missing fields`);
  });
});

// unit: every construct has all four flavor outcomes
Object.entries(MD.CONSTRUCTS).forEach(([k, c]) => {
  chk(['cm','gfm','pm','pl'].every(f => c.outcomes[f]), `${k}: incomplete outcomes`);
  chk(c.name && c.explain, `${k}: missing name/explain`);
});

console.log(`${checks} checks, ${fails.length} failures`);
if (fails.length) { fails.forEach(f => console.log('FAIL', f)); process.exit(1); }
console.log('ALL PASS');
