// 從 data/quotes/*.csv 組出每檔股票的歷史，產生個股頁 /stock/{code} 與圖表資料 /stock/{code}.json
const fs = require('fs');
const path = require('path');

function loadQuotes(dir, only) {
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /^\d{4}-\d{2}-\d{2}\.csv$/.test(f)).sort() : [];
  const S = new Map();
  for (const f of files) {
    const date = f.slice(0, 10);
    const lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n');
    for (let i = 1; i < lines.length; i++) {
      const L = lines[i]; if (!L) continue;
      const c = L.indexOf(','); const code = L.slice(0, c);
      if (only && !only.has(code)) continue;
      const p = L.split(',');
      const close = p[5] === '' ? null : +p[5];
      if (close == null) continue; // 當天沒成交
      let s = S.get(code); if (!s) S.set(code, s = { code, name: p[1], rows: [] });
      s.name = p[1];
      s.rows.push([date, +p[2] || close, +p[3] || close, +p[4] || close, close, p[6] === '' ? 0 : +p[6], Math.round(+p[7] / 1000)]);
    }
  }
  return S;
}

// 圖表資料：近 1 年逐日，更早改成每週最後一個交易日（成交量加總）
function chartData(rows) {
  const cut = rows.length - 250, out = [];
  let wk = null;
  const weekKey = d => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return t.toISOString().slice(0, 10); };
  rows.forEach((r, i) => {
    if (i >= cut) { if (wk) { out.push(wk.row); wk = null; } out.push([r[0], r[4], r[6]]); return; }
    const k = weekKey(r[0]);
    if (!wk || wk.k !== k) { if (wk) out.push(wk.row); wk = { k, n: 1, sum: r[6], row: [r[0], r[4], r[6]] }; }
    else { wk.n++; wk.sum += r[6]; wk.row = [r[0], r[4], Math.round(wk.sum / wk.n)]; } // 週資料：成交量用日平均，才能跟逐日比較
  });
  if (wk) out.push(wk.row);
  return out;
}

function stats(rows) {
  const pct = (r, i) => i && rows[i - 1][4] ? r[5] / (r[4] - r[5]) * 100 : null;
  let hi = rows[0], lo = rows[0], up = null, dn = null;
  rows.forEach((r, i) => {
    if (r[4] > hi[4]) hi = r; if (r[4] < lo[4]) lo = r;
    const p = pct(r, i); if (p == null) return;
    if (!up || p > up.p) up = { r, p }; if (!dn || p < dn.p) dn = { r, p };
  });
  const years = {};
  rows.forEach(r => { const y = r[0].slice(0, 4); const Y = years[y] ||= { y, first: r, last: r, hi: r, lo: r };
    Y.last = r; if (r[2] > Y.hi[2]) Y.hi = r; if (r[3] < Y.lo[3]) Y.lo = r; });
  const yl = Object.values(years).map((Y, i, a) => {
    const base = i ? a[i - 1].last[4] : Y.first[4] - Y.first[5];
    return { y: Y.y, hi: Y.hi[2], lo: Y.lo[3], close: Y.last[4], chg: base ? (Y.last[4] / base - 1) * 100 : null, partial: i === 0 && Y.first[0].slice(5) > '01-05' };
  });
  return { hi, lo, up, dn, years: yl.reverse() };
}

module.exports = { loadQuotes, chartData, stats };
