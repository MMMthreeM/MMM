# 單一 Google Sheets：部署與復原

目前程式只使用固定 Schema 3 新庫；PostgreSQL、獨立 Head、Genesis、MMM_V2_* 啟用開關與舊佈建腳本已移除。API contractVersion: 2 繼續作為現行傳輸契約，沒有儲存版本相容分支。

## 部署設定

使用 README 的 Google、NextAuth、Redis、確認簽章與通知設定。GOOGLE_SHEET_ID 指向已搬移的新庫；服務帳號必須有編輯權限。確認金鑰至少 32 bytes。主機要部署這份程式後再切換，不能只把舊程式接到新庫。

Users 決定角色及 Company；User 只能操作同 Company 的需求，Admin 仍受狀態與材料規則約束。單一 Sheets 固定表頭見 sheet-headers.md；業務流程不補建表頭、不猜測版本、不自動搬移。

## 寫入保護

Origin／JSON／容量檢查 → 登入與 Company 權限 → 限流 → Redis 擁有者鎖 → 持久稽核意圖 → 新庫／材料庫完整觀測 → 權限、指紋及精確數量驗證 → 再讀比對與鎖擁有者核對 → 單次 Sheets batch → 寫後讀回 → 回執與稽核。

材料正式確認使用與帳號、Company、需求、內容、操作綁定的短效簽章。草稿可暫存未符合最低量的正整數，正式送出仍須符合目前材料庫。表單勾選及唯讀畫面不是後端授權。

讀取或準備失敗時不寫入；送出後 ACK 遺失或讀回不符時回結果待核實、保留鎖、不重送。作業查詢只查同批保存的回執，不會自動解除鎖或開始另一筆寫入。稽核補送不重送業務需求。

## 保留鎖的復原

鎖鍵為 mmm:{Google Sheet ID 的 SHA-256 前 24 字元}:orders-lock，值為隨機擁有者 Token；沒有 TTL 或自動搶鎖。

1. 停止所有環境的寫入，確認原 invocation 及 Sheets 請求已結束。
2. 核對原作業回執、Orders、Draft_Item_State、Order_History 與 Redis 待處理稽核。不要重送未知結果的新單。
3. 只有能證明原作業已結束及資料結果時，由維運者以比對擁有者再刪除的 EVAL 解除該鎖；不可 FLUSHDB 或隨時間自動解除。
4. 補齊稽核，受控驗證後恢復寫入。

## 已驗證與界線

2026-11-12 已用實際服務帳號，在新庫建立、修改、刪除明確標記的維護草稿，通過 Sheets 寫後讀回、真實 Redis 鎖／擁有者解除、稽核落盤。原有 62 張需求與 356 筆材料逐格不變；新增 3 筆維護歷程並保留對應稽核。沒有推進真實出貨狀態或發 Telegram。

程式仍以 Sheets 全表觀測；資料規模增加時需實測效能。Redis 鎖只協調使用同一 Redis 及 Sheet 的程式寫入；直接操作 Sheet、舊部署及其他工具不受鎖保護。Sheets、Redis、稽核與通知不是跨服務交易。Redis 複寫、故障切換或外部刪鎖也不能由這份程式保證嚴格互斥。

正式網站尚未部署；真人 OAuth 登入與正式 Telegram 收件尚未驗證。本機合成瀏覽器及隔離編譯不能冒充這兩項驗收。完整證據見 [本輪完成紀錄](single-sheet-ui-cleanup-2026-11-12.md)。

T07～T10 的 PostgreSQL／H2 文件保留作歷史紀錄；其指令與 No-Go 結論不適用於目前架構。
