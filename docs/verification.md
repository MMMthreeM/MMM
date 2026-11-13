最新結果請見 [2026-11-12 相容碼清理、UI 與真實讀寫驗證](single-sheet-ui-cleanup-2026-11-12.md)。以下保留各輪原始紀錄；其中舊架構指令、未測 Redis 及套件清單不得當成目前狀態。

# T10 本輪驗收與限制

**最新驗收請見 [2026-11-11 單一 Sheets 與資料搬移](single-sheet-migration-2026-11-11.md)。** 本輪已真實寫入新庫並以程式服務帳號讀回；下方 PostgreSQL／H2 v2 的 No-Go、無寫入紀錄與舊測試通過數保留供追溯，不是目前架構或本輪驗收結果。線上網站尚未部署切換，真實出貨／Redis／通知全鏈仍未執行。

最新證據見 [T10 整合驗收](t10-acceptance.md)、[安全審查](t10-security-review.md) 與 `t10-sha256.json`。沒有核准的獨立外部測試資源，因此真實環境／真實 E2E 為 BLOCKED；本機 Port、HTTP、Browser Mock 與隔離 Build 結果不能提升為真實服務 PASS。

真實 PostgreSQL Head 在獨立最新 Head Provider 缺失時保持503。沒有執行 DDL／Genesis／正式資料寫入／部署／commit／push；下方 T07～T09 及歷史結果不得冒充本輪重新執行的結果。

# T07-V2-I2 本機整合驗收（2026-11-05）

本節為目前 v2 實作；下方日期較早的紀錄保留供追溯，不代表本次執行過 build、正式服務驗收或舊版相容。現行直接替換五個 mutation，刪除兩個隔離 v2 GET URL 及舊 admin alias；不做雙軌、遷移或歷史 adoption。

## 本輪實作範圍

- 三張精確工作表：Orders 21 欄、Draft_Item_State 13 欄、Order_History 22 欄；只有離線建置產物，未建真實表。
- PostgreSQL Authority／加密原 Attempt、append-only evidence、current checkpoint、pending-before-dispatch、單次 Sheets batch、原始資料寫後核實與獨立 durable business verification。
- 受控 B1 確認憑證綁定 actor、Company、材料、catalog basis、完整 request；私有 runtime capability 不接受 JSON 偽造。
- 五入口直接使用共用 Writer，保留 Origin、大小、權限、限流、SEC intent、Redis owner-only release。其他四個 secureMutation 保留既有契約。
- GET、匯出、詢價及通知改讀可信 v2 投影；未核實讀取不提供 mutation 參照。匯出／詢價不推進狀態；通知失敗不改寫業務結果。
- 共用編輯器涵蓋新正式單、新草稿、編輯草稿、修改待審單、退回重送及再訂一次。永久身份、client key 分離；合併由伺服器精確算量，未保存可撤銷。
- 管理員指定／整單退回、明確取代、工班處置、重送與歷史顯示。UNKNOWN／acknowledged-unverified 保留表單，只查詢原 Attempt，不重送或解鎖。

## 回歸與故障注入

原 393 個 runtime cases 與 356 個靜態 test 宣告名稱全數保留。舊 wire/schema 斷言逐項移植為 v2，材料身份、最低量、權限、完整性、未知結果等安全目的保留；凍結核心 Golden Vectors 未放寬。T05 只公開既有精確算量／抽出共用 merge preview；B1 只新增候選驗證入口。T02、T04、H2、R2 原檔 SHA-256 不變。

新增整合測試涵蓋完整路由＋SEC＋Provider＋Writer 組合；僅登入及外部服務 ports 為合成 Mock。故障包含失去 ACK、ACK 後原始資料不符、Authority register／dispatch barrier commit 不確定、已核實資料但 business evidence commit 失敗、owner 或觀測漂移、H2 chunk 遺失／公式、跨 Company、偽造 request/candidate、退役 ID 重用及通知／稽核交付失敗。實際 PostgreSQL adapter 以 mock Pool 驗證交易、AES-GCM round trip 與不重播 COMMIT；未連線真實資料庫。

100-row 實體更新與還原計畫通過身份／列順序／精確欄位遮罩檢查。100 筆完整確認的正式需求超出已凍結 H2 Event 512 KiB 上限，正確在 writer 前拒絕，零部分寫入；不宣稱 100 筆正式需求可保存。變更此容量或事件拆分需獨立契約授權。

全量原始 business snapshot 另有 16 MiB／250,000 資料列的應用程式上限；本版不實作歷史封存或裁剪，超限會拒絕可信寫入，不得以局部讀取冒充完整歷史。正式使用前需要容量驗收。Users／Materials 仍須依既有受信登入與材料庫契約預先配置，離線三表 plan 不會代建它們。

Browser Mock 使用本機 Next dev 與隔離 Edge，攔截所有 API，外部服務由同一套實際路由＋核心＋Writer 合成 adapter 執行，封鎖非 loopback 網路、dotenv 讀取與自動改寫 AGENTS。驗收涵蓋：新增、草稿保存／修改／正式送出、管理員編輯、指定退回、明確取代、修改後重送、合併與撤銷、未確認原文阻擋、完成審核／出貨／送達、Excel／詢價、再訂一次、整單刪除、UNKNOWN 原 Attempt 保留。320／390／768／1024／1440px 無整頁橫向溢出；操作按鈕最少 44px，無瀏覽器 runtime error。最後操作列取消浮動，避免遮住手機處置欄位。

## 檢查命令與界線

實際完整回歸結果：429／429 PASS（原有 393＋新增整合 36），FAIL 0、SKIP 0。Browser Mock 已完成 21 項 PASS、FAIL 0；TypeScript noEmit、白名單程式 ESLint 與 git diff --check 通過。未執行的真實服務／正式環境項目維持 NOT RUN，不計入通過數。截圖與瀏覽器結果保存在專案外的本機暫存目錄。

```text
node --test --test-isolation=none --test-timeout=180000 --test-reporter=spec tests/order-workflow.test.cjs tests/order-v2-integration.test.cjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js --no-cache <本輪 TS/TSX/CJS 檔案>
node tests/ui-smoke.cjs  （UI_START_DEV=1；本機合成依賴）
node scripts/provision-v2.cjs --plan
git diff --check
```

移除舊 route 後，既有忽略目錄中的 Next route validator 曾指向已刪檔案；已使用官方 `next typegen`（禁 dotenv／外連）刷新型別，未執行 build。Next dev 曾移除 AGENTS 回饋區塊；已精確恢復至開工 SHA-256，後續測試攔截該檔自動寫入。

初始 SHA-256 盤點取得 139 個非忽略檔案；Git 引號處理漏列的三個中文檔名（啟動.bat、兩份原始專案 txt）另以目前 Git blob 與 HEAD 完全相同核對，不能宣稱這三份取得開工原始 SHA-256。最終盤點改用 core.quotepath=false。

未執行：build、正式／測試服務建置、真實 PostgreSQL DDL/TLS/權限驗收、真實 Sheets／Redis／Telegram／OAuth、多程序宕機測試、備份復原、正式 Genesis／namespace 初始化、部署、commit 或 push。Writer 預設未啟用；必要 schema、可信空 Genesis、Authority ACL/TLS、加密金鑰管理、Redis、Sheets ACL、受控測試環境仍須由管理者另行配置與驗收。UNKNOWN 人工 reconciliation 不提供自動修復 API，不能強制解鎖或重播。

## T07 SHA-256 與實際檔案清冊

HEAD 維持 35a38fc9b56f3345e0fd2eaf433a399fa7b7720b。開工已修改／未追蹤成果保留，以下差異以本輪開工雜湊為準，並非把所有未追蹤模組當成本輪新增。

實際變更 54 檔：新增 15、修改 36（含本報告）、刪除 3。全部位於核准白名單；沒有白名單外最終差異。AGENTS、README、tsconfig、T02、T04、H2、R2 與原有附件均維持開工 SHA-256。下一表排除本報告本身，避免自我雜湊循環；本報告最終 SHA 由完成回覆另列。

| 檔案 | 差異 | 開工 SHA-256 | 完工 SHA-256 |
|---|---|---|---|
| app/admin/orders/route.ts | 刪除 | A6893078620AF81354676D07DD1C64E45BFFD8F7B6BB9748000B0B9E5E1621CB | — |
| app/api/admin/edit-order/route.ts | 修改 | 78590926ED6F39C5E8C48A09F493D434331B73AF5CF68BDB920296545FEB83F3 | E21DAE57924374331F66F0107483115C6F29D56659DE22BCF3799F0DDCA236F1 |
| app/api/admin/export/route.ts | 修改 | 303A70F39FD7070275AE25C2FA05253C10E87C943A784EF24C6E98B9E1D70426 | 8965175751AE95DF4A215FDAE30358D34DADC6853CB9C8303CFC1EBFE410B138 |
| app/api/admin/orders/route.ts | 修改 | C78AB8E2D7338F1464C21549444621A840FBC1F3495E4853950C3B65A546585D | 32A0E6F43612CB0F8344DAB5B5C5AB65E917C95C4D2FB1D1A1D81C02453C3940 |
| app/api/admin/quotation/route.ts | 修改 | 80FCA759563E75573A0CB8A2941D654EEA80CC3835C0027EDD0E2E311A0500E0 | EEFCEF4F0965A7B9D2FC681F71157AA78AB7FC64F31067AD14C1E78DC0CED442 |
| app/api/admin/update-status/route.ts | 修改 | 250FD083C6611DF0BDDCF9965157810FAE0F00C06FF1790924F7D99C81B2FAB8 | 9FCC51316DE4E8EB1A5DA8C51BB10B5DF26278B7E15874924F43DA2885F957B6 |
| app/api/cron/pending-review/route.ts | 修改 | 9C42793BE7AFF89216DB49F5E71F2EB42377D3C6FE1225932E918E041EA18516 | 3A0656BD88C898CB2DC4224F062F0FC51D102F69595081FB6D14987F9650A4DF |
| app/api/orders/confirmation/route.ts | 新增 | — | 2B06EDB6ADF989A140D6BAE1D45C7912F04193ECB62DEC999F84E4CD73B93B62 |
| app/api/orders/delete-item/route.ts | 修改 | 7AF8347D87089346CAE275CC65AFC35CF1DB7AFB5B97EE56B12DE9705C7A2934 | 6CAE4B5B2332FA8C318749EEA0F2725C84FC43D719FA78316CFAF1A5DA9574F2 |
| app/api/orders/edit-item/route.ts | 修改 | 52628E7BB568C4CEA13DF9230B0276FADAB640326ED55E8FE2AB05177B35B04E | 0F414D6D008714E59C3CD1C9752688E58818515445340D7CD2AADEC81E457F7F |
| app/api/orders/operations/route.ts | 新增 | — | A23CC925523200F9D48FDDB9135F6D37F339A116B6F375942779E71E763BAF92 |
| app/api/orders/route.ts | 修改 | 482E8D927EF5E9E01C94C31B087BBE179A4586DCAFFDDC6AB9844FC6B30E56C8 | 2434FD6E8AE6983B599380995B18EC92297CC6CB0D970F3D99342EA952F3B8C4 |
| app/api/v2/admin/orders/route.ts | 刪除 | 7686069622912894D1365886272C2605EFA17185B980E0B65BB8E33CD62F106C | — |
| app/api/v2/orders/route.ts | 刪除 | C5381EC822097623AA06A157783B3D1C6A1DEC8FC90DD2F890EF8804D85823C3 | — |
| app/dashboard/page.tsx | 修改 | AB16C3D913973BA15848DE0858A1653AA08BE46A66E3EE3A4CCDDC3EB87C85E0 | E275650B91EED6CB80132CC7D483B0435B20A2AFE3E43534B78F3D67E04D41E2 |
| app/globals.css | 修改 | ACEBF0044964AFB695570AF4FD630EF8E3A44E8B9FC93913E91B9AD99C0F66C2 | 80B72E76C5E4E3C0BD276B92CB68DE4A6DF72903753429809F41A92A9C230464 |
| components/AdminOrderEditor.tsx | 修改 | FA84702E737C610FC6FFF4EDF86C67BDDD35EB844D3E3721C671211B37610080 | CF54FA2D60D43586E1988695060A9A19EF0303F0248C135B4FCA1C388CF8D7B0 |
| components/AdminOverview.tsx | 修改 | 480C4A92E8CAE608382FF17144A84FF63F52866DE03560D0321CD633681F9001 | 9659BB8F06461230B01B0C31DF3C93984AB3D1988E54A188495175D747D552A4 |
| components/AdminReviewWorkbench.tsx | 修改 | 0D23D5EC47EC0EB423B6D34016612A31C27C15FFC14DE83CEBEB648F7BEA98AC | 3A73C6F5F97CD2EA6E5FE16307B9959E87D1E579739098EC989438544147A463 |
| components/MaterialConfirmation.tsx | 新增 | — | AB6D1DD404E64EA1334148A1F0223C3B36B23091C27C758521F83064FBA9F580 |
| components/OrderForm.tsx | 修改 | A416B048B0C5D54FA5A3AAF48C14D022F6853FD37D5BCF631178F9854C4DD369 | 451CAF291702AF6AB59BB2AC2DB00096B116D574A627DF407FC81B0EE02B0B2E |
| components/OrderHistoryPanel.tsx | 新增 | — | 18A2ACC4FF62597B813D97EA83040340744C9C28E91DA3F81423710783F18E36 |
| components/useOrders.ts | 修改 | A290CE840F68739A1A5DC9F336999343E7B220A1E1FBC0005F3E27DA8EEA7A6F | 8E5DF3A3946A0E35992A91E85060BBFB2B3242847262C2CB74DE6F88BDB47420 |
| db/order-authority.sql | 新增 | — | DB9416E8D5C7679BAC4C0ADFB0FFB638A69156B07291B2E262331B9352151254 |
| docs/security-deployment.md | 修改 | 126EDF29CF771C251FDD21D3F587D3259242D5E8FB55E82F591BD2F40A18562A | 5044F41E8A35881270C77279E112193DBC577B662290FC8B68F2CABCA855F6F7 |
| lib/google-sheets.ts | 修改 | 39996FD407070B2FB705497C969B306708D08376A9BE8E6C5448BEB649596D8B | CA37E40411A9E39186234EDE46AC5E6DA4380AD7090E825975EC1342EF9CB68F |
| lib/mutation-security.ts | 修改 | 2545A0092CDDC8A931BB475F27555B31F588B4E3BD336CFB1661B5CA0246C79D | FC0B48F3339B07B9F81FF95B7083CD2B2D68AA0D01653F6BA51858ADC9EAE440 |
| lib/order-actions.ts | 修改 | A6E2AD82BACDF951A75286A55BDAE68F5DC62E417A380B5E30DFCDD9873D9F96 | D7142917348E1FFAC1E5DA805C7F42979BD6EBC45AA7F266564BE9B89C075F10 |
| lib/order-authority.server.ts | 新增 | — | BE8644C9B0FC7D571D948161A88C2DBAF86F61F730CB93D8F75C4750566E6F12 |
| lib/order-business-source.server.ts | 新增 | — | BB6C00EF9468502A6F8CA92996FBEAC96A8CC69D1A1CA070E2653CBF934EA839 |
| lib/order-change-set.ts | 修改 | B7F4ECDE522783D6808AA69E3532B94FD9FC613587F533FCC974EB4867C36101 | 4BFDA5166F0088985F2328263893C18C718A02260BF2B9150EFD0D478BA9FB9D |
| lib/order-confirmation.server.ts | 新增 | — | 53FC3D4EB9CAAABA3F6F53A5B3F4B739B96D49DF9B8A71B1729943AEE496E588 |
| lib/order-domain.ts | 修改 | 87D558251806EC7031992813677F026C350BED1044EDDE53E561EB6453C89EA1 | 085772EE044F6E34812F8D4C960A81E36A926B0FE221B89F8FA5348DB4D002C2 |
| lib/order-form-state.ts | 新增 | — | 0AF0633CDEBD6FC6C4B1334E2C4DEB67C420ED4A0F05FCA507A4A3197FA17A94 |
| lib/order-item-state.ts | 修改 | 90F227E27640BAA85056C380216431AF66A153A21AEAC587B3A0948E4758DA66 | BC904EDD8DA512C484193D431E4871C3CE2194FB6E4F845ED65DCC1B5CC009FF |
| lib/order-notifications.ts | 修改 | 6872F89A239F5570FD318A1A8E80E9021A323EAB31AFB1FB555168D7BB2B2A07 | 7523141FF5A4DD5EAA829CE706DE760C07D21377FF76D8C913F4BC5635D580AC |
| lib/order-sheet.ts | 修改 | 549F3483081A28A20B203C3DD0981A8E3B4EACE94124D34464F06C4A2F0486E9 | BE934E9EF8F494E9AEF871EFF7F57A0E88D105C65BF44149A7609E519CD08950 |
| lib/order-status.ts | 修改 | BA834F91AD620730B14BD050655D037B0F6181CC8A33159AAD53F59AA049FD4F | A351DD8B2F0996D392D33CA973340B8725A335883720DEBA54B204DA4AC753A9 |
| lib/order-v2-contract.ts | 新增 | — | 1F010505844D33DB5C8AF9F6AA761ABFE57B4E5EEF7EE00D5186070A042A6C54 |
| lib/order-v2-schema.ts | 新增 | — | 9FE38214026665ADD1F8C9EB2512471E8C9C1BC4B8945EF887CDD15663ECC1E0 |
| lib/order-view.ts | 修改 | D4FAD9FD0CC030DB2336861BFA5AFDFEEDAC05B9FB3AFFDF3DE817C43BF17139 | 500D95A16B61EF852CB91F01B9795616CECAD04B6AE2B9A86549DA8ABFE94A47 |
| lib/order-write-plan.ts | 新增 | — | AA051A699A997027626E0D03C15BB8FAA16ADB7FDD9000F4C98034F1F198726F |
| lib/order-writer.server.ts | 新增 | — | BCCDB590B59B9F8F1F88128631394A71B7EA81A7CAD39F59C9645DBC80096185 |
| lib/orders-v2-get.server.ts | 修改 | A7527719EB2AABD0F606F1B74E79C021B68862A96545596A65649EBC18116278 | 4ECF330BB7FCDFB1E21A57CBF87DA0BF5B3E8E63CBD3CC380C66540C25ABBF9C |
| lib/procurement.ts | 修改 | B05FC587A76675173C9F19867D58A4726ED6FACB349D35938B358DD85068EA36 | 6631EF483DCDDD4066AD502AFA71B439A079A209BAC2162D05D27F0F0C8B43D4 |
| lib/security-store.ts | 修改 | 81BF078BFD6D43851B7BC3FB8EBF137C4EBE9355BA98C87BF3669B8E30D1DA78 | C7EC066B93A8E45A3331112CDFE87EF0CCF993F133A366A0A56BF40035E336EF |
| lib/vendor-report.ts | 修改 | 063A5A4F67F0D402A936300012FB1104CBB827652DD70BF65E7BE7BA874FA103 | 6AD1A2DBA28814C6782D22111DDFAE6A6FBCCDCE08A7AB8F3C4AD7188145087D |
| package-lock.json | 修改 | 3CDECA34C9F89AAD7386F857E1CCEC9FE67BFC0B91B53F5F3D470498A2917AF5 | 5E74AD8C99EEAA12EBDDCDF0E0FF16C4ADEC2587F553F007D14A75C728258E56 |
| package.json | 修改 | C3477C340136A2DE4D38F4D564CCD5BB4762C99F56F1C55FE21EC27D11A0F375 | 32237F2716E8F39EE04F8B1AB40D04728BEEE3FBC0B0B3AFF06C31DA0EE2A25F |
| scripts/provision-v2.cjs | 新增 | — | 477FF96CA3B505DA93DF3AB6A6C234AB2A490067CCD94BAB2698BEEA9EF91A11 |
| tests/order-v2-integration.test.cjs | 新增 | — | 29A3FE5DC23861BE4CA7534A43020B2E6D6D2DBD1E17F113E26ED3CB6457F21D |
| tests/order-workflow.test.cjs | 修改 | 16CA20AE5C4522DE50FDD0A8B914A3EA009F5FFC03AE4D457CC3A84B4E1A8D8C | F6EFD87E17EBDD6089E257676CF13361DDDBA499B001EBCD6E7CC640A581069D |
| tests/ui-smoke.cjs | 修改 | 90B6C4B7DED80E89A1F9303A6F007567056AC1311D1D54FCF3887A68C2F2E827 | 5C3FF5C71CFC94A0432C54A329EC2F8B7D8DB180538D2837F9C762AAA4E3AC81 |

本報告 docs/verification.md 開工 SHA-256：D7A8B8164824481F431F9A848CFE457E58BF2F1C009A5DE3028960AD9F7D5983。

三個初始漏列中文檔案的現行 SHA-256（Git blob 均與 HEAD 相同，未標作本輪新增）：

- 啟動.bat：B093E834BC07C6B424CBD1DEFC76E788E7BBCD12C5C5D4D0609C9FD75C5F8C81。
- 材料需求管理平台 - 專案執行計畫.txt：B97161C68F11746D90E460FA8840677FDDB6BFB4A1FCDE551AD063EDF19C45FA。
- 材料需求管理平台 - 設計規格確認書.txt：06F33B86DD2E829099658B38E0C266DF3027A33C4FD5D4EAD9DDD0C2A3CA49B6。

## 先前驗證紀錄

# 驗證與限制（2026-10-29）

## 自動驗證

- npm test：23 項，涵蓋身分、工班隔離、草稿、材料及數量、狀態、退回、管理員編輯、匯出失敗與重匯、交期、排程驗證、TG 分段尾句、日期搜尋。
- npm run lint；npm run build：程式檢查、型別與正式版編譯。
- tests/ui-smoke.cjs：攔截所有 API，工班／管理者首頁、選單分區、整單選取、退回、編輯、匯出及重匯、歷史分類分頁、分類搜尋、長材料文字、未儲存確認、回報表單。
- 儀表板：16 個月桌機、手機六個月前後切換、完整範圍不顯示不可操作按鈕、點月份連動、返回恢復材料總覽分頁、單月／期間明細分頁、工班名稱角色差異、深連結已送達單。
- 介面以 320／390／768／1024／1440px 等寬度檢查；多材料與千分位數量相連顯示，返回列不浮動。測試畫面為模擬資料。

## 未推定完成

本機通過不等於正式部署成功。正式 OAuth／Google Sheets 權限、TG 群組和個人通知、每日提醒實際執行時間、Sentry 收件、原 XLS 範本與成品視覺須另外驗收。共用寫入鎖須 Redis 正確設定；不保證跨服務原子性。

## 維護

命名以 terminology.md 為準；清理及保留用途見 code-review.md。日常維護不可刪除 app/admin/orders/route.ts 的舊網址相容或手動報表工具；不可將 manifest 誤當 Web Push 或離線完成證明。

本輪結果：23 項流程測試、lint、build、完整瀏覽器回歸通過；新增管理／工班選單分組、冒號相連閱讀、非浮動返回列的驗證。截圖資料皆為模擬，正式外部服務未修改。

安全修補更新（2026-10-30）：材料驗證／匯出採一致正規化並重查數量；自訂寫入 API 驗證 Origin、JSON 類型及 128 KiB 上限；Redis 共用帳號限流、非自動過期的全表寫入鎖及先存意圖的稽核補寫。修改單據刪舊與新增改為單次 Sheets 批次。新增管理員稽核補寫入口，待補寫不重送訂單。必須先配置 UPSTASH_REDIS_REST_URL／UPSTASH_REDIS_REST_TOKEN 與正確 NEXTAUTH_URL，否則拒絕寫入；讀取、部署、舊版切換與手動解鎖限制請完整閱讀 docs/security-deployment.md（docs 內文件參照 security-deployment.md）。目前僅模擬測試，真實 Redis 及正式外部服務待驗收。

本輪安全驗證結果（2026-10-30）：35 項模擬流程／安全測試、lint、正式版編譯及攔截 API 的完整桌機／手機回歸通過；包含管理員稽核補寫按鈕。真實 Redis 服務尚未建立，不宣稱已完成正式 Redis／多實例／外部服務驗收。部署前必須先閱讀 docs/security-deployment.md，未設定安全協調服務時拒絕寫入。


## 2026-10-30 文字叫料與頁尾工具

- 訂單／安全自動測試 36 項通過，涵蓋明確長度乘數、保留未知材料與交貨備註、包裝單位不推算、最低量／級距、備註與批次上限。
- 本機正式建置與 ESLint 通過。
- 模擬 API 瀏覽器測試通過：管理員頁尾展開與補寫、工班無維護入口、問題回報成功提示 6 秒自動收起、文字叫料人工選料／單位不符不預填、未確認不加入、明確略過未知材料、匯入後經原表單送出與備註保留。
- 390px 與 1440px 文字叫料畫面無橫向溢出；原有選料、草稿、審核、匯出與趨勢測試通過。測試使用模擬資料，未部署或操作正式需求單。


## 2026-10-30 文字叫料第二輪修訂

最新規則取代上一節的包裝單位不預填與共用備註行為。
- 39 項流程／安全測試通過：最低量乘原文數量、同單位不擅改不合規數量、新事件台灣時間與待補寫 ISO 轉換、改名及歷史別名匯出後數量／單價正確、對應衝突與單位錯誤阻擋。
- ESLint、正式建置通過；使用模擬 API 的桌機／手機完整瀏覽器測試通過。
- 確認草稿捷徑直接開啟草稿分頁、單次材料確認、未確認自動聚焦、略過／恢復、文字叫料內自填、最低量提示、指定材料才套用交貨備註，並驗證最終送出資料內容。既有選料、草稿、審核、匯出及趨勢流程亦通過。
- 未修改線上 Google Sheet、未部署；Report_Name／Export_Aliases 需管理員依真實規格填寫，不猜測 1.6mm 與 1.6mm2 等差異。


## 2026-10-30：全工作表依表頭讀寫驗證

41 項測試通過。新增反向重排及在前方插入 30 欄的整合測試，涵蓋 OAuth 登入、帳號與工班權限、材料 API、公告、草稿新增／更新／送出、管理員審核與編輯、匯出數量及單價、TG 對象、稽核欄位寫回、草稿刪除。缺漏／重複／同義表頭衝突均拒絕操作且不產生訂單寫入。靜態搜尋確認線上工作表資料已無固定數字欄位讀取。離線廠商範本工具仍按原固定格式處理。


## 2026-10-31 驗證

42 項流程與安全測試通過；新增待審核／退回待修改／重送單狀態辨識與地區篩選測試。正式建置與 ESLint 通過。模擬 API 瀏覽器回歸涵蓋公告對齊、兩頁狀態選項與地區工班順序、備註位於全部材料下方、確認／略過同區、最後改備註不清除確認，以及步驟切換清除已加入提示；桌機手機無整頁橫向溢出。未部署或修改正式 Google Sheet。


2026-10-31 排版微調：公告文字與關閉按鈕垂直置中；審核、歷史與分析頁的開始／結束日期以同一群組排列，避免桌機換行拆開。寬度足夠時並排，400px 以下窄螢幕上下排列以保留日期欄位操作空間。


2026-10-31 選料簡化驗證：ESLint 與正式建置通過，模擬 API 完整桌機／手機回歸通過；確認常用／最近／收藏入口移除後分類、別名搜尋、混合材料備註與送出流程仍可用，草稿入口名稱與指定叫料範例正確。未部署正式網站。


2026-10-31 細節調整：叫料文字範例各行連續、不插空白行；表格本文列標題與工班名稱字級統一為 .95rem；公告縮小上下留白，關閉按鈕保留 44px 操作範圍並與文字置中。


2026-11-01 文字叫料確認進度：按鈕改為「加入清單（已確認 X／Y 筆）」。X 只計入已確認且資料有效的材料，Y 為未略過材料數。仍須所有未略過材料完成，按下時會定位第一筆未完成項目，不會只送出部分材料。


## 2026-11-01 採購對應與匯出分離驗證

- 47 項後端回歸通過（npm test），涵蓋跨廠商材料 ID／最低量驗證、原需求名稱保存、整單完成審核、禁止跳階、未指定供應商阻擋、各正式狀態匯出、草稿排除及混合賀冠內容分離。
- Excel 檢查：既有模板原 styles.xml 完全相同；新增材料列名稱、編號、單位、工班數量與合計正確，重複需求彙總，跨廠商不沿用原單價；新增列樣式與列高沿用前列，後續合計公式與列印範圍位移正確。
- 模擬 API 的完整桌面／手機瀏覽器回歸通過（tests/ui-smoke.cjs）；涵蓋 320／390／768／1024／1440px、整單勾選、材料／廠商編輯、賀冠文字編輯、匯出失敗重試、重匯不改狀態、完成審核／準備出貨自動切換篩選、歷史／分析／共享草稿與文字叫料既有功能。無頁面錯誤或橫向溢出。
- 已檢視桌面及手機截圖，補正新增原需求欄造成的桌面網格留白，材料與數量頂端對齊；新增回歸斷言。
- npm run lint、TypeScript 及 npm run build 通過；git diff --check 無格式錯誤。
- 本次未部署、未寫入正式 Google Sheets、未向真實 Telegram 傳訊息。真實 Excel 開啟列印、正式欄位自動追加與外部通知仍需於部署後以受控資料驗收。


2026-11-01 賀冠詢價文字調整：移除需求時間，備註標籤行首不縮排；保留工班、單號、品項及數量單位。既有詢價測試新增對應斷言。


2026-11-01 審核頁導覽驗證修正：AppShell 在登入／管理員角色確認前刻意不渲染子頁，造成 Next.js 16.4.3 對 /admin 顯示 dropped from rendering 的 instant insight。審核頁改為 Server Component 路由入口，依本機 instant API 文件設定 instant=false，明確允許此頁等待身分確認；互動內容原樣移至 components/AdminReviewWorkbench.tsx，保留查詢參數 Suspense 與權限／資料 API 檢查。這是針對該路由的驗證豁免，不代表改為即時載入或關閉全站驗證。

驗證結果：ESLint、正式建置通過；Next.js 開發模式完整桌面／手機模擬 API 回歸通過，含首頁狀態卡片導覽、管理編輯、獨立匯出、狀態切換、歷史與文字叫料。另以未登入 HTTP 請求確認 /admin 回傳登入確認畫面且不含訂單內容。此設定是明確退出該頁 instant 驗證，非變更登入安全邊界。

## 2026-11-06 T08-CAP-F1：H2 Wire v2 容量修復

授權範圍為新增 order-history-wire.ts 及九個指定既有檔案。本輪不建立正式 Schema／Genesis、不讀取正式憑證、不連線正式 Sheets／PostgreSQL／Redis／Telegram／OAuth，也不 commit、push 或部署。

H2 邏輯 HistoryPayload 與 h2p:v1 canonical bytes／SHA-256 保持不變。實體 Record／Event Envelope 為版本 2，canonical DAG 使用封閉 typed node grammar、binary64 16hex、決定性後序去重。Chunk／Event／Operation 採版本 2 domain。完整欄序、preimage 與資源政策見 sheet-headers.md。

解碼先核對物理 bytes、Nodes、只向前引用、深度、可達性、邏輯展開及剩餘 Operation 預算，才建立邏輯物件；解碼後重新編碼必須 byte-for-byte 相同。數值 -0／小數由 codec 保留，但原 H2 業務數值 schema 仍不接受其原本禁止的值；材料 Quantity 的 T04 typed preimage 與 T05 精確數量演算法不變。

原始 H2 解碼結果可在最多 16 筆、估算 16 MiB 的程序內記憶體額度重用；key 包含全部已驗證的原始儲存格。快取結果是獨立且深度 frozen 的完整 Bundle。這不快取 Retention／freshness／authorship／B1／R2 Witness 結果；新觀測、Checkpoint 及原始資料變更仍重新核對。快取不是操作資格或 Writer confirmed 證據。

HTTP 512 KiB 僅由五個 Orders action 加上受信 v2Executor 註冊，以及 confirmation 入口選用；其他入口仍為 128 KiB。客戶端 budget／maxBytes／header 不授予容量。T05 JSON budget 改為 512 KiB；100 最終材料、added 256、merge 128、操作 512、DAG 深度與 Quantity 算法均不變。

Writer 先完成 H2 實體編碼，再進入依賴該候選的 R2 核對。原 Attempt 的再次呼叫不產生第二次 Dispatch：未決結果保留 owner，已確認結果只使用受信持久化確認，不以新的快照不符釋放原 UNKNOWN。

### 既有測試的精確移植

- 原有 429 個案例保留。100 筆正式單從舊容量拒絕預期，移植為 100 筆不同合法 500 字備註、完整確認與單次寫入成功；拒絕零寫入目的由實體 Wire、RowData、完整 batch 邊界及故障注入保留。
- Orders／T05 舊 128 KiB 輸入邊界改為核准的 512 KiB；其餘入口新增測試固定在 128 KiB。
- 舊 h2p:v1 邏輯 Golden Vectors 及 raw vectors 不變。實體 Chunk／Event／Operation Golden 由獨立 Python json／struct／hashlib 參照離線計算，將完整 canonical bytes、UTF-8 hex 與 SHA-256 固定存於授權測試檔，不使用被測編碼器產生預期值。
- previousOrderOperation 的實體 Digest prefix 與 Record 版本改為 v2；新增明確拒絕 Wire v1。
- 原固定 multi-chunk vector 保留邏輯內容與完整還原；原本「Chunk 邊界切進 Unicode scalar」的斷言移植至專用 Unicode 邊界 fixture。
- 重複大字串可合法去重，因此舊資源測試改用獨立、不同的大字串；524,288／524,289 邊界改由獨立 DAG 參照構造，仍斷言 64 段完整保存及超限拒絕。
- H2 精確 import 清單與合成 loader 僅增加新純 codec；B1／R2 原始模組與業務規則未修改。

### 可重複驗收

Runtime：node --test --test-isolation=none --test-reporter=spec tests/order-workflow.test.cjs tests/order-v2-integration.test.cjs

TypeScript：node node_modules/typescript/bin/tsc --noEmit --incremental false

ESLint：node node_modules/eslint/bin/eslint.js --no-cache lib/order-history-wire.ts lib/order-history.ts lib/order-writer.server.ts lib/order-change-set.ts lib/mutation-security.ts app/api/orders/confirmation/route.ts tests/order-workflow.test.cjs tests/order-v2-integration.test.cjs

40 個主矩陣為 short／long × create／merge-one／submit-draft／resubmit × 1／25／50／75／100。額外包含不同長備註、不同 500 字備註、多層合併、過量操作拒絕、四個實體門檻、惡意展開、Chunk／Digest 篡改、100 筆 ACK 遺失／Authority 更新失敗／寫後不符及原 Attempt 重送阻擋。測試結果可使用 MMM_CAPACITY_RESULTS 輸出至系統暫存目錄，禁止寫入其他目的地。

效能欄位：encodeMs／decodeMs 是最後業務操作的 codec 累計時間；h2Ms／b1Ms／r2Ms 是各公開核對入口含子呼叫的時間，存在巢狀計時，不可相加。prepareMs、writerMs、operationMs 分別表示最後操作準備、Writer 執行及最後操作總時間；elapsedMs 另包含建構草稿／退回等必要前序業務操作。rssBefore／rssAfter 為程序觀測；processMaxRssKiB 是整個測試程序的累計最大 RSS，並非每案例獨立 Peak。所有來源使用合成資料、受限 Mock 及受控確認服務，不跳過 Witness。

隔離 Browser／Build 使用系統暫存副本，不複製根目錄 .env、憑證或正式初始化腳本；清除環境並設合成登入設定、關閉正式寫入及 telemetry，阻擋外部連線。Browser 使用既有 Chrome，全部業務 API 攔截為 Mock。Build 的產物只存在於副本。

### 最終本機驗收結果

2026-11-06 最後完整執行：Runtime 490/490 PASS、FAIL 0、cancelled/skipped 0（原有 429 項逐名稱保留並通過，新增 61 項）；Browser Mock 21/21 PASS；TypeScript noEmit／incremental false、白名單 ESLint max-warnings 0、git diff --check 全部 PASS。隔離 Next.js 16.4.3 Production Build exit 0，25/25 靜態頁面完成。正式服務、Schema／Genesis、部署、commit／push 均 NOT RUN。

40/40 主容量矩陣全部 confirmed；100 筆不同長備註、不同合法 500 字備註及合法多層合併也 confirmed。每一業務 Operation 單次 Mock Dispatch，前序建立／退回操作也各自整批完成；未將同次業務寫入拆分。每筆最終材料均保存有效永久 Line_ID 與完整 B1 Confirmation，並核對 H2 邏輯還原、所有 Digest、R2 及完整寫後狀態。

100 筆長配置的實體結果（bytes）：

| 流程 | 邏輯 Payload | Wire Payload | Chunks | H2 RowData | 完整 batch |
|---|---:|---:|---:|---:|---:|
| 新建 | 641312 | 106615 | 14 | 186739 | 941097 |
| 合併後新建 | 635119+10872 | 105777+6197 | 13+1 | 193873 | 948159 |
| 草稿送出 | 904009 | 118667 | 15 | 208365 | 612295 |
| 整單退回後重送 | 1142132+60541 | 153806+27634 | 19+4 | 318910 | 679373 |

100 筆不同 500 字備註：邏輯 877112、Wire 274342、34 Chunks、H2 RowData 474083、完整 batch 1464241 bytes，confirmed。

故障注入：100 筆 ACK 遺失為 unknown；Authority ACK 更新失敗／寫後不符為 acknowledged-unverified。全部保留原 Attempt、wireBody、Mapping，重入原 Attempt 不會第二次 Dispatch，維持 owner-only retain。H2 編碼容量拒絕在 R2 candidate validation 前完成，零新 Attempt／Dispatch。原有非 Orders 入口仍受 128 KiB 限制。

獨立子程序、100 筆長配置完整流程（含前序正式保存／退回）的效能：新建 4.750 秒、合併 4.690 秒、草稿送出 31.018 秒、重送 81.341 秒；程序最大 RSS 分別約 293.6、300.7、323.3、531.8 MiB。量測包含 TypeScript 合成 loader／Mock 驗收環境；不是正式部署的延遲或記憶體保證。H2／B1／R2 仍逐次核對 Witness。功能與容量驗收通過，不代表正式環境效能已放行，尤其重送仍需數十秒並有較高記憶體需求。

目前僅本機實作與合成驗收。正式啟用仍須獨立授權乾淨 v2 Schema／Namespace Genesis、配置受信 Authority／Confirmation／Sheets Provider 與權限、授權測試環境驗收及確認實際執行環境 timeout／memory 預算；不得因本輪 PASS 自動啟用正式寫入。
