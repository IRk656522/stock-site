// 解析證交所盤後資料（rwd JSON 格式），盡量用欄位名稱與表格標題比對，不依賴固定位置。
const num = s => {
  if (s == null) return null;
  const t = String(s).replace(/<[^>]*>/g, '').replace(/,/g, '').replace(/[＋+]/g, '').trim();
  if (t === '' || t === '--' || t === '---' || t === 'X') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
const strip = s => String(s ?? '').replace(/<[^>]*>/g, '').trim();
// 漲跌欄位像 "<p style= color:red>+</p>" 或 "-"
const signOf = s => {
  const t = String(s ?? '');
  if (/green|-|－/.test(strip(t)) || /color\s*:\s*green/i.test(t)) return -1;
  if (/\+|＋/.test(strip(t)) || /color\s*:\s*red/i.test(t)) return 1;
  return 0;
};
const r2 = n => Math.round(n * 100) / 100;

// rwd 格式為 { tables:[{title,fields,data}] }；舊格式為 fields1/data1…，統一成 tables
function tablesOf(j) {
  if (Array.isArray(j.tables)) return j.tables.filter(t => t && Array.isArray(t.data));
  const out = [];
  for (let i = 1; i <= 12; i++) if (j['data' + i]) out.push({ title: j['subtitle' + i] || '', fields: j['fields' + i] || [], data: j['data' + i] });
  if (j.data && j.fields) out.push({ title: j.title || '', fields: j.fields, data: j.data });
  return out;
}
const findTable = (tables, re) => tables.find(t => re.test(t.title || ''));
const col = (fields, re) => (fields || []).findIndex(f => re.test(strip(f)));

// 這幾個是把多個類股合起來的綜合指數，跟細類重複，排行時排除
const COMPOSITE = /^(水泥窯製|塑膠化工|機電|化學生技醫療|電子工業)類指數$/;

function parseMiIndex(j) {
  if (!j || (j.stat && j.stat !== 'OK')) return null;
  const T = tablesOf(j);
  const res = {};

  // 價格指數：大盤 + 類股
  const px = T.find(t => /價格指數/.test(t.title) && t.data.some(r => /發行量加權股價指數/.test(strip(r[0]))));
  if (!px) return null;
  const ci = Math.max(1, col(px.fields, /收盤/)), si = col(px.fields, /漲跌\(\+\/-\)|漲跌\(\+/), pi = col(px.fields, /點數/), qi = col(px.fields, /百分比/);
  const rowVal = r => {
    const s = si >= 0 ? signOf(r[si]) : 0;
    const pts = num(r[pi >= 0 ? pi : 3]), pct = num(r[qi >= 0 ? qi : 4]);
    const sg = s || Math.sign(pct || 0);
    return { close: num(r[ci]), change: pts == null ? null : r2(Math.abs(pts) * sg), pct: pct == null ? null : r2(Math.abs(pct) * sg) };
  };
  const main = px.data.find(r => strip(r[0]) === '發行量加權股價指數');
  Object.assign(res, rowVal(main));
  res.sectors = px.data
    .filter(r => /類指數$/.test(strip(r[0])) && !/未含|不含|報酬/.test(strip(r[0])) && !COMPOSITE.test(strip(r[0])))
    .map(r => { const v = rowVal(r); return [strip(r[0]).replace(/類指數$/, ''), v.close, v.pct]; })
    .filter(r => r[2] != null);

  // 漲跌家數（優先用「股票」欄）
  const br = findTable(T, /漲跌證券數/);
  if (br) {
    const k = col(br.fields, /^股票$/) >= 0 ? col(br.fields, /^股票$/) : Math.min(2, br.fields.length - 1);
    const pick = re => { const r = br.data.find(x => re.test(strip(x[0]))); if (!r) return [null, null];
      const m = strip(r[k]).match(/([\d,]+)(?:\(([\d,]+)\))?/); return m ? [num(m[1]), m[2] ? num(m[2]) : 0] : [null, null]; };
    const [up, upLimit] = pick(/上漲/), [down, downLimit] = pick(/下跌/), [flat] = pick(/持平|平盤/);
    res.breadth = { up, upLimit, down, downLimit, flat };
  }

  // 成交金額（總計列）
  const st = findTable(T, /大盤統計/);
  if (st) {
    const vi = col(st.fields, /成交金額/);
    const tot = st.data.find(r => /總計/.test(strip(r[0])));
    if (tot && vi >= 0) res.turnover = r2(num(tot[vi]) / 1e8);
  }

  // 個股收盤行情 → 漲跌幅、成交金額排行（只取一般股票：4 碼、非 00 開頭 ETF）
  const qt = T.find(t => /每日收盤行情/.test(t.title)) || T.find(t => col(t.fields, /證券代號/) >= 0 && col(t.fields, /收盤價/) >= 0);
  if (qt) {
    const f = qt.fields, I = { code: col(f, /證券代號/), name: col(f, /證券名稱/), val: col(f, /成交金額/), close: col(f, /收盤價/), sign: col(f, /漲跌\(\+\/-\)/), diff: col(f, /漲跌價差/) };
    const rows = [];
    for (const r of qt.data) {
      const code = strip(r[I.code]);
      if (!/^[1-9]\d{3}$/.test(code)) continue;
      const close = num(r[I.close]), diff = num(r[I.diff]), s = signOf(r[I.sign]);
      if (close == null || diff == null) continue;
      const prev = close - diff * s;
      const pct = prev > 0 ? r2(diff * s / prev * 100) : 0;
      rows.push([code, strip(r[I.name]), close, pct, r2((num(r[I.val]) || 0) / 1e8)]);
    }
    const by = (a, k, d) => [...a].sort((x, y) => d * (y[k] - x[k])).slice(0, 10);
    res.topGain = by(rows.filter(r => r[3] > 0), 3, 1);
    res.topLoss = by(rows.filter(r => r[3] < 0), 3, -1);
    res.topValue = by(rows, 4, 1);
  }
  return res;
}

function parseBFI82U(j) {
  if (!j || (j.stat && j.stat !== 'OK')) return null;
  const t = tablesOf(j)[0] || j;
  const di = Math.max(3, col(t.fields, /差額|買賣超/));
  const get = re => { const r = (t.data || []).find(x => re.test(strip(x[0]))); return r ? r2(num(r[di]) / 1e8) : null; };
  const dealerSelf = get(/自營商\(自行買賣\)|自營商（自行買賣）/), dealerHedge = get(/自營商\(避險\)|自營商（避險）/);
  const dealerOld = dealerSelf == null && dealerHedge == null ? get(/^自營商$/) : null;
  const foreign = get(/外資及陸資|^外資$/), foreignDealer = get(/^外資自營商/), trust = get(/投信/), total = get(/合計/);
  return { foreign, foreignDealer, trust, dealerSelf, dealerHedge, dealer: dealerOld ?? r2((dealerSelf || 0) + (dealerHedge || 0)), total };
}

module.exports = { parseMiIndex, parseBFI82U, num, signOf, strip };
