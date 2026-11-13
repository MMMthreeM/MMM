# 維運材料管理平台（MMM）

工班建立、核對及追蹤材料需求；管理員審核、整理廠商報表及更新交貨進度。介面以白色工作面、藍色主要操作與清楚的資訊層級為基準。

目前只有一套 Google Sheets 業務資料庫，固定儲存契約為 Schema 3（Orders 21 欄、Draft_Item_State 13 欄、Order_History 10 欄）。HTTP contractVersion: 2 是目前 API 契約，與儲存版本分開；沒有舊庫自動判斷或降級寫入。PostgreSQL、獨立 Head 與 Genesis 已移除。

## 開發與驗證

- npm run dev：本機開發。
- npm test：目前單一 Sheets、權限、協調與前端純邏輯測試。
- npm run test:ui：使用 Playwright 與 Edge，以合成資料攔截 API，驗證 320、390、768、1440px 及 100 筆材料。預設啟動本機隔離環境的伺服器；可指定 PLAYWRIGHT_MODULE_DIR、UI_ARTIFACT_DIR、UI_BASE_URL（僅 loopback）。
- npm run lint、npm run build：程式檢查與正式編譯。
- npm run migration:prepare -- --source <私有盤點檔> --out <新的私有轉換檔>：一次性搬移的離線工具，不連線或寫入；新庫已搬移完成，不要再次覆蓋。

開始修改前先讀 AGENTS.md 與 node_modules/next/dist/docs/ 的相關指南。Next.js 16.4.3、React 19.3。

## 執行環境

密鑰使用 .env.local 或部署主機的安全環境設定，不提交 Git、不貼入文件。

- Google 登入：GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET、NEXTAUTH_URL、NEXTAUTH_SECRET。
- Sheets 服務帳號：GOOGLE_CLIENT_EMAIL、GOOGLE_PRIVATE_KEY、GOOGLE_SHEET_ID；服務帳號須有新庫編輯權限。
- 確認簽章：SHEETS_CONFIRMATION_SECRET（至少 32 bytes）；未配置時才使用足夠長的 NEXTAUTH_SECRET。
- Redis 協調／稽核：UPSTASH_REDIS_REST_URL、UPSTASH_REDIS_REST_TOKEN。
- 通知：TELEGRAM_BOT_TOKEN、TG_ADMIN_GROUP_ID、TG_TOPIC_NEW_ORDER、TG_TOPIC_RETURN、TG_TOPIC_ERROR；每日提醒另用 TG_TOPIC_PENDING_REVIEW、CRON_SECRET。

Users 是登入白名單，工班以 Company 共用需求。所有需求寫入經過權限、限流、Redis 擁有者鎖、持久稽核意圖、單次 Sheets batch、寫後讀回。結果不明時保留表單與鎖，不自動重送。

## 主要流程

草稿 → 待審核／退回待修改 → 審核中／審核完畢 → 準備出貨 → 已送達。匯出報表不推進狀態。退回須有具體材料目標與原因，重新送出須逐項處理。

首頁提供建立需求、待辦及最近需求。歷史分為進行中、草稿、已送達；桌機以清單與詳情並排，手機使用獨立詳情頁。修改完成保留搜尋與原位置。

材料編輯以連續白色清單呈現名稱、數量及備註；合併進入選取模式，搜尋／問題篩選與更多操作按需展開。文字叫料已核對的內容沿用確認，修改任一相關欄位會取消該筆確認；整單仍有獨立最後確認。

## 文件

- [Git／Vercel 部署步驟與專案整理紀錄](docs/git-vercel-deployment.md)
- [本輪清理、UI 與真實讀寫驗證](docs/single-sheet-ui-cleanup-2026-11-12.md)
- [固定契約、搬移與部署交接](docs/single-sheet-migration-2026-11-11.md)
- [目前部署與復原規則](docs/security-deployment.md)
- [資料欄位](docs/sheet-headers.md)、[材料目錄](docs/material-catalog.md)
- [視覺規範](DESIGN.md)、[PDF 36 階段追蹤](docs/uiux-review-2026-11-11-requirements.md)
- [原始驗收紀錄](docs/verification.md)：標記的 T07～T10 內容是舊架構歷史紀錄，不能當成目前部署指令。

新庫已搬移 62 張需求、356 筆材料，3 張審核完畢需求可接續操作。已驗證真實服務帳號的維護草稿建立／修改／刪除及 Redis／稽核；既有需求逐格保持一致。尚未部署網站、測試真人 OAuth 登入或實際通知收件。
