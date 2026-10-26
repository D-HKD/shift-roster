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

const hkHolidaySource = "https://www.1823.gov.hk/common/ical/tc.json";
const hkoWeatherSource = "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=fnd&lang=tc";
const themeStorageKey = "private-shift-roster-theme";
const fallbackPublicHolidays = {
  "2025-01-01": "一月一日", "2025-01-29": "農曆年初一", "2025-01-30": "農曆年初二", "2025-01-31": "農曆年初三",
  "2025-04-04": "清明節", "2025-04-18": "耶穌受難節", "2025-04-19": "耶穌受難節翌日", "2025-04-21": "復活節星期一",
  "2025-05-01": "勞動節", "2025-05-05": "佛誕", "2025-05-31": "端午節", "2025-07-01": "香港特別行政區成立紀念日",
  "2025-10-01": "國慶日", "2025-10-07": "中秋節翌日", "2025-10-29": "重陽節", "2025-12-25": "聖誕節", "2025-12-26": "聖誕節後第一個周日",
  "2026-01-01": "一月一日", "2026-02-17": "農曆年初一", "2026-02-18": "農曆年初二", "2026-02-19": "農曆年初三",
  "2026-04-03": "耶穌受難節", "2026-04-04": "耶穌受難節翌日", "2026-04-06": "清明節翌日", "2026-04-07": "復活節星期一翌日",
  "2026-05-01": "勞動節", "2026-05-25": "佛誕翌日", "2026-06-19": "端午節", "2026-07-01": "香港特別行政區成立紀念日",
  "2026-09-26": "中秋節翌日", "2026-10-01": "國慶日", "2026-10-19": "重陽節翌日", "2026-12-25": "聖誕節", "2026-12-26": "聖誕節後第一個周日",
  "2027-01-01": "一月一日", "2027-02-06": "農曆年初一", "2027-02-08": "農曆年初三", "2027-02-09": "農曆年初四",
  "2027-03-26": "耶穌受難節", "2027-03-27": "耶穌受難節翌日", "2027-03-29": "復活節星期一", "2027-04-05": "清明節",
  "2027-05-01": "勞動節", "2027-05-13": "佛誕", "2027-06-09": "端午節", "2027-07-01": "香港特別行政區成立紀念日",
  "2027-09-16": "中秋節翌日", "2027-10-01": "國慶日", "2027-10-08": "重陽節", "2027-12-25": "聖誕節", "2027-12-27": "聖誕節後第一個周日"
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
  unsubscribe: null,
  publicHolidays: { ...fallbackPublicHolidays }
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

function shortItems(items) {
  const list = Array.isArray(items) ? items : [items];
  return list.filter(Boolean).slice(0, 5).join(" · ") || "暫無資料";
}

function getLunarInfo(key) {
  try {
    const Solar = window.Solar;
    if (!Solar?.fromYmd) return null;
    const date = parseKey(key);
    const lunar = Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate()).getLunar();
    const lunarMonth = lunar.getMonthInChinese?.() || "";
    const lunarDay = lunar.getDayInChinese?.() || "";
    const heavenlyType = lunar.getDayTianShenType?.() || "";
    const heavenlyLuck = lunar.getDayTianShenLuck?.() || "";
    return {
      label: lunarMonth && lunarDay ? `農${lunarMonth}月${lunarDay}` : "農曆",
      isAuspicious: heavenlyType === "黃道" || heavenlyLuck === "吉",
      yi: shortItems(lunar.getDayYi?.()),
      ji: shortItems(lunar.getDayJi?.())
    };
  } catch (error) {
    console.warn("Could not read lunar almanac data:", error);
    return null;
  }
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

function getPublicHoliday(key) {
  return state.publicHolidays[key] || null;
}

async function loadPublicHolidays() {
  try {
    const response = await fetch(hkHolidaySource, { cache: "no-store" });
    if (!response.ok) throw new Error(`Holiday data returned ${response.status}`);
    const data = await response.json();
    const events = data?.vcalendar?.[0]?.vevent || [];
    const officialHolidays = Object.fromEntries(events.flatMap((event) => {
      const rawDate = Array.isArray(event?.dtstart) ? event.dtstart[0] : "";
      if (typeof rawDate !== "string" || !/^\d{8}$/.test(rawDate)) return [];
      const key = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
      return [[key, String(event.summary || "公眾假期")]];
    }));
    state.publicHolidays = { ...fallbackPublicHolidays, ...officialHolidays };
    render();
  } catch (error) {
    console.warn("Could not refresh Hong Kong public holidays:", error);
  }
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

function weatherVisualType(description = "") {
  if (/雷暴/.test(description)) return "storm";
  if (/雨|驟雨/.test(description)) return "rain";
  if (/霧/.test(description)) return "fog";
  if (/雲/.test(description)) return "cloud";
  if (/晴|陽光/.test(description)) return "sun";
  return "partly";
}

function applyWeatherBackdrop(type) {
  document.documentElement.dataset.weather = type;
}

function forecastKey(rawDate) {
  if (typeof rawDate !== "string" || !/^\d{8}$/.test(rawDate)) return "";
  return `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
}

function renderWeatherForecast(forecasts) {
  const grid = $("#weather-grid");
  grid.replaceChildren();
  forecasts.forEach((forecast) => {
    const key = forecastKey(forecast.forecastDate);
    const card = document.createElement("article");
    const weatherType = weatherVisualType(forecast.forecastWeather);
    card.className = `weather-day weather-${weatherType}`;
    if (key === dateKey(now)) card.classList.add("is-today");
    const date = key ? parseKey(key) : null;
    const weekday = document.createElement("span");
    weekday.className = "weather-weekday";
    weekday.textContent = date ? weekdays[date.getDay()].replace("星期", "週") : "--";
    const day = document.createElement("span");
    day.className = "weather-date";
    day.textContent = date ? `${date.getMonth() + 1}/${date.getDate()}` : "--";
    const temperature = document.createElement("span");
    temperature.className = "weather-temp";
    temperature.textContent = `${forecast.forecastMintemp?.value ?? "--"}° — ${forecast.forecastMaxtemp?.value ?? "--"}°`;
    const rain = document.createElement("span");
    rain.className = "weather-rain";
    rain.textContent = `雨量 ${forecast.PSR ?? forecast.forecastPsr ?? "--"}`;
    const description = document.createElement("span");
    description.className = "weather-desc";
    description.textContent = forecast.forecastWeather || "天氣預報";
    card.append(weekday, day, temperature, rain, description);
    grid.append(card);
  });
}

async function loadWeatherForecast() {
  const status = $("#weather-status");
  try {
    const response = await fetch(hkoWeatherSource, { cache: "no-store" });
    if (!response.ok) throw new Error(`Weather data returned ${response.status}`);
    const data = await response.json();
    const forecasts = Array.isArray(data.weatherForecast) ? data.weatherForecast.slice(0, 7) : [];
    if (!forecasts.length) throw new Error("No weather forecast was returned");
    const todayForecast = forecasts.find((forecast) => forecastKey(forecast.forecastDate) === dateKey(now)) || forecasts[0];
    applyWeatherBackdrop(weatherVisualType(todayForecast.forecastWeather));
    renderWeatherForecast(forecasts);
    status.textContent = "香港天文台・已更新";
  } catch (error) {
    console.warn("Could not load Hong Kong weather forecast:", error);
    $("#weather-grid").innerHTML = '<p class="weather-error">暫時未能讀取天氣資料，請稍後重新整理。</p>';
    status.textContent = "暫未能更新";
  }
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  $("#theme-icon").textContent = isDark ? "☀" : "☾";
  $("#theme-label").textContent = isDark ? "淺色" : "深色";
  $("#theme-toggle").setAttribute("aria-label", isDark ? "切換淺色模式" : "切換深色模式");
  try { localStorage.setItem(themeStorageKey, isDark ? "dark" : "light"); } catch { /* storage unavailable */ }
}

function initialiseTheme() {
  let savedTheme = "";
  try { savedTheme = localStorage.getItem(themeStorageKey) || ""; } catch { /* storage unavailable */ }
  const systemPrefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  applyTheme(savedTheme || (systemPrefersDark ? "dark" : "light"));
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
  let holidayCount = 0;
  let noteCount = 0;

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
    const holiday = getPublicHoliday(key);
    const lunar = getLunarInfo(key);
    const hasNote = Boolean(day?.note?.trim());
    if (key === state.selectedKey) cell.classList.add("is-selected");
    if (key === dateKey(now)) cell.classList.add("is-today");
    if (day?.type === "OFF") cell.classList.add("off-day");
    if (hasNote) {
      cell.classList.add("has-note");
      noteCount += 1;
    }
    if (holiday) {
      cell.classList.add("is-public-holiday");
      holidayCount += 1;
    }
    if (day?.type) counts[day.type] += 1;
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-label", `${formatDate(key)}，${holiday ? `紅日：${holiday}，` : ""}${hasNote ? "有備註，" : ""}${lunar?.isAuspicious ? "黃道吉日，" : ""}${day ? shiftInfo[day.type].name : "未編排"}`);

    const number = document.createElement("span");
    number.className = "day-number";
    number.textContent = dayNumber;
    cell.append(number);
    if (hasNote) {
      const noteIndicator = document.createElement("span");
      noteIndicator.className = "note-indicator";
      noteIndicator.title = "此日有備註";
      noteIndicator.setAttribute("aria-label", "此日有備註");
      cell.append(noteIndicator);
    }
    if (lunar) {
      const lunarDay = document.createElement("span");
      lunarDay.className = `lunar-day${lunar.isAuspicious ? " is-auspicious" : ""}`;
      lunarDay.textContent = `${lunar.label}${lunar.isAuspicious ? " · 吉" : ""}`;
      lunarDay.title = lunar.isAuspicious ? "傳統黃曆：黃道吉日" : "傳統農曆日期";
      cell.append(lunarDay);
    }
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
  if (holidayCount) {
    const item = document.createElement("span");
    item.className = "summary-item holiday-summary";
    const pill = document.createElement("b");
    pill.className = "summary-pill";
    pill.textContent = "紅";
    item.append(pill, document.createTextNode(`${holidayCount}日`));
    summary.append(item);
  }
  if (noteCount) {
    const item = document.createElement("span");
    item.className = "summary-item";
    const pill = document.createElement("b");
    pill.className = "summary-pill";
    pill.textContent = "備";
    item.append(pill, document.createTextNode(`${noteCount}日`));
    summary.append(item);
  }
}

function renderDetails() {
  const day = selectedDay();
  const date = parseKey(state.selectedKey);
  $("#detail-date").textContent = formatDate(state.selectedKey);
  $("#detail-weekday").textContent = weekdays[date.getDay()];
  const holiday = getPublicHoliday(state.selectedKey);
  const holidayText = $("#detail-holiday");
  holidayText.hidden = !holiday;
  holidayText.textContent = holiday ? `紅日 · ${holiday}` : "";
  const lunar = getLunarInfo(state.selectedKey);
  const almanac = $("#lunar-almanac");
  almanac.hidden = !lunar;
  if (lunar) {
    $("#lunar-date").textContent = `${lunar.label} · 傳統黃曆`;
    const luck = $("#lunar-luck");
    luck.textContent = lunar.isAuspicious ? "黃道 · 吉" : "黃曆參考";
    luck.classList.toggle("is-caution", !lunar.isAuspicious);
    $("#lunar-yi").textContent = lunar.yi;
    $("#lunar-ji").textContent = lunar.ji;
  }
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
  $("#theme-toggle").addEventListener("click", () => {
    applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });
}

initialiseTheme();
registerEvents();
state.days = createDemoSchedule(state.year);
render();
void loadPublicHolidays();
void loadWeatherForecast();
if (configured) startFirebase();
