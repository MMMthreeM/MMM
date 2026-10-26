# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

工班使用者以手機或桌機建立、暫存與追蹤材料需求；管理員審核訂單、確認交期、批次更新狀態並匯出廠商下單報表。

## Product Purpose

集中管理工班的材料需求，讓申請、審核、出貨與送達進度能被清楚追蹤，並降低人工彙整與錯誤下單的成本。

## Positioning

系統將可共享的工班草稿、材料最小數量與級距驗證、訂單生命週期，以及可直接下單的 Excel 報表串成單一流程。

## Operating Context

約 30 位工班使用者與 5 位管理員在維運與採購作業中使用；資料以 Google Sheets 維護，系統支援 PWA、Google OAuth、Telegram 通知與問題回報。

## Capabilities and Constraints

- 申請端可搜尋或自填材料、建立草稿、修改處理中的訂單與重訂歷史需求。
- 訂單狀態為編輯中、處理中、審核中、準備出貨、已送達；管理員可退回項目並留下原因。
- 單價僅供後端匯出使用，前端不得顯示。
- 系統需支援手機與桌機操作。

## Brand Commitments

介面採用台達電（Delta Electronics）藍、綠色系，定位為可靠、清晰且專業的維運協作工具。

## Evidence on Hand

完整的需求、資料 Schema 與流程記錄於 `D:/維運材料需求管理/材料需求管理平台 - 設計規格確認書.txt`。

## Product Principles

1. 讓工班能在最少停頓下完成正確的申請。
2. 讓每張單的狀態與下一步一眼可辨。
3. 讓管理員能快速篩選、批次處理與匯出。
4. 將機密價格與內部管理資料留在使用者端視野之外。
