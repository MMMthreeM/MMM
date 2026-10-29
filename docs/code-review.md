# 程式檢視與清理（2026-10-29）

## 範圍與結論

盤點 app、components、lib、scripts、tests 的來源與引用關係，檢查角色導覽、材料表單、共享草稿、整單分組、篩選、統計、匯出、推播與文件的一致性。這不是外部資安滲透測試，也不承諾不存在其他問題。

## 已移除

- lib/state-machine.ts：無程式或測試引用；舊英文字狀態機允許的收回／倒退規則與目前業務不同。保留實際使用的 lib/order-domain.ts 與 lib/order-view.ts 為依據。
- public/file.svg、globe.svg、next.svg、vercel.svg、window.svg：未引用的 Next.js 起始圖示。
- 未使用的 drill-order、trend-row 舊展示樣式。

## 保留與用途

- app/admin/orders/route.ts：舊管理 API 網址相容入口，轉用受管理員權限保護的目前 API；不是多餘頁面。
- app/api/test-sheets/route.ts：管理員連線檢查，驗證 Users 來源，不公開表格資料。
- scripts/：手動檢查 XLS、擷取樣式、產製報表範本工具；不因未被 UI import 就刪除。重建須準備原始來源與工具環境。
- assets/report-templates/：正式報表必要範本與對應資料。
- instrumentation、Sentry 設定、global-error、manifest、圖示與設定檔：框架／監控／安裝入口，不依一般 import 決定是否未使用。
- API 舊 deleteType=single 相容路徑與批次狀態介面保留，不任意改 API 契約。
- AGENTS.md 保留 Next.js 自動產生的代理規則，不作為業務文件改寫。

## 程式分工

AppShell：登入、角色導覽、工班／管理分區。OrderForm／MaterialPicker／SearchSelect：兩步驟下單與材料搜尋。NavigationGuard：未儲存離開確認。
AnalyticsDashboard：資料篩選與下探；MaterialTrend：月份圖表；AnalyticsOrders：單月與期間共用整單展示。名稱與數量用冒號相接，避免跨欄誤讀。返回列採正常文件流，不覆蓋圖表。
order-domain：後端狀態與材料驗證；order-view：分組、顯示狀態、日期搜尋與統計；order-sheet：表格欄位讀取／版本識別；order-actions：批次變更；vendor-report：範本報表。

## 保留限制

四位隨機單號、Sheets 全表讀寫／刪列未改造；新增 Redis 共用寫入鎖（須完成設定）；仍無跨服務原子性。TG 個人進度通知仍是原申請帳號，不會自動通知全工班。manifest 不含 Web Push／離線資料同步。正式服務權限、範本與實際通知須人工驗收。

安全修補更新（2026-10-30）：材料驗證／匯出採一致正規化並重查數量；自訂寫入 API 驗證 Origin、JSON 類型及 128 KiB 上限；Redis 共用帳號限流、非自動過期的全表寫入鎖及先存意圖的稽核補寫。修改單據刪舊與新增改為單次 Sheets 批次。新增管理員稽核補寫入口，待補寫不重送訂單。必須先配置 UPSTASH_REDIS_REST_URL／UPSTASH_REDIS_REST_TOKEN 與正確 NEXTAUTH_URL，否則拒絕寫入；讀取、部署、舊版切換與手動解鎖限制請完整閱讀 docs/security-deployment.md（docs 內文件參照 security-deployment.md）。目前僅模擬測試，真實 Redis 及正式外部服務待驗收。
