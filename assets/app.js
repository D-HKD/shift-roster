import { firebaseConfig, ADMIN_UID } from "./firebase-config.js";

const $ = (selector) => document.querySelector(selector);
const months = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

const shiftInfo = {
  A: { name: "A 更 · 早更", start: "07:30", end: "17:06", className: "a" },
  B: { name: "B 更 · 下午更", start: "15:30", end: "01:06", className: "b" },
  C: { name: "C 更 · 夜更", start: "22:30", end: "08:06", className: "c" },
  E: { name: "E 更 · 日更", start: "08:30", end: "18:06", className: "e" },
  OFF: { name: "休息日", start: "", end: "", className: "off" }
};

const configured = ["apiKey", "authDomain", "projectId", "appId"].every(
  (key) => firebaseConfig[key] && !firebaseConfig[key].includes("PASTE")
);
const validOwner = ADMIN_UID && !ADMIN_UID.includes("PASTE_YOUR");
const now = new Date();
const state = {
  year: now.getFullYear(),
  month: now.getMonth(),
  selectedKey: dateKey(now),
  days: {},
  mode: configured ? "cloud" : "demo",
  user: null,
  isOwner: false,
  firebase: null,
  unsubscribe: null
};

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(key, withYear = true) {
  const date = parseKey(key);
  return `${withYear ? `${date.getFullYear()}年` : ""}${date.getMonth() + 1}月${date.getDate()}日`;
}

function createDemoSchedule(year) {
  const schedule = {};
  const rotation = ["A", "A", "B", "B", "C", "C", "OFF", "OFF", "E"];
  const cursor = new Date(year, 0, 1);
  let index = (year * 3) % rotation.length;
  while (cursor.getFullYear() === year) {
    const type = rotation[index % rotation.length];
    const defaults = shiftInfo[type];
    schedule[dateKey(cursor)] = { type, start: defaults.start, end: defaults.end, note: "" };
    cursor.setDate(cursor.getDate() + 1);
    index += 1;
  }
  return schedule;
}

function getDay(key) {
  return state.days[key] || null;
}

function selectedDay() {
  return getDay(state.selectedKey);
}

function timeText(day) {
  if (!day || day.type === "OFF") return day?.type === "OFF" ? "全日休息" : "尚未設定更份";
  if (!day.start || !day.end) return "時間待定";
  return `${day.start} — ${day.end}`;
}

function updateStatus(message, variant = "") {
  const status = $("#sync-status");
  status.className = `sync-status ${variant}`;
  status.innerHTML = '<span class="status-dot"></span>';
  status.append(document.createTextNode(` ${message}`));
}

function authErrorText(error) {
  if (error?.code === "auth/unauthorized-domain") {
    return "此網站網域尚未在 Firebase 授權。請確認已加入 d-hkd.github.io。";
  }
  return `Google 登入未能完成（${error?.code || "unknown"}）。請再試一次。`;
}

function renderYearSelect() {
  const select = $("#year-select");
  select.replaceChildren();
  const firstYear = Math.min(now.getFullYear() - 2, state.year - 2);
  const lastYear = Math.max(now.getFullYear() + 5, state.year + 2);
  for (let year = firstYear; year <= lastYear; year += 1) {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = `${year}年`;
    option.selected = year === state.year;
    select.append(option);
  }
}

function renderMonthTabs() {
  const container = $("#month-tabs");
  container.replaceChildren();
  months.forEach((month, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `month-tab${index === state.month ? " active" : ""}`;
    button.textContent = month.replace("月", "");
    button.setAttribute("role", "tab");
    button.setAttribute("aria-label", month);
    button.setAttribute("aria-selected", String(index === state.month));
    button.addEventListener("click", () => {
      state.month = index;
      const selected = parseKey(state.selectedKey);
      if (selected.getFullYear() !== state.year || selected.getMonth() !== state.month) {
        state.selectedKey = dateKey(new Date(state.year, state.month, 1));
      }
      render();
    });
    container.append(button);
  });
}

function renderCalendar() {
  $("#calendar-title").textContent = `${state.year}年 ${months[state.month]}`;
  const grid = $("#calendar-grid");
  grid.replaceChildren();
  const first = new Date(state.year, state.month, 1);
  const monthLength = new Date(state.year, state.month + 1, 0).getDate();
  const totalCells = Math.ceil((first.getDay() + monthLength) / 7) * 7;
  const counts = { A: 0, B: 0, C: 0, E: 0, OFF: 0 };

  for (let index = 0; index < totalCells; index += 1) {
    const dayNumber = index - first.getDay() + 1;
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "calendar-day";
    if (dayNumber < 1 || dayNumber > monthLength) {
      cell.classList.add("blank");
      cell.tabIndex = -1;
      grid.append(cell);
      continue;
    }

    const date = new Date(state.year, state.month, dayNumber);
    const key = dateKey(date);
    const day = getDay(key);
    if (key === state.selectedKey) cell.classList.add("is-selected");
    if (key === dateKey(now)) cell.classList.add("is-today");
    if (day?.type === "OFF") cell.classList.add("off-day");
    if (day?.type) counts[day.type] += 1;
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-label", `${formatDate(key)}，${day ? shiftInfo[day.type].name : "未編排"}`);

    const number = document.createElement("span");
    number.className = "day-number";
    number.textContent = dayNumber;
    cell.append(number);
    if (day) {
      const shift = document.createElement("span");
      shift.className = "day-shift";
      const code = document.createElement("span");
      code.className = `shift-code ${shiftInfo[day.type].className}`;
      code.textContent = day.type === "OFF" ? "休" : day.type;
      const time = document.createElement("span");
      time.className = "shift-time";
      time.textContent = day.type === "OFF" ? "休息" : timeText(day);
      shift.append(code, time);
      cell.append(shift);
    }
    cell.addEventListener("click", () => {
      state.selectedKey = key;
      render();
    });
    grid.append(cell);
  }

  const summary = $("#calendar-summary");
  summary.replaceChildren();
  ["A", "B", "C", "E", "OFF"].forEach((type) => {
    if (!counts[type]) return;
    const item = document.createElement("span");
    item.className = "summary-item";
    const pill = document.createElement("b");
    pill.className = "summary-pill";
    pill.textContent = type === "OFF" ? "休" : type;
    item.append(pill, document.createTextNode(`${counts[type]}日`));
    summary.append(item);
  });
}

function renderDetails() {
  const day = selectedDay();
  const date = parseKey(state.selectedKey);
  $("#detail-date").textContent = formatDate(state.selectedKey);
  $("#detail-weekday").textContent = weekdays[date.getDay()];
  const visual = $("#detail-shift-visual");
  const letter = visual.querySelector(".detail-shift-letter");
  if (!day) {
    visual.className = "detail-shift-visual is-empty";
    letter.textContent = "—";
    $("#detail-shift-name").textContent = "未編排";
    $("#detail-shift-time").textContent = "尚未設定更份";
    $("#detail-note").textContent = "這天暫時未有工作安排。";
  } else {
    visual.className = `detail-shift-visual ${shiftInfo[day.type].className}`;
    letter.textContent = day.type === "OFF" ? "休" : day.type;
    $("#detail-shift-name").textContent = shiftInfo[day.type].name;
    $("#detail-shift-time").textContent = timeText(day);
    $("#detail-note").textContent = day.note?.trim() || (day.type === "OFF" ? "好好休息。" : "沒有額外備註。");
  }
  $("#editor-date").textContent = `${formatDate(state.selectedKey)} · ${weekdays[date.getDay()]}`;
}

function renderToday() {
  $("#today-date").textContent = `${now.getMonth() + 1}/${now.getDate()}`;
  const today = getDay(dateKey(now));
  const chip = $("#today-shift");
  chip.textContent = today ? (today.type === "OFF" ? "休息日" : `${today.type} 更`) : "未編排";
  chip.classList.toggle("muted", !today);
}

function renderEditor() {
  const form = $("#editor-form");
  form.hidden = !state.isOwner;
  $("#sign-in").hidden = Boolean(state.user);
  $("#sign-out").hidden = !state.user;
  const message = $("#admin-message");
  if (!configured) {
    message.textContent = "目前為示範模式。完成 Firebase 設定後，只有你的帳戶可編輯，其他人只可瀏覽。";
  } else if (!state.user) {
    message.textContent = "登入已授權的 Google 帳戶後，便可以編輯及發布更表。";
  } else if (!validOwner) {
    message.textContent = `已登入。請把以下 UID 貼到 firebase-config.js，再重新發布：${state.user.uid}`;
  } else if (!state.isOwner) {
    message.textContent = "這個帳戶只有檢視權限。請以設定檔內指定的管理員帳戶登入。";
  } else {
    message.textContent = `已登入為管理員：${state.user.displayName || state.user.email || "你的帳戶"}`;
    const day = selectedDay() || { type: "A", ...shiftInfo.A, note: "" };
    $("#edit-type").value = day.type;
    $("#edit-start").value = day.start || "";
    $("#edit-end").value = day.end || "";
    $("#edit-note").value = day.note || "";
  }
}

function render() {
  renderYearSelect();
  renderMonthTabs();
  renderCalendar();
  renderDetails();
  renderToday();
  renderEditor();
}

async function subscribeRoster() {
  if (!state.firebase) return;
  state.unsubscribe?.();
  updateStatus("正在載入…");
  const { db, doc, onSnapshot } = state.firebase;
  state.unsubscribe = onSnapshot(doc(db, "rosters", String(state.year)), (snapshot) => {
    state.days = snapshot.exists() ? (snapshot.data().days || {}) : {};
    updateStatus(snapshot.metadata.fromCache ? "離線快取" : "已同步", "live");
    render();
  }, (error) => {
    console.error("Could not load roster:", error);
    state.days = {};
    updateStatus("未能讀取資料", "error");
    render();
  });
}

async function switchYear(year) {
  state.year = year;
  state.selectedKey = dateKey(new Date(year, state.month, 1));
  if (state.mode === "demo") {
    state.days = createDemoSchedule(year);
    render();
  } else {
    await subscribeRoster();
  }
}

async function startFirebase() {
  try {
    const [{ initializeApp }, firestore, auth] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js")
    ]);
    const app = initializeApp(firebaseConfig);
    const db = firestore.getFirestore(app);
    const authInstance = auth.getAuth(app);
    state.firebase = { ...firestore, ...auth, db, authInstance };
    state.mode = "cloud";
    auth.onAuthStateChanged(authInstance, (user) => {
      state.user = user;
      state.isOwner = Boolean(user && validOwner && user.uid === ADMIN_UID);
      renderEditor();
    });
    await subscribeRoster();
  } catch (error) {
    console.error("Firebase initialisation failed:", error);
    state.mode = "demo";
    state.days = createDemoSchedule(state.year);
    updateStatus("設定需要檢查", "error");
    render();
  }
}

async function signIn() {
  if (!state.firebase) return;
  const { GoogleAuthProvider, signInWithPopup, authInstance } = state.firebase;
  try {
    $("#admin-message").textContent = "正在開啟 Google 登入…";
    const result = await signInWithPopup(authInstance, new GoogleAuthProvider());
    state.user = result.user;
    state.isOwner = Boolean(validOwner && result.user.uid === ADMIN_UID);
    renderEditor();
  } catch (error) {
    console.error("Sign in failed:", error);
    $("#admin-message").textContent = authErrorText(error);
  }
}

async function signOut() {
  if (state.firebase) await state.firebase.signOut(state.firebase.authInstance);
}

async function saveDay(event) {
  event.preventDefault();
  if (!state.isOwner || !state.firebase) return;
  const save = $("#save-day");
  save.disabled = true;
  save.textContent = "正在發布…";
  const type = $("#edit-type").value;
  const defaults = shiftInfo[type];
  const day = {
    type,
    start: type === "OFF" ? "" : ($("#edit-start").value || defaults.start),
    end: type === "OFF" ? "" : ($("#edit-end").value || defaults.end),
    note: $("#edit-note").value.trim()
  };
  try {
    const { doc, setDoc, serverTimestamp, db } = state.firebase;
    await setDoc(doc(db, "rosters", String(state.year)), {
      year: state.year,
      days: { ...state.days, [state.selectedKey]: day },
      updatedAt: serverTimestamp(),
      updatedBy: state.user.uid
    });
    $("#admin-message").textContent = "已發布。其他瀏覽者會自動看到更新。";
  } catch (error) {
    console.error("Save failed:", error);
    $("#admin-message").textContent = "未能儲存。請檢查 Firestore 安全規則中的管理員 UID 是否正確。";
  } finally {
    save.disabled = false;
    save.textContent = "儲存並發布";
  }
}

async function clearDay() {
  if (!state.isOwner || !state.firebase) return;
  if (!window.confirm(`確定清除 ${formatDate(state.selectedKey)} 的編排？`)) return;
  const clear = $("#clear-day");
  clear.disabled = true;
  try {
    const { [state.selectedKey]: removed, ...nextDays } = state.days;
    const { doc, setDoc, serverTimestamp, db } = state.firebase;
    await setDoc(doc(db, "rosters", String(state.year)), {
      year: state.year,
      days: nextDays,
      updatedAt: serverTimestamp(),
      updatedBy: state.user.uid
    });
  } catch (error) {
    console.error("Clear failed:", error);
    $("#admin-message").textContent = "未能清除編排。請檢查你的管理員設定。";
  } finally {
    clear.disabled = false;
  }
}

function applyShiftPreset(type) {
  const defaults = shiftInfo[type];
  $("#edit-start").value = defaults.start;
  $("#edit-end").value = defaults.end;
}

function registerEvents() {
  $("#previous-year").addEventListener("click", () => switchYear(state.year - 1));
  $("#next-year").addEventListener("click", () => switchYear(state.year + 1));
  $("#year-select").addEventListener("change", (event) => switchYear(Number(event.target.value)));
  $("#admin-toggle").addEventListener("click", () => {
    const panel = $("#admin-panel");
    panel.hidden = false;
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("#sign-in").addEventListener("click", signIn);
  $("#sign-out").addEventListener("click", signOut);
  $("#editor-form").addEventListener("submit", saveDay);
  $("#clear-day").addEventListener("click", clearDay);
  $("#edit-type").addEventListener("change", (event) => applyShiftPreset(event.target.value));
}

registerEvents();
state.days = createDemoSchedule(state.year);
render();
if (configured) startFirebase();
