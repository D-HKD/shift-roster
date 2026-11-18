# 搬 Firestore 去亞洲區

## 為什麼要搬

量度結果（香港 → 服務）：

| 目標 | 延遲 |
|---|---|
| 天文台 API（香港） | **19 ms** |
| 你現在的 Firestore | **184 ms** |
| 美國基準服務 | 265 ms |

184 ms 代表資料庫在**美國**（`us-central1` 或 `nam5`）。
搬到亞洲（`asia-east1` 台灣／`asia-southeast1` 新加坡）大約會變成 30–60 ms。

## 硬限制

> Firestore 資料庫的 **region 建立後不能修改**。
> 沒有「搬 region」功能，只可以**新建資料庫 + 把資料倒過去**。

香港沒有 region 可選，最近的是：

- `asia-east1`（台灣）— 建議，距香港最近
- `asia-southeast1`（新加坡）

以下流程用**新專案**（Console 操作，唔需要裝任何工具）。

## 你要做的（約 10 分鐘）

### 1. 建立新專案

1. 去 https://console.firebase.google.com/ → **新增專案**
2. 名稱隨意（例如 `daniel-shift-hk`），Google Analytics 可以停用

### 2. 建立 Firestore（亞洲區）

1. 左邊選 **Firestore Database** → **建立資料庫**
2. 位置選 **asia-east1（台灣）**
3. 模式選 **正式模式**（Production mode）

### 3. 開啟 Google 登入

1. **Authentication** → **Sign-in method** → 啟用 **Google**
2. **Authentication → Settings → Authorized domains** → 加入 `d-hkd.github.io`

### 4. 加入 Web App，抄 config

1. 專案設定（齒輪）→ **一般** → 下方「你的應用程式」→ **新增應用程式** → 選 `</>`（Web）
2. 抄下 `firebaseConfig` 整個物件（apiKey / authDomain / projectId / …）

### 5. 貼上臨時 Rules（搬完會收緊）

Firestore → **規則** → 貼上以下內容 → **發布**：

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rosters/{year} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

> 這是臨時開放「任何已登入者可寫」，只為完成搬遷。搬完之後會立即收緊成你一個 UID。

### 6. 執行搬遷工具

1. 開 **https://d-hkd.github.io/shift-roster/migrate.html**
2. 貼上第 4 步抄到的 config → 按 **儲存設定**
3. 按 **以 Google 登入新專案**（用你原本那個 Google 帳戶）
4. 頁面會顯示你**新專案的 UID**，請抄下
5. 按 **開始搬遷 2026 + 2027**
6. 見到 `✅ 完成` 同驗證數字（2026 應為 78 日、2027 應為 118 日）就成功

### 7. 話我知

把以下兩樣給我：

- 第 4 步的 **config**
- 第 6 步的 **新 UID**

我會幫你：

- 更新 `assets/firebase-config.js`（新 config + 新 ADMIN_UID）
- 更新 `firestore.rules`（收緊成只有你一個 UID 可寫）
- 刪除 `migrate.html`（避免公開）
- 部署並驗證

### 8. 最後一步（你做）

Firebase Console → Firestore → 規則 → 貼上我更新後的 `firestore.rules` 內容 → **發布**。

之後打開網站，用 Google 登入，改一日測試。

## 風險與注意

- **新專案 UID 會同舊專案唔同**（同一 Google 帳戶，不同專案 = 不同 UID），所以一定要更新 `ADMIN_UID`。
- 搬遷期間**舊網站照用**，唔會停；切換只需要改 `firebase-config.js` 再部署。
- 舊專案資料**唔會自動刪除**，可以保留作備份（免費額度足夠）。
- 如果第 7 步之後發現有問題，把 `firebase-config.js` 改回舊 config 就即刻還原。
