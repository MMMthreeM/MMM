# T09 UI/UX 36 階段實作與驗收

來源：`整理案件階段用途1-36.pdf`，實際 152 頁。已逐頁閱讀原稿；頁首 `/610` 是原對話輸出標記，不是本附件頁數。採最後使用者選擇，不把助手提案視為核准。以下為修改前盤點；最終驗收結果記於文末。

## 決策／程式／差距／驗收矩陣

|階段（PDF 頁）|最後決策|實際呼叫位置|修改前現況與必要修改|驗收條件|最終狀態|
|---|---|---|---|---|---|
|1（12–16）|任務首頁、最近 3 張正式需求|app/page、CrewOverview|未完成；工班仍用 AnalyticsDashboard|建立為主、退回優先、草稿次要，最近單不含草稿|已實作；本機 Mock 驗收|
|2（16–19）|工班共享需求、三分類|dashboard、CrewOrders|部分；出貨與送達混類|準備出貨仍進行中；已送達獨立|已實作；本機 Mock 驗收|
|3（19–22）|精簡卡片、預覽 2 筆|CrewOrders|未完成；全材料直接展開|100 筆單卡片只預覽 2 筆加剩餘數|已實作；本機 Mock 驗收|
|4（22–26）|桌機側詳情、手機獨立頁|CrewOrders、dashboard/detail|未完成；需路由及容器斷點|桌機不遮列表；窄畫面全頁|已實作；本機 Mock 驗收|
|5（26–30）|左右分割、四里程碑及精確狀態|OrderDetail|未完成|退回原因醒目、完整材料、無虛假進度百分比|已實作；本機 Mock 驗收|
|6（30–34）|完整共用編輯，修改與再訂分開|OrderForm、order-form-state|部分|修改原單，再訂新單；只顯示合法動作|已實作；本機 Mock 驗收|
|7（34–37）|共用表單、依模式配置|OrderForm|已有核心；修改應先看清單|六模式標題、按鈕與來源明確|已實作；本機 Mock 驗收|
|8（37–40）|數量備註就地編輯|OrderMaterialLine|部分；所有欄位總是展開|穩定 key、行內輸入、單欄手機|已實作；本機 Mock 驗收|
|9（40–44）|智慧備註、三方式共用清單|OrderMaterialLine、MaterialPicker、TextOrderImport|部分|無備註可新增、必填展開、文字人工核對|已實作；本機 Mock 驗收|
|10（44–48）|獨立唯讀最後確認|OrderForm|部分；仍呈現編輯欄位|完整唯讀、返回定位、禁止未確認送出|已實作；本機 Mock 驗收|
|11（48–53）|正式成功頁、一般更新回原單|OrderForm、order-navigation|部分；返回無脈絡|confirmed 才導覽；一般更新保留來源|已實作；本機 Mock 驗收|
|12（54–57）|準備出貨進行中、智慧搜尋|CrewOrders|未完成|一欄搜單號日期材料，整單結果|已實作；本機 Mock 驗收|
|13（57–61）|搜尋日期保留、專屬條件重設|CrewOrders|未完成；切換清空|條件標籤、頁碼重設、排序合法|已實作；本機 Mock 驗收|
|14（61–65）|共享草稿、刪除次要、再訂預填|OrderDetail、OrderForm|部分|整單只確認一次、原備註預填提醒|已實作；本機 Mock 驗收|
|15（65–68）|再訂保留備註及剩餘事項盤點|OrderForm|部分|原備註不丟、需確認本次用途|已實作；本機 Mock 驗收|
|16（68–72）|移除審核中、不加編輯鎖|AppShell、CrewOverview|後端已 v2；前端資訊架構待補|不恢復舊狀態；安全協調維持|已實作；本機 Mock 驗收|
|17（72–76）|手機三入口、編輯確認隱藏|AppShell|未完成|首頁／建立／工班需求；不遮編輯|已實作；Safari／真機鍵盤未驗證|
|18（76–79）|首次存草稿留頁更新同單|OrderForm|核心已有|首次有單號、再存不另建；原文留頁|已實作；本機 Mock 驗收|
|19（79–82）|單一公告、不新增分級|NoticeBanner|部分；全部展開|精簡、展開、逐則關閉、無新 Schema|已實作；本機 Mock 驗收|
|20（82–85）|無待辦短提示、首次引導|CrewOverview|未完成|載入失敗不當零筆、已送達仍可最近顯示|已實作；本機 Mock 驗收|
|21（85–88）|同裝置按帳號記公告關閉|NoticeBanner|未完成|跨頁持續、內容變更重現、可重看|已實作；本機 Mock 驗收|
|22（88–91）|取消回來源；整單／單筆區分|NavigationGuard、OrderDetail|部分|真變更才警告、單筆移除可撤銷|已實作；本機 Mock 驗收|
|23（91–95）|重複提醒、允許分筆、明確合併|OrderForm、order-form-state|部分；無合併預覽|顯示來源結果、確認才套用、可撤銷|已實作；本機 Mock 驗收|
|24（95–99）|100 筆連續清單及問題定位|OrderForm、OrderMaterialLine|未完成工具|搜尋不改集合、原始序號、錯誤定位|已實作；Safari／真機鍵盤未驗證|
|25（99–102）|再訂未匹配保留待處理|order-form-state、OrderForm|部分|不默轉自填、不丟材料、未處理不送出|已實作；本機 Mock 驗收|
|26（103–106）|同 ID 名稱差異人工確認|OrderMaterialLine|未完成|新舊名稱可比、不自動猜規格等價|已實作；本機 Mock 驗收|
|27（106–109）|廠商確認、單位重填、合法數量沿用|OrderMaterialLine|未完成|不換算單位、不擅自調量、變更使確認失效|已實作；本機 Mock 驗收|
|28（109–113）|有限度寬鬆草稿|OrderForm＋既有 Writer|已有後端分流|草稿基本格式嚴格、正式完整驗證|已實作；本機 Mock 驗收|
|29（114–118）|未確認原文不存、材料可存|OrderForm、TextOrderImport|部分；目前原文一律阻擋|提示後只存清單、原文字仍留頁|已實作；本機 Mock 驗收|
|30（118–121）|草稿只正整數，輸入可暫空|OrderMaterialLine、OrderForm|部分；Number 空白成零|暫空不補值、儲存定位錯誤|已實作；本機 Mock 驗收|
|31（121–125）|退回優先、10 張、草稿名 100 字|CrewOrders、OrderForm|部分|名稱必填可同名、同單更新、分頁恢復|已實作；本機 Mock 驗收|
|32（125–130）|例外分類、RWD、UNKNOWN 查核|useOrders、OrderForm、CrewOrders|部分|錯誤／空／舊資料區分、無假成功|已實作；Safari／真機鍵盤未驗證|
|33（130–134）|UNKNOWN 不重送；獨立補充表|OrderForm＋既有 B1|核心已完成；UI 補強|保留表單與原 Attempt；不加 client 冪等|已實作；Safari／真機鍵盤未驗證|
|34（134–139）|獨立 B1，Orders＋Line_ID|既有純核心／Writer；UI 僅消費投影|v2 已完成；舊相容段已取代|不改 Schema、不回填、不把 UI 確認當可信證據|既有 v2 已完成；舊相容段已取代|
|35（139–144）|穩定 ID、內容核對、跨表一致|既有 T02–T08|已完成；沿用測試|合併採新 ID；舊「保留來源 ID」建議已取代|既有核心沿用；合併保留來源 ID 建議已取代|
|36（144–152）|最終規格；舊全量遷移|全站 UI；後端凍結|UI 待整合；遷移已由乾淨 v2 取代|不實作 migration／adoption／雙軌|UI 已整合；全量遷移已取代，不執行|

## 修改範圍

實際引用鏈：`layout → AppShell/NoticeBanner → page/CrewOverview、dashboard/CrewOrders、dashboard/detail/OrderDetail、request/OrderForm`；`admin → AdminReviewWorkbench → AdminOrderEditor → OrderForm`。只修改上述 UI、前端純呈現 helper、CSS、Browser／前端測試與本驗收文件。T02、mcf、ChangeSet、B1、H2、R2、Writer、Authority、安全協調與正式 API 路由不修改。`lib/order-sheet.ts` 只補公開材料 Original 與退回歷史呈現欄位，不改捕獲、驗證、授權、Digest 或寫入；`lib/order-view.ts` 補對應 DTO 型別。

## Direction contract

THESIS：工班現場叫料與追蹤以「下一步工作」為中心；首頁不再承擔分析儀表板，列表不再展開每張單的全部材料。

OWN-WORLD：延續白底、冷灰畫布、藍色操作與綠色完成；使用現有中文字型堆疊、12px 圓角、細分隔線與實際狀態文字。保留既有元件，不引入 UI Framework 或外部素材。

STORY：先建立需求或處理退回，再查閱進度；以共用編輯器整理材料，唯讀確認後提交；結果未知保留原表單並查核。

FIRST VIEWPORT：工班首頁以一個建立按鈕為主，退回／共享草稿提醒在後，進度與最近 3 張不搶主要操作。桌機列表可與詳情並列，手機獨立詳情。

FORM：既有 Operate 介面的延伸，使用者已固定布局與行為，未執行新概念競選。seed: none (unavailable)。

FINISH：unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## 已取代與限制

- 舊全量遷移、adoption、v1 雙軌，以及助手早期提出的多人版本鎖、公告分級均不實作。
- 合併由受控 preview＋既有 T05 處理；來源永久 ID 退役、結果新 ID。UI 不自行計算數量或授權寫入。
- 500 字備註與 100 筆材料沿用既有安全容量政策。T08 後端 100 筆重送約 81 秒另行追蹤；本輪不跳過 Witness。
- 正式服務、憑證、Genesis、Schema、部署均不在本輪範圍。Safari／真機鍵盤若無設備則標示未驗證。

## 實際功能與資料邊界

1. 工班首頁改為任務導向，唯一主要建立操作、退回優先、共享草稿次要、最近 3 張正式需求及精簡進度。統計仍在 `/analytics`，不改統計範圍。
2. 工班需求使用三分類、單一智慧搜尋、日期條件及可移除標籤、10 張分頁。網址保留條件與頁碼；sessionStorage 只存列表位置／焦點。桌機選中詳情時定位所在分頁，窄螢幕開獨立詳情路由。
3. 詳情有精確狀態及四里程碑、完整材料、有效原因、材料定位、歷史與合法操作。唯讀／舊資料明確說明；整單刪除只確認一次，確認回應後才移除畫面。
4. 六種共用模式：new-formal、new-draft、edit-draft、edit-pending、edit-returned（內部既有 `resubmit`）、reorder。草稿名稱 1–100 字；輸入允許暫空，草稿儲存要求正整數。正式數量／級距仍由已凍結精確伺服器驗證，不在 UI 複製 T05 算法。
5. 材料採穩定 key、逐列 memo、行內輸入、智慧備註、必要時展開選料、清單搜尋／問題摘要及原序號定位。搜尋不刪除隱藏列。移除、合併只改前端，儲存前可撤銷；合併先顯示受控 preview 的來源與結果，不自行加總數量。
6. 再訂一次使用新 clientKey，保留備註及原數量；原欄位在接受差異前不被現行材料默默覆寫。單位改變須另填新數量，不換算。未匹配不轉自填；要明確選擇。重開草稿重新比對目前材料庫。
7. 最後確認為獨立唯讀步驟，返回修改保留內容並可定位。草稿轉正式仍先保存、核對讀回，再執行純 DRAFT_SUBMITTED，不夾帶未保存 ChangeSet。
8. 原始文字不會進入草稿：有原文時先提示，只保存已加入清單的材料，原文留在當頁。編輯器在保存期間維持 TextOrderImport 掛載，避免忙碌狀態清空原文。
9. 只有完整 confirmed receipt 才顯示成功。UNKNOWN／acknowledged-unverified 保留表單、確認與原 Attempt 查詢，不重送、不重新配 ID。草稿已成功但讀回失敗也凍結重建入口，避免重複建立。
10. 管理員的查找／選取、案件處理與採購工具分層；未展開案件只顯示摘要。多單逐張顯示 confirmed／拒絕／待核實；遇 UNKNOWN 停止後續單據。匯出／詢價不推進狀態。
11. 公告沿用單一 System_Notices，預設精簡、展開／收合／逐則關閉；以帳號與精確內容的 SHA-256 作裝置偏好鍵，不保存公告全文或安全資格。內容變更重新顯示，可從輔助工具重看。
12. 唯讀投影只從已驗證 B1/H2 產生：Original 僅七個 typed material values；歷史指定原因與名稱同時以永久 Line_ID＋退回當時 mcf 綁定，包含材料修改事件。沒有增加新的信任來源、業務欄位或私有證據回傳。

## 驗收與審查

|項目|結果與界線|
|---|---|
|原有 Runtime 基準|490/490 PASS；無刪除、skip 或放寬原安全斷言|
|新增前端純測試|28/28 PASS|
|新增公開投影整合測試|2/2 PASS；Original 七欄、Company 隔離、GET 零寫入、不可變歷史個別原因／mcf|
|最終整包 Runtime|520/520 PASS；FAIL 0、skip 0；原有 490 加 30 個新案例|
|Browser Mock|68/68 PASS，保留原有 21 項安全目的；新增實際點擊、編輯、篩選、返回、撤銷、差異確認、唯讀、草稿已確認但回讀失敗時保留原 Attempt，以及 UNKNOWN 驗收|
|RWD|Chrome 320／360／390／430／768／1024／1440；首頁、列表、詳情、編輯及管理頁皆有實際穩定畫面與橫向溢出檢查|
|互動幾何|頁首品牌與選單不碰撞、選單文字單行、核心按鈕／操作列／確認選項觸控高度至少 44px|
|TypeScript|noEmit、incremental=false PASS|
|ESLint|指定本輪來源與測試、no-cache、max-warnings=0 PASS|
|隔離 Production Build|PASS，26/26；副本無 dotenv／正式憑證，外網及非 Node 子程序封鎖，不初始化正式服務|
|Git diff|PASS；不 commit、不 push、不部署|
|獨立介面審查|四項有限修正全數 resolved；最終 bounded disposition：Ship。不是未檢視畫面的全站無缺陷保證|
|Safari、真機 Android/iPhone、OS 虛擬鍵盤|NOT RUN；Chrome 行動視窗及 focus／Back／安全區 CSS 不冒充真機驗收|
|正式 Sheets／PostgreSQL／Redis／Telegram／OAuth|NOT RUN；未讀寫、未使用正式憑證，正式資料現況 UNKNOWN|

Browser 不再在 loading shell 上宣告 RWD PASS：先等待路由對應的材料／列表／詳情及兩次 animation frame，再檢查並截圖。窄版列表與詳情分別擷取；390px 唯讀截圖明確設定實際 viewport，沒有把桌機截圖冒稱手機。

### 100 筆前端效能

最新單次 Chrome 390px 合成觀測：數量編輯約 28.7 ms，搜尋約 45.3 ms，定位約 59.4 ms；該次可用的 JS heap 指標約 163.1 MiB（前一輪約 70.5 MiB，受累積測試與 GC 影響，未宣稱為峰值或穩定記憶體預算）。全部 100 列留在編輯集合，輸入與搜尋 API 呼叫 0、業務 dispatch 0。這是本機端到端控制耗時，包含 Playwright／瀏覽器排程，非正式效能 SLA；最終精確 JSON 與長名稱／長備註畫面位於驗收 artifacts。

T08 的 100 筆完整退回重送約 81 秒後端合成效能風險維持獨立追蹤；本輪沒有藉由跳過 Witness、B1/H2/R2 或拆業務寫入改善數字。

### 剩餘限制與正式啟用

- 正式基礎設施、受管理 Genesis、權限／TLS／備份／故障恢復與真實外部服務驗收仍須另行授權；本機成功不表示正式系統已啟用。
- 前端能定位基本格式、最低量、來源、備註與確認問題。完整精確級距／受控確認仍由伺服器拒絕不合法提交；目前 API 未提供逐列精確業務錯誤索引時保留整單提示，不自行重寫 T05 算法。
- B1 的公開 Original 明確稱為首次保存資料；不把可變目前材料或推測的舊名稱當成不可變的複製當下證據。
- 本機公告偏好不跨裝置同步；同文公告視為同一內容，微小文字更新會重新顯示。這不是閱讀證明或權限。
- 原 PRODUCT.md 的「審核中」及舊容量等敘述存在先前文件漂移；本輪不改 PRODUCT、README 或 AGENTS，採最新凍結 v2 與本任務指令。

## 操作證據與指令

驗收 artifacts 位於 `C:/Users/im0pl/AppData/Local/Temp/mmm-t09-5b6a7b3d652e4d5da7e4d8f0a5e6d5c2/`。全部訂單、帳號及 API 都是合成 Mock，截圖不是正式網站或示意設計圖。

- `ui/results.json`：68 個 Browser checkpoints。
- `ui/editor-performance.json`：100 筆輸入／搜尋／定位／heap。
- `ui/t09-home-390.png`、`ui/t09-list-1440.png`：工班工作入口與桌機分割。
- `ui/t09-detail-390.png`、`ui/t09-readonly-detail-390.png`：獨立詳情與唯讀說明。
- `ui/t09-reopened-comparison.png`、`ui/t09-historical-targets.png`：重開差異及不可變指定原因。
- `ui/t09-editor-390.png`、`ui/t09-100-continuous-390.png`、`ui/unknown-mobile.png`：長清單、實際定位與 UNKNOWN 保留。
- `runtime-acceptance.log`、`build-acceptance.log`、`build-isolation.jsonl`：回歸及隔離建置紀錄。

```text
node --test --test-isolation=none --test-reporter=spec tests/order-workflow.test.cjs tests/order-v2-integration.test.cjs tests/order-ui.test.cjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js --no-cache --max-warnings 0 <本輪 ts/tsx/cjs 檔案>
git -c core.safecrlf=false diff --check
```

Browser 與 Build 只在隔離副本執行，dotenv 被禁用，正式環境變數不傳入子程序；不在原工作樹建立 `.next`、Build cache 或截圖產物。

## 本輪檔案清單

|檔案|實際用途|
|---|---|
|`.impeccable/design.json`|既有 token 與元件預覽 metadata；不接入 runtime|
|`DESIGN.md`|實際視覺 token、布局與交互規範|
|`app/dashboard/detail/page.tsx`|手機／窄螢幕獨立詳情路由|
|`app/dashboard/page.tsx`|工班列表薄路由，使用共用 CrewOrders|
|`app/globals.css`|RWD、分割詳情、材料列、底部操作與 320px 頁首|
|`app/page.tsx`|工班首頁改接任務導向 CrewOverview|
|`app/request/page.tsx`|依情境標題、麵包屑及共用表單|
|`components/AdminOrderEditor.tsx`|共用未儲存保護；無變更不多問|
|`components/AdminOverview.tsx`|待辦與例外；手機卡列與錯誤不當空資料|
|`components/AdminReviewWorkbench.tsx`|案件展開、次要採購工具、逐單結果及 UNKNOWN 停批|
|`components/AnalyticsDashboard.tsx`|首次讀取失敗不顯示假零件數；統計範圍不變|
|`components/AppShell.tsx`|角色導覽、三入口手機導航、次要系統工具|
|`components/CrewOrders.tsx`|智慧搜尋、分類、URL 分頁／條件、桌機分割／手機詳情|
|`components/CrewOverview.tsx`|建立、退回、草稿、進度與最近 3 張|
|`components/FilterPanel.tsx`|可選預設收合，不改其他使用者預設|
|`components/NavigationGuard.tsx`|保留既有保護，補受支援 Navigation API 的 Back/Forward|
|`components/NoticeBanner.tsx`|精簡公告、逐則關閉、帳號／裝置偏好與更新重現|
|`components/OrderDetail.tsx`|完整材料／歷史、退回定位、唯讀說明與安全整單刪除|
|`components/OrderForm.tsx`|六模式、獨立確認、合併預覽、草稿／原文／UNKNOWN 保護|
|`components/OrderHistoryPanel.tsx`|歷史逐項原因、處置與可展開追溯參照|
|`components/OrderMaterialLine.tsx`|memo 行內編輯、智慧備註、材料差異與逐列問題|
|`docs/t09-sha256.json`|完整非忽略檔案 before／after 與差異清冊（排除自身）|
|`docs/t09-uiux-36.md`|完整 36 決策、驗收及限制|
|`lib/order-form-state.ts`|純前端比較／意圖，不改 ChangeSet 或數量算法|
|`lib/order-navigation.ts`|安全返回網址、整單智慧搜尋、排序、位置與 UI 通知|
|`lib/order-sheet.ts`|僅公開已驗證七欄 Original 及退回時間 mcf 綁定的歷史呈現|
|`lib/order-view.ts`|只擴充公開 Original／歷史目標 DTO|
|`tests/order-ui.test.cjs`|28 項純前端合成測試|
|`tests/order-v2-integration.test.cjs`|只追加 2 項公開投影／Company／歷史不可變回歸|
|`tests/order-workflow.test.cjs`|僅新增 OrderMaterialLine 的 type-only 核心引用白名單|
|`tests/ui-smoke.cjs`|保留原安全流程，擴充至 68 項互動／RWD／效能證據|

沒有本輪刪除的檔案。HEAD 維持 `35a38fc9b56f3345e0fd2eaf433a399fa7b7720b`；工作樹仍保有先前 T02～T08 大量修改及未追蹤成果，不宣稱 clean。

完整 SHA-256 baseline 在任何本輪來源修改前記錄，共 156 個非忽略實體檔案。最終差異與 after 清冊見 `docs/t09-sha256.json`；清冊排除自身以避免自參照 hash。18 個凍結核心／安全模組、18 個 API 路由，以及 AGENTS、README、package、lockfile、tsconfig 全部以本輪起點 hash 核對不變。`lib/order-sheet.ts` 的公開呈現投影屬本輪有意變更，已獨立列明，沒有把它冒稱為原封不動。


隔離 Build 的累計圍欄紀錄顯示外網 socket、敏感設定檔讀取與 shell 子程序曾被攔截；沒有放寬圍欄以換取 Build PASS，也沒有成功的正式服務連線。完整紀錄位於 `build-isolation.jsonl`。
