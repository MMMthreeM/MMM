# 工作表依表頭讀寫

## 目前單一 Sheets 契約（2026-11-11）

使用者已明確選擇單一 Google Sheets 架構，以下舊 v2／H2 內容保留作追溯，已由 [Schema 3 與搬移交接](single-sheet-migration-2026-11-11.md) 取代。目前業務表為 Orders 21 欄、Draft_Item_State 13 欄、Order_History 10 欄，原始型別與固定順序必須符合 `lib/single-sheet-store.server.ts`；沒有舊格式位置回退、自動修表或 PostgreSQL／Genesis 前提。輔助表仍依既有明確表頭讀取。

## 目前 v2 業務契約（T08-CAP-F1）

Orders、Draft_Item_State、Order_History 採以下固定欄位及順序；缺欄、額外欄、重排或原始型別不合法均拒絕。下方早期開發紀錄的 Orders 別名、任意插欄及舊欄位規則不適用於目前 v2 業務表。Users／Materials 等輔助表仍依其共用表頭規則讀取。此處不授權建立正式表格或 Genesis。

- Orders（21）：Order_ID、Line_ID、Order_Date、Req_User、Req_Company、Req_Region、Material_ID、Item_Name、Original_Item_Name、Quantity、Unit、Vendor、Remarks、Status、Draft_Name、Admin_User、Expected_Date、Active_Return_Ref、Schema_Version、Namespace_ID、Created_Event_Ref。
- Draft_Item_State（13）：Schema_Version、Record_Type、Order_ID、Company、Line_ID、Marker_JSON、Source_State_JSON、Original_Data、Saved_Content_Fingerprint、Catalog_Basis、Confirmation_Data、Pending_Reasons、Updated_At。本次維持 B1 Schema v1，不刪除 Original／Confirmation。
- Order_History（22）：Schema_Version、History_Event_ID、History_Record_ID、Operation_Ref、Event_Index、Event_Count、Event_Type、Order_ID、Company、Actor_Ref、Occurred_At、Event_Envelope_JSON、Operation_Envelope_JSON、Chunk_Index、Chunk_Count、Payload_Byte_Length、Payload_Part、Payload_Digest、Part_Digest、Event_Digest、Operation_Digest、Commit_Semantics。

H2 Record 與 Event Envelope 的實體版本為 2，只接受 Wire v2，無 Wire v1 相容或遷移。Orders Schema v2、B1 Schema v1、邏輯 HistoryPayload／Operation Schema v1 不變。

Event Envelope 新增 `payloadEncoding: "h2-dag-v2"`、`logicalPayloadByteLength`。這是 JSON 內的欄位，不增加工作表欄數。`Payload_Byte_Length`／`payloadByteLength` 表示 Wire UTF-8 bytes；`logicalPayloadByteLength` 表示完整 `['mmm.h2.payload',1,payload]` canonical UTF-8 bytes。

Wire grammar：`["mmm.h2.dag",2,nodes,rootIndex]`。節點為 `["z"]`、`["s",string]`、`["n",lowercaseBinary64Hex]`、`["b",boolean]`、`["a",childIndexes]`、`["o",[keyStringIndex,valueIndex][]]`。物件鍵依原 H2 canonical 排序且維持 printable ASCII 鍵規則；值字串不正規化，拒絕不成對 surrogate。數值使用 big-endian 16hex，保留有限 binary64 與 -0；業務 payload 仍受原 H2 數值 schema 驗證。

決定性後序遍歷、結構去重；引用只能往前，所有節點必須可達，根為最後節點。拒絕重複節點／鍵、不合法索引、非 canonical 表示及超額展開。解碼在配置邏輯物件前以有界計數驗證大小與深度，且必須重新編碼得到相同 Wire bytes。

Digest preimages（皆使用 H2-CJSON-v1）：

- Payload：`["mmm.h2.payload",1,payload]`，維持 `h2p:v1:`。
- Chunk：`["mmm.h2.chunk",2,"h2-dag-v2",eventId,operationRef,eventIndex,eventCount,chunkIndex,chunkCount,wireBytes,logicalBytes,payloadDigest,base64]`，`h2c:v2:`。
- Event：`["mmm.h2.event",2,envelope,orderedChunkDigests]`，`h2e:v2:`。
- Operation：`["mmm.h2.operation",2,operation,ordered[index,eventId,eventDigest]]`，`h2o:v2:`。

四個 domain 使用 SHA-256 完整 64hex；依賴方向為 logical Payload → Chunk → Event → Operation，無循環。既有 `same-spreadsheet-business-batch:v1` 描述的寫入語意不變。

實體限制維持每事件 524,288 bytes、每段 8192 bytes／最多 64 段、每 Operation H2 RowData 總量 1,048,576 bytes、完整業務 JSON body 2,000,000 bytes、Envelope 16 KiB。新增邏輯 4 MiB／Event、8 MiB／Operation、65,536 Nodes、DAG 深度 48。這些是應用程式政策；1 MiB 不是每個實體儲存列可各自取得的額度。

## 早期開發紀錄

2026-10-30 起，Users、Materials、Orders、System_Notices、Audit_Logs 的線上讀取及寫回均依第一列表頭定位，欄位可整欄重新排序，也可插入自訂欄位。第一列仍須是表頭，工作表名稱維持不變。先部署新版，再調整線上欄位。

讀取完整工作表，不受原 A:F／A:N／A:AZ 窗口限制。更新單格、批次修改、刪單、追加訂單與稽核列皆使用當次表頭對應位置。廠商 Excel 範本及離線樣式擷取工具使用固定報表版型，屬格式處理，不是線上資料庫欄位順序；範本字型、表格與列位置維持原規格。

## 表頭規則

- 忽略英文字母大小寫、前後空白、空白／底線／連字號及全半形差異。例如 Min_Qty 與 min qty 視為同名。
- 僅接受明確列出的同義名稱，不做片段包含比對。Report_Name、Display_Name 不會被當成 Item_Name。
- 不可有重複表頭；同一語意不可同時保留兩欄，例如 Name 與 Item_Name、Email 與 User_Email。必要表頭遺漏時回傳可辨識的設定錯誤，不讀取原來的固定位置。
- 未識別的欄位可保留，但不會因名稱看似相近就自動參與業務處理。請不要刪除業務使用中的欄位。

## 建議使用的正式表頭

| 工作表 | 表頭 |
| --- | --- |
| Users | Email、Role、Company、Region、Nickname、Telegram_Chat_ID |
| Materials | Item_ID、Item_Name、Tags、Vendor、Unit、Min_Qty、Step_Qty、Price、Category、Subcategory、Search_Aliases、Order_Hint、Requires_Remarks、Display_Name、Report_Name、Export_Aliases |
| Orders | Order_ID、Order_Date、Req_User、Req_Company、Req_Region、Item_Name、Quantity、Unit、Remarks、Vendor、Status、Admin_Note、Draft_Name、Admin_User、Expected_Date、Order_Return_Note、Material_ID、Original_Item_Name |
| System_Notices | Content、Is_Active |
| Audit_Logs | Log_ID、Timestamp、User_Email、Action、Target_Order_ID、Details |

既有英文短名稱也支援：Materials 的 ID／Material_ID、Name、Min、Step；Users 的 Name、Chat／Chat_ID。正式中文別名及完整規則以 lib/sheet-table.ts 為準。Materials 的必要欄位為 ID、名稱、廠商、單位、最低量、級距；Price、分類及顯示／報表對應欄位為選填。Users 的 Email、Role、Company 必須存在；工班帳號 Company 儲存格仍須填寫。Audit_Logs 六個表頭均須存在；不需固定 A:F 順序。

欄位重排並不改變權限、價格保護、材料規則或資料內容。新增別名不代表可任意修改材料 ID，材料改名與 Report_Name 的維護仍請參考 material-naming.md。
