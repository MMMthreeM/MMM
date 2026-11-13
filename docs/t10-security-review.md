# T10 安全驗收與啟用阻擋

本輪只使用合成資料、受限 Port、127.0.0.1 HTTP 及隔離 Chrome／Build。沒有指定並核准的外部測試資源，沒有正式資料／憑證／DDL／Genesis／部署。此報告不是正式基礎設施稽核通過證明。

## S01｜High：資料庫自身 Head 不能證明沒有整體回滾

- 位置：`lib/order-authority.server.ts:34` 的 `postgres-authority`；`lib/order-business-source.server.ts:77` 的兩次 Head 讀取及 `:91` 的受限 Retention callback。
- 證據：兩次 PostgreSQL revision/checkpoint 相同可以證明本次觀測穩定，不能證明 PostgreSQL 與 Sheets 未一起被還原到舊的、彼此一致的狀態。雜湊、SERIALIZABLE、時間戳、env enabled 及同庫保存的 minimum revision 均不是獨立最新 Head。
- 影響：若沒有獨立可信 Head，完整期間、曾使用／退役 ID 與目前有效退回的歷史可能被一致回滾掩蓋。
- 本輪修正：`PostgresOrderAuthority.head()` 在獨立 Provider／advance protocol 尚未實作時明確拋出 `INDEPENDENT_HEAD_PROVIDER_NOT_CONFIGURED`（503），不建立資料庫連線。這是實際 Fail-Closed；不是把缺件改成 verified。原始 Attempt 查詢不變，沒有自動重送／解鎖。合成 Authority 明確保持測試 Port 身分。
- 驗收：新增實際 PostgreSQL adapter Head 零連線拒絕；H2 舊 checkpoint／錯 challenge／缺期間及每次重驗 Witness 的原有與新增合成斷言。
- 剩餘：**BLOCKED／正式 No-Go**。必須完成經審查、獨立於同一 PostgreSQL 備份／管理域的最新 Head 來源、Genesis 綁定、單調更新、pending／ACK／verified 不同交易的恢復協定及實環境驗收。不能刪除這個拒絕或新增 ready=true 來放行。

## S02｜Medium：UNKNOWN 刷新會遺失表單與原作業入口

- 位置：`components/OrderForm.tsx`、`components/AdminReviewWorkbench.tsx` 原來只有掛載期間的 React state。
- 本輪修正：`lib/order-attempt-recovery.ts` 及 `components/OrderAttemptRecovery.tsx`。在提交前保存版本化、帳號／Company／角色／目標綁定的 sessionStorage 唯讀顯示快照；未知回應加入原 Attempt。刷新後只可顯示材料、勾選紀錄及處置說明、查詢原作業。已 confirmed／明確 rejected 才清除本機顯示紀錄。
- 不保存：確認 Token、B1/H2 私有證據、wireBody、Authority owner、可執行 request、永久 ID 配號權限或可重送識別。沒有新增正式冪等機制。hash key 只是 UI 分區，不是認證。
- 封閉邊界：損壞／超額／錯帳號紀錄不成為可編輯表單；儲存不可用會在業務提交前拒絕。客戶端刪除紀錄也不能解除伺服器 owner／Attempt。關閉整個分頁或清除瀏覽器資料後的跨裝置顯示恢復不作保證，必須使用經授權的原 Attempt 查核。
- 管理員：逐單批次只保留當前未決單的材料及後續未執行數量，不重新開始剩餘批次；未決 namespace 沒有被清空來繼續測試。

## S03｜Medium：原始 Grid 尺寸矛盾未被拒絕

- 位置：`lib/order-business-source.server.ts:52` 與後續 rows.length 驗證。
- 本輪修正：sheetId 必須非負、實體 rowCount 至少一列、columnCount 足以包含契約欄位，回傳列數不得超過實體 rowCount。既有 schema／公式／缺欄／型別／digest／完整範圍驗證保留。
- 驗收：不可能的 rowCount、columnCount、負 sheetId、超出實體網格的資料全部拒絕；既有 H2/B1/R2/schema 污染 API 案例斷言零新 Attempt／零 Dispatch。

## 尚不能作 PASS 的外部安全條件

|條件|本輪可驗證部分|正式／專用測試環境|
|---|---|---|
|OAuth／Users／Company|真實路由函式＋受限合成 auth；原有登入／角色／Company 斷言|BLOCKED：沒有專用 OAuth client／帳號／ACL|
|Origin／JSON／body／限流|原 wrapper、合成 Redis、實際 loopback HTTP 拒絕|外部 WAF／TLS／速率上限 NOT RUN|
|永久身份、受控確認、H2／R2|Golden、偽造／缺欄／衝突／退役重用、零 Dispatch|真實完整原始觀測 BLOCKED|
|PG TLS|實際 Pool 建構參數：非 loopback verify-full、清除 URL SSL override、timeout／max|握手／私有 CA／憑證輪替 NOT RUN|
|PG runtime／owner／維護權限|讀取離線 SQL；實際 adapter 模擬交易／不重播 COMMIT／AES-GCM AAD|BLOCKED：沒有可核對的角色／GRANT／trigger 執行結果；不能宣稱 runtime 無權重寫已完成 retention metadata|
|Attempt 跨程序|獨立 Node PID、合成加密資料列、實際 adapter 解密原 wire／mapping／owner 的摘要核對|不是實際 PostgreSQL 持久化／斷線復原證明|
|Redis owner／SEC|實際 Redis adapter 回覆驗證、Lua 1／0／例外、不盲目 release|ACL、持久化、供應商故障一致性、多實例 BLOCKED|
|歷史期間／最新 Head|獨立 Provider 缺失實際 Fail-Closed|BLOCKED：不接受同庫 Head 自證最新|
|UNKNOWN／Reconciliation|原 Attempt 單次邊界、加密恢復、純 H2 手動 reconciliation 診斷、UI 不重送|人工授權的實際 reconciliation 持久化與維運介面仍缺；不自動改 unknown 為 verified|
|Audit／通知|已 confirmed 不因附屬失敗重送；僅合成替身|外部沙箱收件 NOT RUN，未通知真實對象|
|公開回應|Company 範圍、no-store、摘要 receipt；未公開 Chunk／私有 Attempt|代理／CDN cache 與安全 response headers NOT RUN|
|CSP／frame-ancestors／安全 Cookie|檢視 app 與 NextAuth 設定，沒有加入寬鬆 CORS 或關閉保護|edge／TLS／正式 headers 不可由本機 Mock 推定，NOT RUN|

## 效能優化的安全邊界

`lib/order-history.ts` 只重用完整檢查且深度 frozen 的資料表示；root copy 記錄高度，重用仍遵守 48 層。淺 freeze 下的可變 child 不進入 cache。canonical 成功字串最多 128 筆／16 MiB UTF-8；copy 與原始觀測 digest 使用 WeakMap，沒有把變動原始觀測或 Witness verdict 持久化。

每次呼叫仍執行 Retention、freshness、Authorship、line lifetime、B1、R2 與 postconditions。新測試在同一輸入上依序撤銷 freshness／actor，必須立即由 verified 轉 unverified；不能命中舊資格。T04/T05/B1/R2、H2 details／wire／Digest／容量／Schema 語意與 Golden 不變。

**安全結論：本機封閉邊界可驗證；正式安全與環境就緒仍為 No-Go。**
