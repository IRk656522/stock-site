// 抓證交所盤後資料存成 data/daily/YYYY-MM-DD.json
// 用法：node scripts/fetch.js                       → 今天（台北時間）
//       node scripts/fetch.js --from 2025-11-01 --to 2026-11-11 [--max-minutes 300] [--delay 3500]
// 已抓過的日期會跳過；遇到假日記到 data/holidays.json；被擋或連線失敗就停下，下次從斷點接著抓。
const fs = require('fs');
const path = require('path');
const { parseMiIndex, parseBFI82U } = require('./twse');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const taipeiToday = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const FROM = arg('from', taipeiToday()), TO = arg('to', FROM);
const FORCE_DAYS = +arg('force-days', 0); // 最近 N 天即使已有資料也重抓（盤後數字會更新）
const DELAY = +arg('delay', 3500), MAX_MS = +arg('max-minutes', 300) * 60e3;
const DIR = path.join(__dirname, '..', 'data', 'daily');
const HOL = path.join(__dirname, '..', 'data', 'holidays.json');
fs.mkdirSync(DIR, { recursive: true });
const holidays = new Set(fs.existsSync(HOL) ? JSON.parse(fs.readFileSync(HOL, 'utf8')) : []);
const today = taipeiToday();

const sleep = ms => new Promise(r => setTimeout(r, ms));
const UA = 'Mozilla/5.0 (compatible; stock.baohong.com.tw daily summary)';
async function getJSON(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      const text = await res.text();
      if (!res.ok) throw new Error('HTTP ' + res.status);
      try { return JSON.parse(text); } catch { throw new Error('非 JSON 回應（可能被暫時封鎖）：' + text.slice(0, 80)); }
    } catch (e) {
      if (attempt === 3) throw e;
      console.warn(`  重試 ${attempt}：${e.message}`);
      await sleep(DELAY * 4 * attempt);
    }
  }
}

function* days(from, to) {
  for (let d = new Date(from + 'T00:00:00Z'); d <= new Date(to + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) yield d.toISOString().slice(0, 10);
  }
}

(async () => {
  const t0 = Date.now();
  let got = 0, skipped = 0;
  for (const date of days(FROM, TO)) {
    const file = path.join(DIR, date + '.json');
    const recent = FORCE_DAYS > 0 && (Date.parse(today) - Date.parse(date)) / 864e5 < FORCE_DAYS;
    if (!recent && (fs.existsSync(file) || holidays.has(date))) { skipped++; continue; }
    if (Date.now() - t0 > MAX_MS) { console.log('⏱ 到達時間上限，下次接續'); break; }
    const ymd = date.replace(/-/g, '');
    try {
      const mi = await getJSON(`https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?date=${ymd}&type=ALL&response=json`);
      await sleep(DELAY);
      const m = parseMiIndex(mi);
      if (!m) {
        // 沒資料：過去的日期視為休市；今天可能還沒公布，不記錄
        if (date < today) { holidays.add(date); console.log(`${date} 休市`); }
        else console.log(`${date} 尚無資料`);
        continue;
      }
      const bf = await getJSON(`https://www.twse.com.tw/rwd/zh/fund/BFI82U?type=day&dayDate=${ymd}&response=json`);
      await sleep(DELAY);
      const inst = parseBFI82U(bf);
      if (m.close == null) throw new Error('解析不到加權指數');
      fs.writeFileSync(file, JSON.stringify({ date, ...m, inst }, null, 0));
      got++;
      console.log(`${date} ✓ ${m.close} (${m.change >= 0 ? '+' : ''}${m.change})`);
    } catch (e) {
      console.error(`${date} ✗ ${e.message} → 停止，下次從這天接續`);
      break;
    }
  }
  fs.writeFileSync(HOL, JSON.stringify([...holidays].sort()));
  console.log(`完成：新增 ${got} 天，略過 ${skipped} 天`);
})();
