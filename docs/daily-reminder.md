# 每日待審提醒

Vercel 排程已設定每天 UTC 01:00，即台灣時間 09:00，包含假日。訊息發送到既有管理員群組的主題 30，不需再建立頻道。每天列出待審需求單數（含 0）、退回待補件單數，以及最久等待時間；待審不混入草稿與退回待補件。

部署前，在 Vercel 專案的 Production Environment Variables 新增 `CRON_SECRET`，值使用建議至少 32 字元的隨機字串。系統會拒絕未提供正確驗證的排程請求。保留既有 `TELEGRAM_BOT_TOKEN`、`TG_ADMIN_GROUP_ID` 與 Google Sheets 連線設定。可選擇新增 `TG_TOPIC_PENDING_REVIEW=30`；未設定時也使用已確認的主題 30。

重新部署 Production 後，確認 Vercel 專案 Cron Jobs 已啟用。此功能由 Vercel 執行，不依賴使用者開著網頁，也不由 Codex 聊天排程代送。

Vercel Hobby 的執行時間精度為小時：設定 09:00 時，可能在 09:00–09:59 執行；Pro 的精度為分鐘。此差異不由應用程式控制。官方說明：https://vercel.com/docs/cron-jobs/usage-and-pricing

Vercel 不保證每次排程只被呼叫一次，也不會自動重試失敗作業；本版本不宣稱跨執行個體的去重保證。請由 Vercel 日誌確認傳送結果；Telegram 傳送失敗會回傳錯誤狀態，不會誤報成功。官方管理說明：https://vercel.com/docs/cron-jobs/manage-cron-jobs

文件同步：2026-10-29。頁面與動作名稱見 terminology.md；角色與流程以目前程式及設計規格確認書為準。
