// 產生靜態網站：node build.js [--data data/daily] [--out dist]
const fs = require('fs');
const path = require('path');
const SITE = 'https://stock.baohong.com.tw';
const ADSENSE = 'ca-pub-8779323972048833';
const NAME = '台股每日行情';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const DATA = arg('data', 'data/daily'), OUT = arg('out', 'dist');

const days = fs.existsSync(DATA) ? fs.readdirSync(DATA).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort()
  .map(f => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'))) : [];
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const f of ['style.css', 'page.js']) fs.copyFileSync('src/' + f, path.join(OUT, f));

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const fmt = (n, d = 0) => n == null ? '—' : Number(n).toLocaleString('zh-TW', { minimumFractionDigits: d, maximumFractionDigits: d });
const sign = n => n > 0 ? '+' : n < 0 ? '−' : '';
const cls = n => n > 0 ? 'up' : n < 0 ? 'down' : '';
const arrow = n => n > 0 ? '▲' : n < 0 ? '▼' : '–';
const WD = '日一二三四五六';
const wd = d => WD[new Date(d + 'T00:00:00Z').getUTCDay()];
const slash = d => d.replace(/-/g, '/');
const adHead = ADSENSE ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE}" crossorigin="anonymous"></script>` : '';
const AD = '<div class="ad">廣告</div>';
const verb = d => { const a = Math.abs(d.pct ?? 0); return d.change > 0 ? (a >= 3 ? '大漲' : a >= 1 ? '上漲' : '小漲') : d.change < 0 ? (a >= 3 ? '重挫' : a >= 1 ? '下跌' : '小跌') : '平盤'; };

function layout({ path: p, title, desc, body, ld, data }) {
  return `<!DOCTYPE html>
<html lang="zh-Hant-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/${p}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:locale" content="zh_TW">
<link rel="stylesheet" href="/style.css">
${adHead}
${ld ? `<script type="application/ld+json">${JSON.stringify(ld)}</script>` : ''}
</head>
<body>
<div class="wrap">
<nav class="top"><a class="logo" href="/">📈 ${NAME}</a><span class="sp"></span><a href="/stock/">個股查詢</a><a href="/archive">歷史行情</a><a href="https://salary.baohong.com.tw/crash.html">股災專區</a></nav>
${body}
<footer>
<div class="disclaimer">本站資料整理自臺灣證券交易所公開盤後統計，僅供參考，不構成任何投資建議。投資前請自行判斷並承擔風險。</div>
<a href="/archive">歷史行情</a>｜<a href="https://salary.baohong.com.tw/">薪算盤</a>｜<a href="https://baohong.com.tw/">爆紅好物站</a>｜每個交易日收盤後自動更新
</footer>
</div>
<div class="tip" id="tip" role="tooltip"></div>
<script>window.P=${JSON.stringify(data || {}).replace(/</g, '\\u003c')}</script>
<script src="/page.js" defer></script>
</body>
</html>
`;
}

// 依規則產生當日總結（純數字組句，伺服器端輸出，搜尋引擎看得到）
function summary(d, i) {
  const s = [];
  s.push(`加權指數${verb(d)} <b class="${cls(d.change)}">${fmt(Math.abs(d.change), 2)}</b> 點，收在 ${fmt(d.close, 2)} 點（${sign(d.pct)}${Math.abs(d.pct).toFixed(2)}%）`);
  let n = 0; const dir = Math.sign(d.change);
  for (let k = i; k > 0 && dir !== 0 && Math.sign(days[k].close - days[k - 1].close) === dir; k--) n++;
  if (n >= 2) s[0] += `，${dir > 0 ? '連漲' : '連跌'} ${n} 天、累計${dir > 0 ? '漲' : '跌'} ${fmt(Math.abs(d.close - days[i - n].close))} 點`;
  s[0] += '。';
  const I = d.inst;
  if (I && I.foreign != null) s.push(`外資${I.foreign >= 0 ? '買超' : '賣超'} ${fmt(Math.abs(I.foreign), 2)} 億、投信${I.trust >= 0 ? '買超' : '賣超'} ${fmt(Math.abs(I.trust), 2)} 億，三大法人合計${I.total >= 0 ? '買超' : '賣超'} ${fmt(Math.abs(I.total), 2)} 億。`);
  if (d.sectors?.length) {
    const ss = [...d.sectors].sort((a, b) => b[2] - a[2]), top = ss[0], bot = ss[ss.length - 1];
    s.push(`類股方面，${top[0]}${top[2] >= 0 ? '漲' : '跌'} ${Math.abs(top[2]).toFixed(2)}% 表現最強${bot[2] < 0 ? `，${bot[0]}跌 ${Math.abs(bot[2]).toFixed(2)}% 最弱` : ''}。`);
  }
  // 近一年高點
  const yr = days.slice(Math.max(0, i - 249), i + 1), hi = yr.reduce((a, b) => b.close > a.close ? b : a);
  const off = (d.close / hi.close - 1) * 100;
  if (hi.date === d.date) s.push(`今天收盤創近一年新高。`);
  else if (off <= -10) {
    const after = days.slice(days.indexOf(hi), i + 1), lo = after.reduce((a, b) => b.close < a.close ? b : a), dd = (lo.close / hi.close - 1) * 100;
    s.push(`指數從 ${slash(hi.date.slice(5))} 的近一年高點 ${fmt(hi.close)} 點${lo.date === d.date ? `一路跌到今天，累計跌了 ${Math.abs(dd).toFixed(1)}%${dd <= -20 ? '，進入技術性熊市' : ''}。` : `${dd <= -20 ? `，最深跌了 ${Math.abs(dd).toFixed(1)}%（技術性熊市）` : ''}，目前距高點還差 ${Math.abs(off).toFixed(1)}%。`}`);
  }
  return { html: s.join(''), text: s.join('').replace(/<[^>]+>/g, ''), off, hi };
}

const divRow = (label, v, unit, total) => `<div class="drow${total ? ' total' : ''}" data-v="${v}" data-tip="${esc(`<b>${label}</b><span class="${cls(v)}">${unit === '%' ? `${arrow(v)} ${Math.abs(v).toFixed(2)}%` : `${v >= 0 ? '買超' : '賣超'} ${fmt(Math.abs(v), 2)} 億元`}</span>`)}"><div class="lab">${label}</div><div class="track"><div class="bar ${v >= 0 ? 'pos' : 'neg'}"></div><div class="val">${sign(v)}${unit === '%' ? Math.abs(v).toFixed(2) : fmt(Math.abs(v), 2)}</div></div></div>`;
const stockTable = (rows, k) => `<table><tr><th>股票</th><th class="num">收盤</th><th class="num">${k === 'v' ? '成交金額' : '漲跌幅'}</th></tr>${rows.map(r => `<tr><td><a href="/stock/${r[0]}">${esc(r[1])}</a> <small style="color:var(--text-muted)">${r[0]}</small></td><td class="num">${fmt(r[2], 2)}</td><td class="num ${k === 'v' ? '' : cls(r[3])}">${k === 'v' ? fmt(r[4], 1) + ' 億' : sign(r[3]) + Math.abs(r[3]).toFixed(2) + '%'}</td></tr>`).join('')}</table>`;

function dayPage(d, i, isHome) {
  const S = summary(d, i), prev = days[i - 1], next = days[i + 1];
  const hist = days.slice(Math.max(0, i - 59), i + 1).map(x => [x.date, x.close]);
  const title = `${slash(d.date)}（${wd(d.date)}）台股${verb(d)} ${fmt(Math.abs(d.change))} 點收 ${fmt(d.close)} 點｜${NAME}`;
  const B = d.breadth, I = d.inst;
  const btot = B ? (B.up || 0) + (B.flat || 0) + (B.down || 0) : 0;
  const instRows = I ? [['外資及陸資', I.foreign], ['投信', I.trust], ...(I.dealerSelf != null || I.dealerHedge != null ? [['自營商（自行）', I.dealerSelf], ['自營商（避險）', I.dealerHedge]] : [['自營商', I.dealer]])].filter(r => r[1] != null) : [];
  const secs = [...(d.sectors || [])].sort((a, b) => b[2] - a[2]);
  const body = `
<h1>${slash(d.date)}（${wd(d.date)}）台股${verb(d)} ${fmt(Math.abs(d.change), 2)} 點</h1>
<p class="date">${isHome ? '最新交易日收盤整理' : '當日收盤整理'}</p>
<div class="daynav">${prev ? `<a href="/${prev.date}">← ${slash(prev.date.slice(5))}</a>` : '<span>←</span>'}<a class="mid" href="/archive">📅 歷史</a>${next ? `<a class="nx" href="/${next.date}">${slash(next.date.slice(5))} →</a>` : '<span class="nx">→</span>'}</div>
<section class="card hero">
  <div class="kicker">加權指數收盤</div>
  <div class="idx" id="idx">${fmt(d.close, 2)}</div>
  <div class="chg ${cls(d.change)}">${arrow(d.change)} ${fmt(Math.abs(d.change), 2)} 點（${sign(d.pct)}${Math.abs(d.pct).toFixed(2)}%）</div>
  <div class="summary">${S.html}</div>
  <div class="tiles">
    <div class="tile"><div class="k">成交金額</div><div class="v" id="tVol">${fmt(d.turnover)} 億</div></div>
    <div class="tile"><div class="k">距近一年高點</div><div class="v ${cls(S.off)}">${S.off >= 0 ? '新高' : S.off.toFixed(1) + '%'}</div></div>
    <div class="tile"><div class="k">三大法人</div><div class="v ${cls(I?.total)}">${I?.total != null ? sign(I.total) + fmt(Math.abs(I.total)) + ' 億' : '—'}</div></div>
  </div>
</section>
${AD}
${hist.length > 1 ? `<section class="card reveal"><div class="kicker">近期走勢</div><h2>近 ${hist.length} 個交易日加權指數</h2><p class="note">點圖可以跳到那一天的整理。</p><div id="lineChart"></div></section>
<section class="card reveal"><div class="kicker">每天漲跌幾點</div><h2>每日漲跌點數</h2><p class="note">紅色上漲、綠色下跌（台股慣例）；框線是這一天。</p><div id="colChart"></div><div class="legend"><span><i class="sw" style="background:var(--up)"></i>上漲</span><span><i class="sw" style="background:var(--down)"></i>下跌</span></div></section>` : ''}
${B ? `<section class="card reveal"><div class="kicker">漲跌家數</div><h2>上漲 <span class="up">${fmt(B.up)}</span> 家 vs 下跌 <span class="down">${fmt(B.down)}</span> 家</h2><p class="note">上市股票收盤漲跌家數。</p>
<div class="breadth" role="img" aria-label="上漲 ${B.up} 家、平盤 ${B.flat} 家、下跌 ${B.down} 家" id="breadth">${[['u', '上漲', B.up], ['f', '平盤', B.flat], ['d', '下跌', B.down]].map(([c, l, v]) => `<div class="${c}" data-w="${btot ? (v / btot * 100).toFixed(2) : 0}" data-tip="${esc(`<b>${l} ${fmt(v)} 家</b>占 ${btot ? (v / btot * 100).toFixed(1) : 0}%`)}"></div>`).join('')}</div>
<div class="blabels"><span class="up">上漲 <b>${fmt(B.up)}</b><small>漲停 ${fmt(B.upLimit)}</small></span><span style="color:var(--text-muted)">平盤 <b>${fmt(B.flat)}</b></span><span class="down" style="text-align:right">下跌 <b>${fmt(B.down)}</b><small>跌停 ${fmt(B.downLimit)}</small></span></div></section>` : ''}
${AD}
${instRows.length ? `<section class="card reveal"><div class="kicker">籌碼</div><h2>三大法人合計<span class="${cls(I.total)}">${I.total >= 0 ? '買超' : '賣超'} ${fmt(Math.abs(I.total), 2)} 億</span></h2><p class="note">單位：億元。往右＝買超（紅），往左＝賣超（綠）。</p>
<div class="div"><div class="axis"></div>${instRows.map(r => divRow(r[0], r[1], '億')).join('')}${divRow('三大法人合計', I.total, '億', true)}</div></section>` : ''}
${secs.length ? `<section class="card reveal"><div class="kicker">類股</div><h2>類股漲跌幅排行</h2><p class="note">單位：%。</p>
<div class="div sec" id="sectors"><div class="axis"></div>${secs.map((s, k) => divRow(s[0], s[2], '%').replace('<div class="drow"', `<div class="drow"${secs.length > 12 && k >= 6 && k < secs.length - 6 ? ' hidden' : ''}`)).join('')}</div>
${secs.length > 12 ? `<button class="more" id="secMore">看全部 ${secs.length} 個類股 ↓</button>` : ''}</section>` : ''}
${d.topGain?.length ? `<section class="card reveal"><div class="kicker">個股</div><h2>今日焦點個股</h2><p class="note">上市一般股票（不含 ETF）。</p><div class="lists">
<div><h3 class="up">▲ 漲幅前 10 名</h3>${stockTable(d.topGain)}</div>
<div><h3 class="down">▼ 跌幅前 10 名</h3>${stockTable(d.topLoss || [])}</div>
<div><h3>💰 成交金額前 10 名</h3>${stockTable(d.topValue || [], 'v')}</div></div></section>` : ''}
<section class="card"><div class="kicker">試算工具</div><h2>股市大跌時用得到</h2><div class="tools"><a href="https://salary.baohong.com.tw/recover.html">📈 跌多少要漲多少回本</a><a href="https://salary.baohong.com.tw/margin-call.html">⚠️ 融資斷頭價</a><a href="https://salary.baohong.com.tw/average-down.html">➗ 攤平成本</a></div></section>
${AD}`;
  return layout({
    path: isHome ? '' : d.date, title: isHome ? `今日台股大盤｜${slash(d.date)} 加權指數、三大法人、漲跌家數｜${NAME}` : title,
    desc: S.text.slice(0, 150), body,
    ld: { '@context': 'https://schema.org', '@type': 'Article', headline: title, datePublished: d.date, dateModified: d.date, publisher: { '@type': 'Organization', name: NAME } },
    data: { date: d.date, close: d.close, turnover: d.turnover, hist }
  });
}

days.forEach((d, i) => fs.writeFileSync(path.join(OUT, d.date + '.html'), dayPage(d, i)));
if (days.length) fs.writeFileSync(path.join(OUT, 'index.html'), dayPage(days.at(-1), days.length - 1, true));
else fs.writeFileSync(path.join(OUT, 'index.html'), layout({ path: '', title: NAME, desc: '台股每日收盤整理', body: '<h1>資料準備中</h1><div class="card">正在從證交所整理歷史資料，請稍後再來。</div>' }));

// 歷史總覽
if (days.length) {
  const withChg = days.slice(1);
  const top = (k, dir) => withChg.filter(d => dir * d[k] > 0).sort((a, b) => dir * (b[k] - a[k])).slice(0, 10);
  const row = (d, long) => `<tr><td style="white-space:nowrap"><a href="/${d.date}">${long ? slash(d.date) : slash(d.date.slice(5)) + '（' + wd(d.date) + '）'}</a></td><td class="num">${fmt(d.close, 2)}</td><td class="num ${cls(d.change)}">${sign(d.change)}${fmt(Math.abs(d.change), 2)}</td><td class="num ${cls(d.pct)}">${sign(d.pct)}${Math.abs(d.pct).toFixed(2)}%</td></tr>`;
  const head = '<tr><th>日期</th><th class="num">收盤</th><th class="num">漲跌點</th><th class="num">漲跌幅</th></tr>';
  const months = {}; [...days].reverse().forEach(d => (months[d.date.slice(0, 7)] ||= []).push(d));
  const first = days[0], last = days.at(-1);
  const body = `<h1>台股歷史行情</h1><p class="date">${slash(first.date)} ～ ${slash(last.date)}，共 ${days.length} 個交易日</p>
<section class="card reveal"><div class="kicker">走勢</div><h2>加權指數走勢</h2><p class="note">點圖可以跳到那一天的整理。</p><div id="allLine"></div></section>
${AD}
<section class="card reveal"><div class="kicker">排行</div><h2>單日漲最多的日子</h2><table>${head}${top('change', 1).map(d => row(d, true)).join('')}</table></section>
<section class="card reveal"><h2>單日跌最多的日子</h2><table>${head}${top('change', -1).map(d => row(d, true)).join('')}</table></section>
${AD}
<section class="card months"><div class="kicker">每日</div><h2>逐日行情</h2>${Object.entries(months).map(([m, ds]) => `<h3>${m.replace('-', ' 年 ')} 月</h3><table>${head}${ds.map(d => row(d)).join('')}</table>`).join('')}</section>`;
  fs.writeFileSync(path.join(OUT, 'archive.html'), layout({
    path: 'archive', title: `台股歷史行情｜每日加權指數、單日漲跌排行｜${NAME}`,
    desc: `${slash(first.date)} 起每個交易日的台股收盤整理：加權指數、漲跌點數、三大法人，以及單日漲跌點數排行。`, body,
    data: { all: days.map(d => [d.date, d.close]) }
  }));
}

// ── 個股頁 ──
const { loadQuotes, chartData, stats } = require('./scripts/stocks');
const ONLY = arg('stocks', 'all');
const QDATA = arg('quotes', 'data/quotes');
const stocks = loadQuotes(QDATA, ONLY === 'all' ? null : new Set(ONLY.split(',')));
const LATEST = days.at(-1)?.date;
const stockUrls = [];
fs.mkdirSync(path.join(OUT, 'stock'), { recursive: true });
const px = n => n == null ? '—' : fmt(n, n < 100 ? 2 : n < 1000 ? 1 : 0).replace(/\.0$/, '');
const pxd = n => n == null ? '—' : Number.isInteger(n) ? fmt(n) : fmt(n, 2); // 整數價不顯示 .00
for (const s of stocks.values()) {
  const R = s.rows; if (R.length < 2) continue;
  const last = R.at(-1), prev = R.at(-2), st = stats(R);
  const pct = last[5] / (last[4] - last[5]) * 100;
  const isETF = /^00/.test(s.code);
  fs.writeFileSync(path.join(OUT, 'stock', s.code + '.json'), JSON.stringify(chartData(R)));
  const lastD = last[0];
  const rec = (label, r, extra) => `<div class="tile"><div class="k">${label}</div><div class="v">${extra}</div><small><a href="/${r[0]}">${slash(r[0])}</a></small></div>`;
  const recent = R.slice(-20).reverse();
  const title = `${s.name}（${s.code}）股價｜今日行情、歷史走勢、歷年最高最低｜${NAME}`;
  const firstYear = st.years.at(-1);
  const body = `
<h1>${esc(s.name)} <span class="code">${s.code}</span></h1>
<p class="date">${isETF ? 'ETF' : '上市股票'}｜${slash(lastD)}（${wd(lastD)}）收盤${lastD < LATEST ? '｜<b>最後交易日（已下市或停止交易）</b>' : ''}</p>
<section class="card">
  <div class="quote"><span class="px">${pxd(last[4])}</span><span class="chg ${cls(last[5])}">${arrow(last[5])} ${pxd(Math.abs(last[5]))}（${sign(pct)}${Math.abs(pct).toFixed(2)}%）</span></div>
  <p class="note" style="margin:6px 0 0">開 ${pxd(last[1])}　高 ${pxd(last[2])}　低 ${pxd(last[3])}　昨收 ${pxd(Math.round((last[4] - last[5]) * 100) / 100)}</p>
  <div class="tiles">
    <div class="tile"><div class="k">漲跌幅</div><div class="v ${cls(pct)}">${sign(pct)}${Math.abs(pct).toFixed(2)}%</div></div>
    <div class="tile"><div class="k">成交量</div><div class="v">${fmt(last[6])} 張</div></div>
    <div class="tile"><div class="k">距歷史高點</div><div class="v ${cls(last[4] - st.hi[4])}">${last[4] >= st.hi[4] ? '新高' : ((last[4] / st.hi[4] - 1) * 100).toFixed(1) + '%'}</div></div>
  </div>
  <p class="summary" style="margin:12px 0 0;font-size:15px;line-height:1.75">${esc(s.name)}今天收 ${pxd(last[4])} 元，${last[5] > 0 ? '上漲' : last[5] < 0 ? '下跌' : '平盤'}${last[5] ? ' ' + pxd(Math.abs(last[5])) + ' 元' : ''}。${R[0][0] <= '2017-01-05' ? '自 2017 年以來' : '自 ' + slash(R[0][0]) + ' 以來'}，收盤最高是 ${slash(st.hi[0])} 的 ${pxd(st.hi[4])} 元，最低是 ${slash(st.lo[0])} 的 ${pxd(st.lo[4])} 元。</p>
</section>
${AD}
<section class="card"><div class="kicker">走勢</div><h2>${esc(s.name)}股價走勢</h2><p class="note">收盤價（未還原權息）。超過 1 年的部分以每週收盤顯示；點圖可跳到當天大盤整理。</p>
<div class="rng" role="group" aria-label="期間"><button data-n="22" aria-pressed="false">1 月</button><button data-n="125" aria-pressed="false">6 月</button><button data-n="250" aria-pressed="true">1 年</button><button data-n="100000" aria-pressed="false">全部</button></div>
<div id="stockChart" data-src="/stock/${s.code}.json"></div></section>
<section class="card"><div class="kicker">紀錄</div><h2>歷史紀錄</h2><p class="note">資料期間 ${slash(R[0][0])} ～ ${slash(lastD)}，以收盤價計算。</p>
<div class="recs">${rec('最高收盤', st.hi, pxd(st.hi[4]))}${rec('最低收盤', st.lo, pxd(st.lo[4]))}${st.up ? rec('單日最大漲幅', st.up.r, `<span class="up">+${st.up.p.toFixed(2)}%</span>`) : ''}${st.dn ? rec('單日最大跌幅', st.dn.r, `<span class="down">${st.dn.p.toFixed(2)}%</span>`) : ''}</div></section>
${AD}
<section class="card"><div class="kicker">歷年</div><h2>歷年股價表現</h2>
<table><tr><th>年度</th><th class="num">最高</th><th class="num">最低</th><th class="num">年底收盤</th><th class="num">漲跌幅</th></tr>
${st.years.map(Y => `<tr><td>${Y.y}${Y.partial && Y === firstYear && R[0][0] > '2017-01-05' ? '<small style="color:var(--text-muted)">（起）</small>' : ''}</td><td class="num">${px(Y.hi)}</td><td class="num">${px(Y.lo)}</td><td class="num">${px(Y.close)}</td><td class="num ${cls(Y.chg)}">${Y.chg == null ? '—' : sign(Y.chg) + Math.abs(Y.chg).toFixed(1) + '%'}</td></tr>`).join('')}</table>
<p class="note" style="margin-top:8px">最高、最低為盤中價；${lastD.slice(0, 4)} 年為年初至今，收盤欄為最新收盤。</p></section>
<section class="card"><div class="kicker">近期</div><h2>近 20 個交易日行情</h2>
<table><tr><th>日期</th><th class="num">收盤</th><th class="num">漲跌</th><th class="num">成交量(張)</th></tr>
${recent.map(r => `<tr><td><a href="/${r[0]}">${slash(r[0].slice(5))}（${wd(r[0])}）</a></td><td class="num">${pxd(r[4])}</td><td class="num ${cls(r[5])}">${sign(r[5])}${pxd(Math.abs(r[5]))}</td><td class="num">${fmt(r[6])}</td></tr>`).join('')}</table></section>
${AD}`;
  fs.writeFileSync(path.join(OUT, 'stock', s.code + '.html'), layout({
    path: 'stock/' + s.code, title, desc: `${s.name}（${s.code}）${slash(lastD)} 收盤 ${pxd(last[4])} 元，${sign(pct)}${Math.abs(pct).toFixed(2)}%。歷史最高 ${pxd(st.hi[4])} 元（${slash(st.hi[0])}），附 2017 年以來股價走勢與歷年表現。`,
    body, data: {}
  }));
  stockUrls.push('stock/' + s.code);
}

// 個股列表＋搜尋
if (stocks.size) {
  const list = [...stocks.values()].filter(x => x.rows.length >= 2).map(x => { const l = x.rows.at(-1); return [x.code, x.name, l[4], l[5] / (l[4] - l[5]) * 100, l[0]]; })
    .sort((a, b) => a[0].localeCompare(b[0]));
  const latest = list.reduce((m, r) => r[4] > m ? r[4] : m, '');
  const live = list.filter(r => r[4] === latest);
  const body = `<h1>個股股價查詢</h1><p class="date">上市股票與 ETF，共 ${live.length} 檔｜${slash(latest)} 收盤</p>
<section class="card"><input id="q" type="search" placeholder="輸入代號或名稱，例如 2330、台積電" style="width:100%;font-size:17px;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface-0);color:var(--text-primary)" autocomplete="off">
<table id="tb" style="margin-top:8px"><tr><th>股票</th><th class="num">收盤</th><th class="num">漲跌幅</th></tr>
${live.map(r => `<tr data-k="${r[0]} ${esc(r[1])}"><td><a href="/stock/${r[0]}">${esc(r[1])}</a> <small style="color:var(--text-muted)">${r[0]}</small></td><td class="num">${fmt(r[2], 2)}</td><td class="num ${cls(r[3])}">${sign(r[3])}${Math.abs(r[3]).toFixed(2)}%</td></tr>`).join('')}
</table></section>
<script>document.getElementById('q').addEventListener('input',function(e){var v=e.target.value.trim().toLowerCase();document.querySelectorAll('#tb tr[data-k]').forEach(function(r){r.hidden=v&&r.dataset.k.toLowerCase().indexOf(v)<0})})</script>`;
  fs.writeFileSync(path.join(OUT, 'stock', 'index.html'), layout({ path: 'stock/', title: `個股股價查詢｜上市股票與 ETF 今日行情、歷史走勢｜${NAME}`, desc: `查詢上市股票與 ETF 的今日收盤、漲跌幅，以及 2017 年以來的歷史股價走勢。共 ${live.length} 檔。`, body }));
  stockUrls.unshift('stock/');
}

const urls = ['', 'archive', ...days.map(d => d.date), ...stockUrls];
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${SITE}/${u}</loc><lastmod>${/^\d/.test(u) ? u : days.at(-1)?.date || ''}</lastmod></url>`).join('\n')}
</urlset>
`);
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
fs.writeFileSync(path.join(OUT, 'ads.txt'), `google.com, ${ADSENSE.replace('ca-', '')}, DIRECT, f08c47fec0942fa0\n`);
console.log('built', days.length, 'days,', stockUrls.length, 'stocks');
