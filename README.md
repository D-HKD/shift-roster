# 私人更表

一個可在手機使用的全年更表網頁。朋友或同事打開連結只可以看；只有設定好的 Google 帳戶可以登入、改更份及即時發布。

## 這個版本的架構

```text
你（Google 登入） ──可寫入──> Firebase Firestore <──即時讀取── 瀏覽者
                                      ↑
                               GitHub Pages 網站
```

GitHub Pages 很適合免費託管這個介面，但它只是靜態網站，不能安全地判斷「你是管理員」或讓多人即時看到更改。因此本專案把網站放在 GitHub Pages，將登入、唯一編輯權限及即時資料同步交給 Firebase。Firebase 的網頁設定可以公開；真正保護資料的是 Firestore 安全規則內的管理員 UID。

> 如果只用 GitHub Pages，唯一做法是每次手動修改 JSON／原始碼再推送到 GitHub。那不會讓你在手機上安全登入及即時更新，所以不建議。

## 功能

- 月曆檢視全年 A、B、C、E 更和休息日
- 每日可自訂上班時間、下班時間和備註
- 手機優先、深藍／青綠／金色的自訂公務風格；沒有使用徽章、標誌或官方身分暗示
- 任何拿到連結的人可看，只有一個 Firebase UID 可寫
- 儲存後，其他已開啟網站的人會自動同步
- 未完成 Firebase 設定時會顯示可操作的示範輪班資料，方便預覽介面

## 首次設定 Firebase（約 10 分鐘）

1. 到 [Firebase Console](https://console.firebase.google.com/) 建立一個新專案並新增 **Web app**。複製 Firebase 提供的設定物件。
2. 到 **Authentication → Sign-in method** 啟用 **Google**。在 **Settings → Authorized domains** 加入將來的 GitHub Pages 網域，例如 `你的帳戶.github.io`。
3. 到 **Firestore Database** 建立資料庫。開始時可選 Production mode，資料庫位置選香港／使用者最近的地區即可。
4. 開啟 `assets/firebase-config.js`，填入 Firebase web 設定，但先保留 `ADMIN_UID` 原樣。把網站暫時發布後，用你的 Google 帳戶按「管理員 → 以 Google 登入」。畫面會顯示你的 Firebase UID。
5. 將該 UID 同時貼到以下兩個檔案的 placeholder：
   - `assets/firebase-config.js` 的 `ADMIN_UID`
   - `firestore.rules` 的 UID 字串
6. 在 Firebase Console 的 **Firestore Database → Rules** 貼上 `firestore.rules` 的內容，按 **Publish**；再將修改後的網站推送到 GitHub Pages。

完成後，只有這個 UID 可以建立、修改或刪除年度更表。即使其他人修改了網頁原始碼或知道 Firebase API key，Firestore 仍會拒絕寫入。

## 發布至 GitHub Pages

1. 在 GitHub 建立一個新的 repository，例如 `shift-roster`。
2. 把本資料夾所有檔案上傳／提交到 repository 根目錄。
3. 到 repository 的 **Settings → Pages**，在 **Build and deployment** 選 `Deploy from a branch`，選擇你的主要 branch（通常是 `main`）和 `/(root)`，然後儲存。
4. 等待 GitHub 顯示你的網站網址，例如 `https://你的帳戶.github.io/shift-roster/`。把此網址分享給瀏覽者。
5. 若 Google 登入彈出視窗顯示網域未獲授權，回到 Firebase Authentication 的 **Authorized domains** 加入 `你的帳戶.github.io`，再試一次。

## 日常更新

1. 用手機或電腦打開網站，按右上角「管理員」。
2. 以指定 Google 帳戶登入。
3. 選擇年份、月份和日期，設定更份、時間與備註。
4. 按「儲存並發布」。所有瀏覽者不需要重新安裝 app，也會看到新安排。

預設時間可在畫面內改：A `07:00–15:00`、B `14:30–22:30`、C `22:00–07:00`、E `08:30–17:00`。這些只是起點，請按你的實際更份時間調整。

## 資料結構和限制

- 資料放在 Firestore 的 `rosters/{年份}`，每年一份文件，方便備份和管理。
- 每日資料只有更別、上下班時間和短備註；不應放個人電話、案件資料或其他敏感資料。
- Firestore 免費方案足夠小型個人更表開始使用；請在 Firebase Console 查看實際用量及配額。
- 如日後要換管理員，先把新帳戶 UID 同時換入設定檔和 Firestore Rules，再發布兩邊的更改。

## 本機預覽

直接雙擊 `index.html` 可看示範介面。要測試 Google 登入，請以本機網頁伺服器開啟（例如 VS Code Live Server），並把 `localhost` 保留在 Firebase 的 Authorized domains。
