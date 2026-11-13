# Git／Vercel 部署準備

## 2026-11-13 實際部署狀態

- 新版 Vercel 專案：`mmm-v2`；正式網址：`https://mmm-v2.vercel.app`。
- 正式部署分支：`release/material-management-v2`；已部署提交 `e316759`，Vercel 顯示 Ready，首頁登入入口正常。
- 舊專案 `mmm` 的 Production 仍使用 `main` 的 `35a38fc`；原正式網址及部署未切換。
- 新版 Production 已設定 17 組 Secret，使用本機的新 Sheets 資料庫設定；登入、材料確認及 Cron 三組密鑰另外產生。Preview 未匯入這批設定。
- 首次雲端安裝失敗 `npm Invalid Version` 已修復：鎖檔一筆缺少版本的 optional 套件紀錄及其 WASM 相依資料由 npm 重新解析，隔離解析與 `npm ci --dry-run` 通過，雲端完整編譯及部署成功。
- 已取得使用者確認，在既有 Google OAuth 用戶端新增 `https://mmm-v2.vercel.app/api/auth/callback/google`，Google 顯示已儲存；原本兩筆重新導向 URI 均保留。設定傳播後 `redirect_uri_mismatch` 消失，已使用目前瀏覽器的 Google 帳號完成管理員登入，管理工作總覽、案件管理（目前日期範圍 6 張需求）、建立需求頁的 182 種材料及工班名單均成功讀取。未建立或修改需求、未觸發報表匯出或人工 Telegram 通知；寫入、匯出及通知收件仍待正式驗收。
- 本次匯入介面的工具紀錄曾回顯部分密鑰，已告知使用者。相關憑證仍待協調輪替；若與舊站共用，必須同步更新，避免中斷舊站。

這份文件更新僅為交接紀錄，尚未提交；不影響已部署版本。

## 2026-11-13 整理紀錄

已建立根目錄「待刪除」，收納 462 個檔案，共 85,618,806 bytes（約 81.7 MiB），沒有直接刪除檔案。完整原路徑、移入位置與數量見本機 `待刪除/移動清單.csv`。

- `.vs`：原本被 Git 追蹤的 Visual Studio 使用者狀態與快取；下一次提交須包含原位置的刪除。
- `.codex-attachments`、`.impeccable`：本機附件與設計工具狀態。
- `整理案件階段用途1-36.pdf`：歷史需求原始附件，保留在本機待刪除資料夾。
- `.tools` 內的舊相容程式、遷移快照、原始報價與匯入資料、歷次 UI 截圖及測試產物。

保留所有現行 `app`、`components`、`lib`、`tests`、`scripts`、`public` 與 `assets/report-templates`。`docs` 的規格、驗收證據及根目錄原始計畫文字檔繼續保留，避免失去維護依據。

`.tools/artifact`、`.tools/template-source`、`.tools/xls-reader` 與根層工具仍被測試及報表範本重建腳本使用，因此保留在原位；它們原本就不提交 Git。`node_modules`、`.next` 及 TypeScript 快取也留在原位並忽略，仍供本機開發使用。

歷史文件提到的 `.tools/<歷次驗證目錄>`，現在可在 `待刪除/.tools/<相同目錄>` 找到；歷史 PDF 則在 `待刪除/整理案件階段用途1-36.pdf`。這些檔案包含私有原始資料，不能上傳公開儲存庫。待刪除資料夾已排除 Git、Vercel CLI 上傳、TypeScript 及 ESLint。

## Git

本次整理後驗證：`npm test` 84 項通過、`npm run lint` 通過、`npm run build` 通過。首次編譯在沙箱遭遇 `spawn EPERM`；以允許建立子程序的環境重跑後，TypeScript、靜態頁面產生與正式編譯完整完成。另已比對移動清單的檔案數與總 bytes，確認收納完整，並確認 TypeScript／ESLint 排除待刪除資料夾。

目前專案已有 Git 紀錄，整理時沒有設定遠端、提交或推送。建議建立私人儲存庫。

1. 先檢查 `git status` 與差異，包含既有尚未提交的功能修改；不要只提交本次整理檔案而漏掉目前程式依賴的新檔案。
2. `git add -A` 後用 `git diff --cached --stat`、`git diff --cached --name-only` 檢查內容，確認包含 `.vs` 原位置的刪除，且不包含 `.env.local`、`.env.sentry-build-plugin`、`.tools` 或「待刪除」。保留 `AGENTS.md`。
3. 完成檢查後提交，設定自己的遠端儲存庫並推送目前分支。不要強制推送。

`.env.example` 是新增的空值設定範本，可提交；真實密鑰仍留在本機 `.env.local`，部署時透過 Vercel Environment Variables 設定。忽略規則不會移除舊 Git 歷史中的檔案。

## Vercel 新專案

1. 在既有帳號選 Add New → Project，匯入本專案的 Git 儲存庫，建立另一個專案，不要覆蓋既有網站。
2. Framework 使用 Next.js；Root Directory 為本專案根目錄；Build Command 為 `npm run build`，Output Directory 使用框架預設值，不填 `out`。依鎖檔安裝相依套件。
3. 依 `.env.example` 與 README 設定 Production 環境變數；`NEXTAUTH_URL` 改為新網站完整 HTTPS 網址。Google OAuth 的重新導向 URI 加入 `https://你的網域/api/auth/callback/google`。
4. Google Sheet 使用既有 Schema 3 資料庫，授權服務帳號編輯；設定 Redis、確認簽章與通知需要的密鑰。不要在部署時重新執行資料搬移。
5. 如需上傳 Sentry source maps，在 Vercel 安全設定 `SENTRY_AUTH_TOKEN`；本機 `.env.sentry-build-plugin` 不上傳。
6. Preview 環境使用獨立測試 Sheet／Redis／通知設定及相符的 OAuth 網址，避免預覽網站修改正式業務資料。
7. 部署完成後驗證真人 Google 登入、白名單角色、報表下載、受控測試需求與 Telegram 收件，再供正式使用。本機編譯與模擬測試不代表這些外部整合已驗收。

`vercel.json` 已有每日排程 `0 1 * * *`（UTC 01:00，台灣 09:00）。Hobby 支援每日排程，但可能在該小時內執行，不能視為精準 09:00。請設定 `CRON_SECRET`。

## 免費方案與第二個網站

2026-11-13 查證：Hobby 可建立最多 200 個專案，因此同一帳號已有網站仍可新增專案；各專案不會各自獲得一整份獨立帳號額度。個人、非商業用途可使用 Hobby；若用於公司實際維運，應依 Vercel 條款選擇合適的商業方案。

- [Vercel 專案數量與用量限制](https://vercel.com/docs/limits)
- [Hobby 方案](https://vercel.com/docs/plans/hobby)
- [服務條款](https://vercel.com/legal/terms)
- [Cron 用量與精準度](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing)
