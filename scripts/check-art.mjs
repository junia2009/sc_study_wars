// ドット絵のデータの形を確かめる: node scripts/check-art.mjs
import { ALL } from '../src/art.js';
import { STAGE1 } from '../data/stage1.js';

let bad = 0;
for (const [name, rows] of Object.entries(ALL)) {
  const w = rows[0].length;
  rows.forEach((r, y) => {
    if (r.length !== w) {
      console.log(`${name}: ${y}行目の長さが ${r.length}(ほかは ${w})`);
      bad++;
    }
    if (/[^.0-9a-f]/.test(r)) {
      console.log(`${name}: ${y}行目に使えない文字がある: ${r}`);
      bad++;
    }
  });
  if (rows.length !== w) console.log(`(参考) ${name}: ${w}×${rows.length}`);
}

const w = STAGE1.map[0].length;
STAGE1.map.forEach((r, y) => {
  if (r.length !== w) {
    console.log(`stage1: ${y}行目の長さが ${r.length}(ほかは ${w})`);
    bad++;
  }
});

console.log(bad ? `NG: ${bad} か所` : 'OK');
process.exit(bad ? 1 : 0);
