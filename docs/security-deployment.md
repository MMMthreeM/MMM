# 安全修補部署與維運（2026-10-30）

## 部署前必讀

本版本的訂單寫入、狀態變更、匯出、刪除及問題回報需要 Upstash Redis。沒有設定或服務無法連線時拒絕寫入，不會退回本機鎖。未設定 Redis 時原有讀取仍可用；已設定後，讀取也有帳號限流，Redis 故障可能使受保護 API 暫時無法使用。
沒有建立真實 Redis、沒有讀取或寫入本機密鑰、沒有部署正式服務。自動測試的 Redis HTTP 及資料操作皆為模擬，真實服務與多實例行為仍須在測試環境驗收。

## 尚無 Redis 的設定步驟

1. 以組織可管理的帳號登入 https://console.upstash.com/，建立專供 MMM 使用的 Redis 資料庫。開發／Preview 與 Production 應使用不同 Redis 及不同 Google Sheet，避免測試影響正式鎖。
2. 確認資料庫啟用適合正式資料的持久化，禁止自動 eviction，不能把鎖或待處理稽核鍵設到期，也不要任意清空資料庫。確認容量、備份、權限與用量告警；服務方案與費用由管理者確認。
3. 從資料庫詳細頁複製 REST URL 與可寫入的 REST Token 到 Vercel 專案 Settings → Environment Variables：UPSTASH_REDIS_REST_URL、UPSTASH_REDIS_REST_TOKEN。Token 設為 Secret；只配置正確環境，不使用 Readonly Token，不放 NEXT_PUBLIC_，不貼進聊天或 Git。
4. NEXTAUTH_URL 應是該環境的正式平台來源（含 https）。本機測試則對應本機網址與埠號。API 嚴格驗證 Origin；不要用萬用字元或信任任意子網域。其餘 Google／TG／CRON_SECRET 設定沿用。
5. 確認 Audit_Logs!A1:F1 是 Log_ID、Timestamp、User_Email、Action、Target_Order_ID、Details。其他工作表不用新增欄位。Redis 僅存事件識別、時間、操作者、動作、目標單號、摘要與請求雜湊，不存整份下單內容／單價／金鑰。
6. 先部署到獨立測試環境，完成以下驗收，再安排正式維護時段切換。切換時暫停舊版寫入、等待舊請求全部結束，確保沒有舊版本、舊自動化或手動 Sheets 編輯繞過新鎖。只切網址、不停止舊寫入並不能保證安全。

## 正式驗收

- 不登入不可用業務 API；工班不可跨工班；一般使用者不可呼叫管理員補寫／匯出。
- 正常建立、存草稿、正式送出、修改、整單刪除、管理編輯、退回、審核、匯出、重匯、送達均可操作。
- 測試資料最低量／級距為 100 時，自填尾端空白、全形單位、外購廠商別名不得用數量 1 繞過；既有不合規需求匯出時會拒絕，須人工確認，不能直接假設可匯出。
- 兩個 Vercel 執行個體同時更新／刪除不同工班訂單：只有鎖持有人寫入，另一請求回 423。完成後可重試；檢查沒有跨單修改。
- 外站 Origin、缺 Origin、text/plain 被拒絕。JSON 上限 128 KiB，包含串流讀取量檢查。
- 每帳號固定分鐘窗：驗證入口共用 120 次（含內部再次驗證）；存單及管理狀態／編輯 20 次、刪除及草稿送出 10 次、匯出／回報／稽核補寫 3 次。超限 429 並提供 Retry-After。不是無限額度保證，需配合 Vercel 邊緣防護。
- 測試稽核工作表不可用：成功訂單不變成失敗、不自動重送，畫面提示待補寫。修復後在管理工作總覽按「補寫待處理稽核紀錄」，確認不重做業務操作。一次最多處理十個事件，量多可再次執行。
- 模擬寫入回應不確定：保留鎖並回傳 X-Write-Status: review-required，不自動讓新請求接手。

## 稽核與故障處理

所有寫入先在 Redis 建立 started 意圖，再執行業務作業；結束後紀錄 completed／rejected／unknown，最後補寫 Sheets。既有 logAudit 呼叫只收集同一事件摘要；不能在安全包裝外獨立呼叫。
已完成的 Sheets 寫入依 SEC 事件 ID 辨識，重試先檢查既有 ID，避免一般重試重複；網路回應延遲仍可能出現同 ID 的重複實體列，查閱時應按 ID 去重，不宣稱跨服務 exactly-once。
started 事件不會被自動確認完成或重做訂單。若終止在 started，管理員須核對業務資料、原請求與日誌，人工確認結果後再處理該事件。unknown 也不是允許自動重送的指示。
Redis 的 audit-events 保留事件副本；audit-pending 記錄待補寫 ID。需監控待補寫數、服務錯誤、容量及留存期限；只清理已核對完成的歷史事件，絕不清除待處理事件或 lock。不要把 Redis 原始匯出放進 Git。

## 保留鎖的復原

鎖鍵命名為 mmm:{Google Sheet ID 的 SHA-256 前 24 字元}:orders-lock，值為隨機擁有者 Token。沒有 TTL，也沒有自動搶鎖，這是避免舊 Sheets 請求尚未完成就開始新作業。

1. 進入維護時段，停止所有環境的寫入；確認持鎖的 Vercel invocation、網路重試及 Google API 作業已結束。不得只因等了一分鐘就刪鎖。
2. 先備份並核對 Orders 與 Redis 待處理事件。確認該次操作完成、失敗或需人工修復，不要重送未知結果的新增單。
3. 僅在確認無任何舊寫入後，由受權管理者在 Redis 主控台核對並以 compare-and-delete（EVAL 比對目前擁有者再 DEL）移除該鎖；不要 FLUSHDB，不要設定自動過期。
4. 補寫／整理事件，測試一筆受控資料再恢復服務。若無法證明舊請求已結束，維持鎖定並交由維運處理。

## 安全邊界與限制

鎖只協調使用同一 Redis、同一 Sheet 命名空間的新版本程式。直接編輯／排序／刪列 Google Sheet、其他工具、舊版部署都不受保護；必須限制直接寫入並配合維護時段。Redis 的資料遺失、擁有者外部刪鎖或錯誤 eviction 也會破壞假設。
修改訂單的刪舊列＋新增列已合併成單次 Sheets batchUpdate，失敗不應只剩刪除。鎖不等於 Sheets 與 Redis、TG、Audit_Logs 的跨服務交易，也未加入業務請求自動重試或完整冪等鍵；網路不確定結果須先查單再處理。
四位隨機單號、Sheets 全表讀取性能、Google Sheet ACL、Google OAuth／Sentry／TG 正式收件仍按原限制或需另驗收。不能只靠本機模擬測試宣稱正式服務已通過。

## 來源

https://upstash.com/docs/redis/features/restapi
https://redis.io/docs/latest/commands/set/

供應商一致性限制：Upstash 官方說明採非同步複寫與 eventual consistency，故障切換、split-brain 或資料遺失時不能宣稱嚴格互斥。程式以 SET NX／EVAL 執行正常情況下的原子協調，待補寫讀取在同一個帶寫入的 EVAL 中完成以避免分離讀取延遲；不把這當成跨 Sheets 的 fencing 或交易保證。若發生供應商故障，停止寫入並人工核對，不自動清鎖或重送；要求故障期間仍保證線性化交易時，須將業務資料遷移至交易資料庫或單一可信寫入服務。來源：https://upstash.com/docs/redis/features/consistency
