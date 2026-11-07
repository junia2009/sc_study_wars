// ドット絵と地図の形を確かめる: node scripts/check-art.mjs
import { allArt } from '../src/art.js';
import { STAGE1 } from '../data/stage1.js';

let bad = 0;
for (const [name, G] of Object.entries(allArt())) {
  const w = G[0].length;
  if (G.some((r) => r.length !== w)) {
    console.log(`${name}: 行の長さがそろっていない`);
    bad++;
  }
  // 端の列・行まで色が来ていたら、はみ出して切れている恐れがある(地形は除く)
  const edge = G[0].some(Boolean) || G.some((r) => r[0] || r[w - 1]);
  if (edge && !/ground|block|qblock|used|door/.test(name)) console.log(`(注意) ${name}: 絵が端に触れている`);
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
