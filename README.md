# 台股每日行情

https://stock.baohong.com.tw

每個交易日收盤後，自動抓臺灣證券交易所盤後資料，產生當日整理頁。

- `scripts/fetch.js`：抓資料存到 `data/daily/`（限速、已抓過自動跳過、被擋就停下次接續）
- `build.js`：產生網站到 `dist/`（首頁＝最新一天、每日頁 `/YYYY-MM-DD`、歷史總覽 `/archive`）
- `.github/workflows/daily.yml`：每個交易日台北 15:30、17:30 自動更新
- `.github/workflows/backfill.yml`：修改 `backfill.json` 的 from / to 推上來，就會往回補資料
- 測試：`node --test test/parse.test.js`
