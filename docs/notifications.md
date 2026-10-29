# 手機與網站通知（2026-10-29）

## 現況

平台後端把業務事件送到 Telegram 管理群組／主題，或原申請人的 Telegram_Chat_ID。手機若安裝 Telegram 並允許系統與對話通知，可由 Telegram 顯示通知。將 MMM 網頁加入主畫面不會把 TG 訊息轉成 MMM 的通知，也不會替已靜音群組解鎖通知。

## 若未來新增網站推播

需要 Service Worker、使用者主動授權、裝置訂閱與金鑰保存、後端發送、失效訂閱清理、帳號／工班／管理者通知權限、登出與換工班處理，以及通知開啟需求單時再驗證登入。它與 TG 為兩個傳送管道，不能直接讀取或鏡像手機 Telegram 通知。

iPhone／iPad 的主畫面 Web App 自 iOS／iPadOS 16.4 支援 Web Push，需使用者操作觸發授權；不同裝置及瀏覽器仍要分別驗收。
目前約 30 位工班使用者與 5 位管理員，先沿用 TG 較省維護；若要不裝 Telegram 也收通知，再單獨規劃網站推播。本輪僅完成評估，未加新訂閱欄位或推播 API。

來源：[WebKit 主畫面 Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)、[MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)、[Telegram FAQ](https://www.telegram.org/faq)。
