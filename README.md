# 維運材料管理平台（MMM）

更新：2026-10-29。工班共用材料需求與草稿，管理員整單審核、匯出廠商報表。以目前程式為準，正式外部服務需另外驗收。

## 開發與驗證

已安裝相依套件後執行 npm run dev；預設 http://localhost:3000。正式版 npm run build，再 npm start。
檢查：npm run lint、npm test、npm run build。瀏覽器回歸為 npm run test:ui，需可用的 Playwright 與瀏覽器；可指定 PLAYWRIGHT_MODULE_DIR、UI_BASE_URL、UI_ARTIFACT_DIR。測試攔截 API，不改正式 Sheets、不實際發 TG。
先讀 AGENTS.md 與 node_modules/next/dist/docs/ 中的相關指南。本專案使用 Next.js 16.4.3、React 19.3、Google Sheets、NextAuth、Sentry。

## 環境與部署

本機使用 .env.local；不可提交密鑰。Vercel Production 必須獨立設定並重新部署：
- Google：GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET、GOOGLE_CLIENT_EMAIL、GOOGLE_PRIVATE_KEY、GOOGLE_SHEET_ID。
- 登入：NEXTAUTH_URL、NEXTAUTH_SECRET。
- 通知：TELEGRAM_BOT_TOKEN、TG_ADMIN_GROUP_ID、TG_TOPIC_NEW_ORDER、TG_TOPIC_RETURN、TG_TOPIC_ERROR。
- 每日提醒：TG_TOPIC_PENDING_REVIEW=30、CRON_SECRET（建議至少 32 個隨機字元）。
Sentry 沿用專案既有設定；不要把部署密鑰貼進文件。每日提醒設 UTC 01:00（台灣 09:00），包含假日；詳見 docs/daily-reminder.md。

## 導覽與資料

管理作業：管理工作總覽、材料審核中心、需求分析儀表板。工班作業：建立材料需求、歷史需求單。一般工班首頁為材料需求儀表板。
Users 是登入白名單；工班資料按 Company 共用，不等於個人建立的資料。Materials A:N 詳見 docs/material-catalog.md。Orders 一列一項材料，同 Order_ID 為整張單；狀態規則由 lib/order-domain.ts 管理，畫面標示由 lib/order-view.ts 管理。

## 文件索引

- 材料需求管理平台 - 設計規格確認書.txt：現行功能、欄位、權限與限制。
- 材料需求管理平台 - 專案執行計畫.txt：交付範圍、驗證與正式驗收待辦。
- PRODUCT.md：產品原則與視覺方向。
- docs/terminology.md：頁面、動作及狀態名稱。
- docs/code-review.md：程式結構、清理結果與保留用途。
- docs/verification.md：驗證範圍與限制。
- docs/telegram-formats.md：推播格式；docs/notifications.md：手機通知與未實作的 Web Push。

有 manifest 與桌面圖示，不代表已有離線下單或網站原生推播。訂單四位隨機碼與 Sheets 全表操作依既有約定未重構。

安全修補更新（2026-10-30）：材料驗證／匯出採一致正規化並重查數量；自訂寫入 API 驗證 Origin、JSON 類型及 128 KiB 上限；Redis 共用帳號限流、非自動過期的全表寫入鎖及先存意圖的稽核補寫。修改單據刪舊與新增改為單次 Sheets 批次。新增管理員稽核補寫入口，待補寫不重送訂單。必須先配置 UPSTASH_REDIS_REST_URL／UPSTASH_REDIS_REST_TOKEN 與正確 NEXTAUTH_URL，否則拒絕寫入；讀取、部署、舊版切換與手動解鎖限制請完整閱讀 docs/security-deployment.md（docs 內文件參照 security-deployment.md）。目前僅模擬測試，真實 Redis 及正式外部服務待驗收。

本輪安全驗證結果（2026-10-30）：35 項模擬流程／安全測試、lint、正式版編譯及攔截 API 的完整桌機／手機回歸通過；包含管理員稽核補寫按鈕。真實 Redis 服務尚未建立，不宣稱已完成正式 Redis／多實例／外部服務驗收。部署前必須先閱讀 docs/security-deployment.md，未設定安全協調服務時拒絕寫入。
