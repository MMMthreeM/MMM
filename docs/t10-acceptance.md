# T10 v2 整合、效能與故障驗收

本輪執行結果以文末最終紀錄為準。HEAD：`35a38fc9b56f3345e0fd2eaf433a399fa7b7720b`。開始時 167 個非忽略實體檔案及全部既有 dirty／untracked 成果已記錄；沒有 reset、clean、commit、push、部署或正式服務操作。完整差異見 `t10-sha256.json`。

## 結論與三批 Gate

|Gate|結果|實際意義|
|---|---|---|
|A：真實環境可信|**BLOCKED**|未提供特定、明確核准的專用 Sheets／PG／Redis／OAuth／最新 Head 資源與安全注入方式；不以 `.env` 或現行部署推定授權|
|A：本機可執行準備|PASS：離線範本／初始化計畫、Adapter／Port 與合成拒絕測試|不是 Schema／Genesis 已建立；metadata validation 永不授予 Dispatch|
|B：真實服務 E2E|**BLOCKED**|Gate A 未通過，沒有向外部服務執行業務寫入|
|B：本機整合／Browser Mock|PASS：559 Runtime、80 Browser|實際應用核心、路由函式、SEC、Provider、Writer 與 UI；只有外部服務與登入為合成 Port|
|C：效能與正式安全|**BLOCKED／No-Go**|本機量測已完成；未有正式 Runtime 預算、獨立最新 Head、實環境 ACL／故障恢復證據|

**最終啟用判斷：No-Go。** 可以繼續本機開發與核准資源的配置；不得據此開啟正式 Writer。沒有另外安排泛用 Preflight，也沒有把 Mock 改稱真實 E2E。

## 本輪完成的工作與修正

1. 重新執行原有 520 Runtime、68 Browser、TypeScript、ESLint、Git diff 與隔離 Build，後續修正再次回歸。
2. 新增 `config/t10-environment.example.json`：只放公開資源識別範本，不含祕密；所有未提供項目明確為 placeholder。
3. 新增 `scripts/t10-environment.cjs`：七表離線初始化 requests、精確業務 schema、公開資源核准 binding、production denylist、三角色分離、TLS 與通知沙箱檢查；無 apply／DDL／Genesis／連線模式。valid metadata 仍為 `METADATA_VALID_ONLY`、`realEnvironment=BLOCKED`、`dispatchPermission=not-granted`。
4. 真實 PostgreSQL Head 在獨立最新 Head Provider／advance protocol 缺失時拒絕，不能由同庫 checkpoint 自證最新；原 Attempt 查詢仍可用。這是實際安全阻擋，不是假裝正式 Provider 已完成。
5. 原始 Sheets adapter 新增不可能實體 Grid 尺寸拒絕；不改三表欄位、Writer 寫入方式或業務語意。
6. H2 只優化深度不可變的 copy／canonical／raw observation digest 重複計算。每次 Witness／Retention／Authorship／B1／R2／postconditions 均保留；沒有改 Digest、wire bytes、ID、Quantity 或容量政策。
7. 新增本機 loopback TCP／HTTP：真實 Request／Response、實際路由函式與完整應用組合；auth、Google、PG、Redis、通知仍為合成。它不是 Next.js 對外 HTTP stack＋OAuth＋實際服務 E2E。
8. 新增故障注入、實際 PG adapter 加密／TLS 參數測試，並用另一個 Node PID 讀回合成密文中的原 wireBody／mapping／owner 摘要。沒有把檔案型合成資料列冒稱為真實 PostgreSQL 復原。
9. 補上 UNKNOWN 刷新後的同帳號／同分頁唯讀恢復，涵蓋工班表單、管理員編輯與管理員逐單批次。只保存顯示欄位與原 Attempt，無 Token／私有證據／可執行 request；已明確拒絕或 confirmed 才清本機紀錄。刷新不恢復剩餘批次，不自動重送或配號。

## A：環境、Schema 與 Genesis

三張業務表沿用程式 `BUSINESS_SCHEMAS`，沒有另造第二份：

- Orders 21：Order_ID、Line_ID、Order_Date、Req_User、Req_Company、Req_Region、Material_ID、Item_Name、Original_Item_Name、Quantity、Unit、Vendor、Remarks、Status、Draft_Name、Admin_User、Expected_Date、Active_Return_Ref、Schema_Version、Namespace_ID、Created_Event_Ref。
- B1 13：Schema_Version、Record_Type、Order_ID、Company、Line_ID、Marker_JSON、Source_State_JSON、Original_Data、Saved_Content_Fingerprint、Catalog_Basis、Confirmation_Data、Pending_Reasons、Updated_At。
- H2 22：Schema_Version、History_Event_ID、History_Record_ID、Operation_Ref、Event_Index、Event_Count、Event_Type、Order_ID、Company、Actor_Ref、Occurred_At、Event_Envelope_JSON、Operation_Envelope_JSON、Chunk_Index、Chunk_Count、Payload_Byte_Length、Payload_Part、Payload_Digest、Part_Digest、Event_Digest、Operation_Digest、Commit_Semantics。

輔助表離線計畫：Users（Email、Role、Company、Region、Name、Telegram_Chat_ID）；Materials（共用表頭名稱、材料／數量政策／報表對應）；Audit_Logs 六欄；System_Notices（Content、Is_Active）。輔助表仍使用現有 named-header 規則。精確陣列與 14 個建表／表頭 requests 可由 `node scripts/t10-environment.cjs --plan` 輸出。只有對獨立全新空白 Spreadsheet 才可另行審核這些固定 sheet IDs；此程式不送出。

|驗證|本輪狀態|原因／證據|
|---|---|---|
|七表離線 schema／request|PASS|三表 21/13/22；R2 不另建表；模板沒有客戶端可覆寫的正式來源證據|
|真實 Sheets 表頭／raw types／ACL|BLOCKED|沒有核准的測試 Spreadsheet／服務帳號，沒有讀取既有資源|
|PG 三表 schema|NOT RUN|離線 `db/order-authority.sql` 保留；PATH 未發現 postgres／psql／docker／podman，沒有可用的核准實體資料庫|
|PG 交易／AES-GCM／AAD／不重播 COMMIT|本機 Adapter 合成驗收|不代表 PG 隔離等級、SQL trigger、GRANT 已在真實 DB 執行|
|PG runtime／owner／維護角色、TLS、PITR|BLOCKED|metadata 只檢查公開設定形狀；真實權限、金鑰備份／還原及握手仍缺|
|Redis owner／SEC|本機實際 adapter＋合成回覆驗收|沒有外部 Redis、跨實例或供應商故障測試|
|OAuth／測試帳號／Company|BLOCKED|沒有獨立 client、測試帳號與授權範圍|
|受管理 Genesis、最新 Head、重複初始化|BLOCKED|沒有完整空表觀測與獨立 latest Head；沒有建立或刪除任何 Genesis|
|正式 Provider|BLOCKED|實際 PG Head Fail-Closed，不允許依 env enabled 放行|

初始化必要前提包括空表 raw observation、Spreadsheet／Namespace binding、獨立 DDL owner、runtime grants、Genesis 核准證據、可信最新 checkpoint，以及 pending／dispatch／verified 不同交易的恢復。不能把 Sheets＋PostgreSQL＋Redis 描述成同一交易，不能因失敗清掉 namespace 重新開始。

## B：業務／API 與 UI 覆蓋

以下「本機」為目前核心／實際路由函式／合成服務／Browser Mock 的覆蓋。**每一列的外部真實 E2E 均為 BLOCKED**，不只看 HTTP 200 或 Toast。

|案例|本機核對內容|
|---|---|
|1 新建正式需求|受控確認、Orders/B1/H2、mapping、原 Attempt、單次寫入及完整讀回|
|2–4 草稿建立／首次／再次保存|同單更新、基本驗證與 UI 留頁；原文不入草稿|
|5 草稿提交|先保存／讀回，再純 DRAFT_SUBMITTED；正式完整驗證|
|6–9 新增／數量／備註／單項刪除|ChangeSet、精確定位、保留 ID／退役、B1 與歷史|
|10 同名不同 ID|保持獨立材料，不按名稱或陣列索引定位|
|11 刪 A 加 C、總數不變|舊 ID 退役、新 ID 配置，不能依筆數沿用|
|12–14 合併／多層／撤銷|T05 精確數量、暫時來源、H2 lineage；未保存撤銷不 Dispatch|
|15 再訂一次|新訂單／新材料身分、不修改已送達來源、重新確認差異|
|16 管理員編輯|整單 expected 集合、保留材料身分、確認與歷史|
|17–19 審核／準備出貨／送達|合法狀態、角色、日期及 confirmed；匯出不推進狀態|
|20–22 整單／指定／取代退回|固定原 targets／mcf／原因；新建／關閉事件互引|
|23–26 修改／刪除／合併後重送、四種 resolution|return-time 與 expected mcf 分離，B1 有效確認，R2 Closure／H2 lineage|
|27 Company 隔離|偽造角色／Company、跨工班資料與 Attempt 都拒絕|
|28 已送達非法修改|零新業務寫入|
|29 未確認正式材料|拒絕正式送出，不放寬草稿／正式邊界|
|30 H2/R2/B1 不一致|原始觀測、缺 Chunk／schema／參照污染拒絕，零新 Attempt／Dispatch|
|31 匯出／詢價|精確內容核對、材料保留、狀態不變|
|32 通知與 confirmed 分離|通知／Audit 失敗仍保留已確認業務，不觸發重送|

UI 保留 T09 的最近 3 張、退回優先、共享草稿、智慧搜尋、三分類、篩選／頁碼／焦點返回、桌機 split／手機詳情、六模式、100 筆連續行內編輯、問題定位、最後確認、合併撤銷及管理員歷史。新增 UNKNOWN 刷新唯讀材料、原 Attempt 查詢、管理員停批、帳號隔離及損壞本機紀錄 Fail-Closed。Chrome 七種寬度；Android 真機、iPhone Safari、實際觸控及 OS 鍵盤 **NOT RUN**。

## C：容量與效能

40 個主容量案例為 short/long × 四流程 × 1/25/50/75/100，另含 unique／500 字／多層合併。成功紀錄只在完整邏輯還原、Digest、B1 確認、R2、單次 Dispatch 及寫後核實斷言後輸出。拒絕案例保留原操作上限，不靠拆批或省略證據過關。

|100 筆 long 流程|Logical Payload bytes|Wire bytes|Chunks|H2 RowData|完整 batch bytes|
|---|---:|---:|---:|---:|---:|
|新建|641312|106615|14|186739|941097|
|合併後新建|635119＋10872|105777＋6197|13＋1|193873|948159|
|草稿提交|904009|118667|15|208365|612295|
|整單退回重送|1142132＋60541|153806＋27634|19＋4|318910|679373|

100 筆各自不同合法 500 字備註：Wire 274342、34 Chunks、H2 RowData 474083、完整 batch 1464241 bytes；本機 confirmed。實體每 Event 524288、每段 8192／最多64、每 Operation RowData 1048576、完整業務 batch 2000000 bytes；四者分別驗證。4 MiB/Event／8 MiB/Operation logical、65536 Nodes、深度48、Envelope16KiB 及 T05 原操作上限不變。

### 獨立子程序量測

每種流程 100 筆 long、5 個 fresh Node 子程序，全部正常執行 Witness；H2 原始碼 SHA-256 為 `26a0de8da725d9baeb7f5e3c7ef9eed6f0b9ce6305b0bf03a624af950621f27e`。P95 採 nearest-rank，因此 n=5 時等於該組最大值；不是足夠的生產尾延遲樣本。宿主有本輪其他驗收負載，數字不是專用雲端機器的 SLO。

|完整流程（含必要前序操作）|P50 秒|P95／最大秒|各子程序最大 RSS 的最大值 MiB|loader 中位 ms|
|---|---:|---:|---:|---:|
|新建|3.329|3.634|309.0|463.8|
|合併後新建|3.506|3.661|307.6|461.5|
|草稿正式提交|20.916|21.258|343.5|446.1|
|退回重送|67.408|69.047|582.6|457.6|

T10 修改前同輪 100 long 單次矩陣：新建3.96、合併3.98、草稿25.83、重送105.44秒；最後重送 Operation 本身83.54秒。修改後矩陣的一次重送完整63.08秒、最後 Operation49.21秒。這是不同系統負載的單次觀測，不用它聲稱嚴格因果百分比。T08 81.34秒／531.8MiB 同樣只作既有參考；本輪 RSS 未全面降低，不能宣稱效能問題已解決。

CPU Profile 的重送完整105.43秒（含 profiler／宿主負載）：loader約0.512秒；主要 self samples 為 B1 detach36.535秒、encode12.195秒、H2 copy8.791秒、quote8.517秒、字串鍵處理8.229秒。Provider 合成讀取／Authority 合成交易不代表真實網路延遲。`h2Ms/b1Ms/r2Ms` 有巢狀關係，**不得相加**；prepare／writer／operation／含前序的 elapsed 分別保存。

本輪另保存 CPU user/system、heapUsed、process maxRSS、Wire／Envelope／H2 RowData／batch bytes 與本機 HTTP 等待紀錄。真實 API、PG、Redis、Google Sheets、OAuth、WAN 延遲及 Timeout **BLOCKED／NOT RUN**；不能由 Mock 推估成 PASS。100筆max500的本機HTTP案例約6秒，該紀錄的 `mutationRoundTripMs` 包含POST、完整GET及receipt核對，不能當成單一POST RTT。

|最後 Operation、P50／最大 ms|prepare|writer|operation（另含獨立核對）|CPU 中位秒（含前序／loader）|結束時 heap 最大 MiB|
|---|---:|---:|---:|---:|---:|
|新建|1132／1250|1315／1397|2870／3108|4.41|156.3|
|合併後新建|1211／1294|1356／1393|3032／3150|4.73|143.0|
|草稿提交|1632／1689|16757／17063|18961／19321|22.23|143.0|
|重送|10797／11307|44696／46433|56761／58600|70.30|351.7|

上述heap為子程序結束時觀測，不是peak heap；RSS是該fresh子程序累積最大值。Provider raw讀取／PG在此測試只是記憶體Port，真實成本不可填0或推論已通過。前端最後Chrome合成觀測：100筆編輯17.8ms、搜尋27.5ms、定位69.9ms，JS heap約139.4MiB；輸入API與業務Dispatch均0。這是單次瀏覽器控制耗時，沒有P95／真機SLO的證明。

### 候選 Runtime 預算（尚未核准）

建議首個授權驗收環境使用獨立持續運作的 Node 容器，至少2 vCPU／2 GiB，平台與反向代理硬時限至少600秒；另設定300秒應用流程候選預算與足夠結束／核實餘裕。這不是某 Hosting 方案的官方限制或已核准 SLO。100 筆最後操作候選 P95<90秒、完整流程<120秒、程序 RSS<1 GiB；任何配置低於實測所需時限或記憶體時均 No-Go。真實服務測試、連線 pool／5秒 connect／10秒 statement、Redis8秒、Sheets185秒 dispatch timeout、Google配額與總截止時間還須一起驗證，不能直接把分段 timeout 相加當作可用保證。

目前路由沒有明確 `maxDuration`／整體 deadline，`vercel.json` 只有排程；Hosting 的實際 timeout／CPU／記憶體未知。上述候選不是已實作的全流程取消機制。Provider 的完整 raw response 仍有16MiB上限、只讀live H2，整個namespace歷史增長及封存讀取尚未實環境驗收；單張100筆成功不等於長期總容量或併發負載已放行。

## 故障、恢復與安全

新增15項 Writer 故障注入：PG Attempt 讀取、owner遺失／不可核實、Sheets讀取／漂移、pending登記、dispatch barrier、catalog前置拒絕、ACK遺失（已套用／未觀測）、寫後不符、Authority ACK／verified／business證據保存、外部postcondition失敗。逐項檢查0或1次Dispatch、原wire／mapping、預期資料或完整未寫入、owner處置與UNKNOWN原Attempt重入不再Dispatch。

原有 SEC intent、Redis acquire不明／Lua release1/0/例外、Body／Origin／限流、受控確認偽造、退役ID、H2缺口／rollback challenge、R2／B1衝突、Audit／Telegram失敗全部保留。跨程序恢復使用合成密文資料列與另一個 Node PID；不是實際 PostgreSQL 故障演練。H2純Reconciliation七分類重新執行，真實人工授權與持久化程序仍BLOCKED；沒有自動補ACK、重送、配號或force unlock。

完整安全結論見 `t10-security-review.md`，包含實際 Fail-Closed、未完成的獨立 Head、PG角色／trigger、ACL／TLS、備份還原及外部 headers 的證據限制。

## 最終一次交付清單

|項目|狀態|
|---|---|
|本輪來源與測試修正|已實作，詳 SHA 清冊|
|Git／原 dirty／untracked|HEAD未變，既有成果保留；不宣稱工作樹 clean|
|Schema／Genesis／PG／Redis／OAuth 真實測試|BLOCKED，沒有操作授權或隔離資源|
|真實 Provider／API E2E／100筆真實整合|BLOCKED，沒有冒用Mock|
|本機容量、Provider組合、HTTP、故障、UI|PASS：43/43容量；全部新故障與HTTP斷言通過，皆為合成服務|
|Runtime 全量|PASS：559/559，保留原520、新增39；FAIL/skip/cancelled均0|
|Browser 全量|PASS：80/80，保留原68、新增12；FAIL 0|
|TypeScript／ESLint／diff|PASS：noEmit/incremental=false、no-cache/max-warnings=0、git diff --check|
|隔離 Production Build|PASS：Next.js 16.4.3、26/26、exit 0，最終文案版亦重新執行|
|Android／Safari／真機鍵盤|NOT RUN，無設備或遠端裝置|
|真實破壞性故障／真實出貨通知|NOT RUN，無專用資源；未向真實對象發送|
|v1相容／舊資料遷移／adoption|NOT APPLICABLE：本系統採乾淨v2，未執行此類工作|
|正式服務、憑證、DDL／Genesis、commit／push／部署|NOT RUN，未執行|
|整體正式啟用|No-Go；不是僅缺一個 enabled 旗標|

## 重現與 artifacts

Artifacts：`C:/Users/im0pl/AppData/Local/Temp/mmm-t10-9f6c26d3b8f643099af84a71576455b2/`。所有測試資料合成。

```text
node scripts/t10-environment.cjs --plan
node scripts/t10-environment.cjs --validate config/t10-environment.example.json
# example 應回 BLOCKED/exit 2；不能加入 apply。
node --test --test-isolation=none --test-reporter=spec tests/order-workflow.test.cjs tests/order-v2-integration.test.cjs tests/order-ui.test.cjs tests/t10-environment.test.cjs tests/t10-integration.test.cjs tests/t10-ui.test.cjs
node scripts/t10-local-performance.cjs --output <系統暫存目錄/performance.json> 5
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js --no-cache --max-warnings 0 <本輪來源與測試>
git -c core.safecrlf=false diff --check
```

Browser／Build 以無dotenv、無正式憑證、禁止外部 socket/fetch／敏感檔案讀取的系統暫存副本執行；依賴為含零位元組 marker 的實體副本。初期 junction root／不完整依賴複製及測試等待問題已修正；沒有改產品 Next 設定或弱化原斷言。混合來源版本的開發中試跑不列為最終驗收。

尚需管理者透過安全配置流程提供：具體專用資源核准、空白Spreadsheet、專用PG與三種角色、專用Redis、測試OAuth／Users／Company／Catalog、通知沙箱、獨立最新Head及恢復權限、實際Hosting時限／記憶體／CPU／配額。不應把任何祕密貼進報告或聊天。缺少可信 Head 時，本輪真實 adapter 會保持503，不能移除 guard 來換取 E2E PASS。

## 本輪檔案與責任

|檔案|變更／原因|
|---|---|
|`lib/order-authority.server.ts`|修改：缺少獨立最新Head Provider時實際拒絕；非宣稱Provider已完成|
|`lib/order-business-source.server.ts`|修改：拒絕不可能的實體Grid尺寸|
|`lib/order-history.ts`|修改：不可變資料表示／Digest計算重用；無Witness verdict快取|
|`components/OrderForm.tsx`|修改：送出前保留顯示快照、UNKNOWN原Attempt、confirmed／拒絕才清除|
|`components/AdminReviewWorkbench.tsx`|修改：管理員批次UNKNOWN刷新恢復；後續單不自動接續|
|`tests/ui-smoke.cjs`|修改：保留68項，新增12項恢復／帳號／停批／七寬度；只等待既有分頁斷言完成，沒有放寬|
|`docs/security-deployment.md`|修改：置頂目前獨立Head缺件／503／No-Go與最新Wire契約來源，避免沿用早期上線敘述|
|`docs/verification.md`|修改：置頂本輪證據與真實環境BLOCKED，不把舊結果當本輪PASS|
|`lib/order-attempt-recovery.ts`|新增：有界、版本化、只作顯示的runtime schema|
|`components/OrderAttemptRecovery.tsx`|新增：帳號／Company／角色／目標分區、唯讀顯示與授權receipt查詢|
|`config/t10-environment.example.json`|新增：無祕密的專用測試資源範本|
|`scripts/t10-environment.cjs`|新增：七表離線計畫與公開metadata拒絕邊界；無apply|
|`scripts/t10-local-performance.cjs`|新增：四流程、fresh child、loader／CPU／RSS／容量量測；輸出限系統暫存|
|`tests/t10-helpers.cjs`|新增：重用已驗收合成Port；不重複註冊舊測試|
|`tests/t10-environment.test.cjs`|新增：7項離線範本／資源binding／production排除／無dispatch測試|
|`tests/t10-integration.test.cjs`|新增：27項實際路由函式、loopback、adapter、故障與不可變cache邊界|
|`tests/t10-attempt-worker.cjs`|新增：不同Node PID的固定合成密文恢復，不連資料庫、不輸出私有內容|
|`tests/t10-ui.test.cjs`|新增：5項恢復schema／100筆／不含憑證／跨scope拒絕測試|
|`docs/t10-security-review.md`|新增：安全證據與正式阻擋|
|`docs/t10-acceptance.md`|新增：本報告|
|`docs/t10-sha256.json`|新增：開始與結束的完整非忽略清冊、精確差異（排除自身）|

沒有修改API路由、Writer、T02、T04、T05、B1、R2、三表Schema、PG SQL、package／lock／tsconfig、README、AGENTS、T09設計與驗收文件。沒有本輪刪除的檔案；既有Git刪除與未追蹤狀態不冒稱為本輪變更。


## 最終執行證據

- 本輪原始基準重新跑520/520；修正後最後整包559/559，0 fail、0 skip、0 cancelled，401061.2962ms。原三個Runtime測試檔SHA不變，沒有刪除／放寬Golden或舊斷言。
- 全部新增T10分組亦獨立重跑39/39，包含另一Node PID讀回原合成密文；最終全量也保留這些斷言。
- 最終Browser80/80（含原68）；Production Build26/26，exit0。最後只把新增恢復頁的內部術語換成「作業／系統核實」，再跑80項Browser與Build，不影響核心測試語意。
- 隔離Build圍欄曾攔截外網socket、敏感設定檔及shell子程序；沒有放寬圍欄換取PASS，也沒有成功的正式服務存取。
- SHA範圍：開始167檔，結束180檔（含清冊）；新增13、修改8、刪除0，共21檔。以最後清冊重算核對，不把Git既有修改或刪除歸入本輪。
- 中途HTTP測試的fetch-deny衝突改用只能連127.0.0.1的原生HTTP，未移除既有外網拒絕；DELETE補正Content-Length。先前失敗如實保留在暫存log，最後整包已重新通過，沒有更新Golden讓錯誤變綠。
- runtime-verified.log／capacity-verified.jsonl、t10-release.log、performance-final.json／profile-resubmit.json、browser-verified.log／ui-verified/results.json、build-release.log／build-final-isolation.jsonl、typescript-final.log／eslint-final.log 是本輪證據。
- 關鍵合成畫面：ui-verified/t10-recovery-390.png、t10-recovery-1440.png、t10-admin-unknown-recovery.png、t10-unknown-refresh-390.png；不是正式網站截圖。

## 本輪43筆容量成功紀錄

前40筆為主矩陣，其餘為不同長備註、500字及多層合併。每一筆都核對完整邏輯Payload、Digest、B1、R2、原Attempt、單次業務Mock Dispatch與寫後核實；不是外部Sheets E2E。Wire／Chunks的加號代表同一Operation的多個Event，沒有拆開業務寫入。

|profile|流程|材料數|Wire bytes|Chunks|H2 RowData bytes|batch bytes|結果|
|---|---|---:|---:|---:|---:|---:|---|
|short|create|1|4712|1|8981|16511|PASS／confirmed|
|short|create|25|29006|4|49481|218913|PASS／confirmed|
|short|create|50|54337|7|91361|429468|PASS／confirmed|
|short|create|75|80214|10|133985|640767|PASS／confirmed|
|short|create|100|106114|13|176660|852118|PASS／confirmed|
|short|merge-one|1|844+5698|1+1|14116|21577|PASS／confirmed|
|short|merge-one|25|28187+5698|4+1|58683|228043|PASS／confirmed|
|short|merge-one|50|53512+5698|7+1|100555|438590|PASS／confirmed|
|short|merge-one|75|79376+5698|10+1|143163|649873|PASS／confirmed|
|short|merge-one|100|105276+5698|13+1|185834|861220|PASS／confirmed|
|short|submit-draft|1|5021|1|9551|13921|PASS／confirmed|
|short|submit-draft|25|32108|4|54249|151557|PASS／confirmed|
|short|submit-draft|50|60350|8|103341|297549|PASS／confirmed|
|short|submit-draft|75|89267|11|150498|441606|PASS／confirmed|
|short|submit-draft|100|118167|15|200512|588542|PASS／confirmed|
|short|resubmit|1|5443+1271|1+1|14669|18223|PASS／confirmed|
|short|resubmit|25|40786+7609|5+1|81710|167885|PASS／confirmed|
|short|resubmit|50|77952+14284|10+2|157367|329667|PASS／confirmed|
|short|resubmit|75|115627+20959|15+3|233727|492152|PASS／confirmed|
|short|resubmit|100|153302+27634|19+4|307221|651784|PASS／confirmed|
|long|create|1|5211|1|10124|18443|PASS／confirmed|
|long|create|25|29505|4|52061|241218|PASS／confirmed|
|long|create|50|54838|7|95382|472939|PASS／confirmed|
|long|create|75|80715|10|139443|705400|PASS／confirmed|
|long|create|100|106615|14|186739|941097|PASS／confirmed|
|long|merge-one|1|844+6197|1+1|15739|23989|PASS／confirmed|
|long|merge-one|25|28686+6197|4+1|62407|251492|PASS／confirmed|
|long|merge-one|50|54011+6197|7+1|105716|483201|PASS／confirmed|
|long|merge-one|75|79877+6197|10+1|149765|715650|PASS／confirmed|
|long|merge-one|100|105777+6197|13+1|193873|948159|PASS／confirmed|
|long|submit-draft|1|5519|1|10694|15223|PASS／confirmed|
|long|submit-draft|25|32606|4|56829|158112|PASS／confirmed|
|long|submit-draft|50|60850|8|107841|309999|PASS／confirmed|
|long|submit-draft|75|89767|11|156435|459468|PASS／confirmed|
|long|submit-draft|100|118667|15|208365|612295|PASS／confirmed|
|long|resubmit|1|5941+1271|1+1|16291|20004|PASS／confirmed|
|long|resubmit|25|41284+7609|6+1|88591|178741|PASS／confirmed|
|long|resubmit|50|78456+14284|10+2|163787|344037|PASS／confirmed|
|long|resubmit|75|116131+20959|15+3|243021|513371|PASS／confirmed|
|long|resubmit|100|153806+27634|19+4|318910|679373|PASS／confirmed|
|unique|create|100|156742|20|272687|1027645|PASS／confirmed|
|max500|create|100|274342|34|474083|1464241|PASS／confirmed|
|short|merge-multi|100|105276+6433|13+1|186815|862186|PASS／confirmed|
