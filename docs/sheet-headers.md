# 工作表依表頭讀寫

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
