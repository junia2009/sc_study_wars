// 地図を命令で組み立てる道具。文字列を手で数えると間違えやすいので、
// 「ここに床」「ここに穴」「ここに敵」と書いて、最後に文字列の地図にする。
// 地図の高さは12マス。行10・11が床。主人公や敵は行9に置く。
export function buildMap(width, fn) {
  const H = 12;
  const g = Array.from({ length: H }, () => Array(width).fill('.'));
  const api = {
    put(x, y, c) {
      if (x >= 0 && x < width && y >= 0 && y < H) g[y][x] = c;
    },
    row(x0, x1, y, c) {
      for (let x = x0; x <= x1; x++) api.put(x, y, c);
    },
    col(x, y0, y1, c) {
      for (let y = y0; y <= y1; y++) api.put(x, y, c);
    },
    pit(x0, x1) {
      for (let x = x0; x <= x1; x++) {
        g[10][x] = '.';
        g[11][x] = '.';
      }
    },
    // 床に置く(行9)
    on(x, c) {
      api.put(x, 9, c);
    },
  };
  api.row(0, width - 1, 10, 'G');
  api.row(0, width - 1, 11, 'G');
  fn(api);
  return g.map((r) => r.join(''));
}
