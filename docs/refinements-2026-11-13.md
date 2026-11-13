# 六項調整與資料庫分頁盤點（2026-11-13）

## 搜尋與篩選

工班需求、案件管理、需求分析共用 `SearchFilterBar`。漏斗圖示位於搜尋輸入框內最右端，44px 觸控範圍，以「進階篩選」提供無障礙名稱與 tooltip。按下才展開日期、狀態、排序等原有條件；有條件時顯示小圓點，Escape 關閉後回到圖示。搜尋框下方不再常態顯示獨立篩選入口。

## Nickname 與人員識別

- `Users.Nickname` 作為帳號顯示名稱；不再用 Email 補入缺少的暱稱。未設定暱稱時，寫入會明確拒絕並提示設定。
- 新增 Orders 的 `Req_User` 與管理員寫入的 `Admin_User` 使用經伺服器驗證之帳號的 Nickname，不接受前端指定名字。
- 修改既有需求時，僅將本張需求可精確對應 Users.Email 的舊人員值改為 Nickname。既有原始材料、永久材料 ID、單號不變。
- 讀取 API 將可對應 Users 的舊 Email 顯示為 Nickname，包含公開處理紀錄；找不到對應者保留原值，不猜測人員、不寫回資料庫。
- 身分驗證、確認簽章、安全稽核與 Order_History 原始 actor 仍使用 Email。Telegram 優先以建立事件的 Email 尋找收件者；無歷程的舊單才使用 Email 或同工班唯一暱稱，同名多人不任意選人。建立者已移除時不依同名改寄他人。

這次未對正式資料庫執行整批姓名回填。

## 需求進度

正式需求顯示「待審核 → 審核完畢 → 準備出貨 → 已送達」。目前沒有獨立的「審核中」狀態。「審核完畢」表示完成材料核對，與出貨安排分開。四階段改為較大的名稱、目前／已完成／尚未到此階段提示；桌機四欄、手機兩欄，沿用白色工作面與操作藍。退回顯示額外的「退回待修改」提示與原有退回原因。

詳情的基本資料與備註字級增大，沒有新增或更改資料庫狀態值。

## 公告

參照 [GitHub 的公告元件](https://github.com/MMMthreeM/MMM/blob/main/components/NoticeBanner.tsx)：暖黃橫帶、圓點逐則列示、完整文字自然換行、右側關閉。取消預覽截斷與展開／收合按鈕。沿用本機每帳號及公告內容的關閉記憶，也保留頁尾重新查看入口。填單中預設隱藏公告的既有行為保留。

## 資料庫七個分頁

已透過連接器唯讀核對 [目前資料庫](https://docs.google.com/spreadsheets/d/17yz5HDSdkSsVpCmTmbG6c2aaPLga43H0pbhY3WT_XzM/edit) 的分頁與表頭，並比對目前程式呼叫。未刪除、重命名或修改任何正式分頁。

| 分頁 | 目前用途 | 程式依據 |
| --- | --- | --- |
| Orders | 草稿與正式需求的目前內容、工班、狀態、廠商、交期 | `single-sheet-store.server.ts`、訂單 API |
| Draft_Item_State | 所有需求材料的原始內容、目前指紋與核對狀態；不是只存草稿 | `encodeSheetDatabase`／`decodeSheetDatabase`，讀取正式需求也必須有對應列 |
| Order_History | 建立、修改、退回、審核、出貨、送達事件；原作業查核、原始匯入、已移除 ID 與收據 | `single-sheet-store.server.ts`、`single-sheet-mutations.server.ts`、`api/orders/operations` |
| Users | 登入白名單、角色、工班、地區、Nickname 與 Telegram 收件設定 | `access.ts`、登入路由、通知模組 |
| Materials | 選料、數量及必要備註驗證、廠商對應、匯出報表與單價 | `single-sheet-catalog.server.ts`、`material-catalog.ts`、匯出 API |
| Audit_Logs | 安全操作稽核結果與補寫；與使用者看到的業務處理歷程用途不同 | `mutation-security.ts`、`audit-delivery.ts`、管理員補寫入口 |
| System_Notices | 讀取啟用的公告內容 | `api/notices` |

結論：七個分頁都有現行用途，沒有可直接刪除的停用分頁。最容易誤會的是 `Draft_Item_State` 命名；若要改成 `Order_Item_State`，須同步更新固定儲存契約與部署，不能只在 Sheets 改名。

有些「欄位」目前是預留而不是啟用功能。`Draft_Item_State` 的 `Marker_JSON`、`Catalog_Basis`、`Confirmation_Data`、`Pending_Reasons` 在目前單一 Sheets writer 留空；目前核對狀態存於 `Source_State_JSON`，原始材料存於 `Original_Data`。刪除預留欄位也需要同步改版，否則固定表頭驗證會拒絕讀寫。

## 短單號

新增需求與新草稿恢復 `ORD-YYYYMMDD-NNNN`，例如 `ORD-20261113-9668`，日期取台灣時間。隨機起點遇到撞號時尋找下一個可用四位數，並排除現存需求及歷史中已刪除的單號；全部用完會拒絕寫入，不回退成 UUID。

既有 UUID 單號不批次改名，以保留歷程、退回、收據及永久參照。材料 Line_ID、事件 ID、查核 ID 繼續使用原本的唯一 ID。

## 驗證與範圍

- `npm test`：75 項通過，新增短單號、現存／已刪除撞號、四位數用完、Nickname 儲存、原始稽核 Email 保留、舊資料顯示、收件者同名與 Company 隔離測試。
- TypeScript、ESLint 與無正式憑證且禁止對外網路的正式版編譯通過（26 頁產生）。
- `tests/ui-smoke.cjs`：雙角色 320／390／768／1440px、45 張畫面，無水平溢出或客戶端例外；核對圖示位於輸入框內最右側、展開篩選與 Escape 焦點還原、條件保留與小圓點、四階段名稱與目前階段、完整公告關閉／跨頁記憶／重新查看。既有填單及 100 筆材料回歸通過。
- 瀏覽器全部業務 API 採合成資料攔截，未連正式 Telegram 或執行正式資料庫寫入。測試自行啟動的伺服器已關閉。
- Next.js 回饋檢視：未保留符合條件的產品問題。

預覽：[手機篩選與公告](refinements-filter-mobile-2026-11-13.png)、[手機需求進度](refinements-detail-mobile-2026-11-13.png)。原始測試幾何與畫面位於 git 忽略的 `.tools/refinements-2026-11-13`。

本機修改，尚未 commit、push 或部署。
