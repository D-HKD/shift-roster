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

const hkoWeatherSource = "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=fnd&lang=tc";
const hkoCurrentSource = "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=tc";
const hkoWarningSource = "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=warnsum&lang=tc";
const themeStorageKey = "private-shift-roster-theme";
const publicHolidayTable = {
  "2025-01-01": "一月一日",
  "2025-01-29": "農曆年初一",
  "2025-01-30": "農曆年初二",
  "2025-01-31": "農曆年初三",
  "2025-04-04": "清明節",
  "2025-04-18": "耶穌受難節",
  "2025-04-19": "耶穌受難節翌日",
  "2025-04-21": "復活節星期一",
  "2025-05-01": "勞動節",
  "2025-05-05": "佛誕",
  "2025-05-31": "端午節",
  "2025-07-01": "香港特別行政區成立紀念日",
  "2025-10-01": "國慶日",
  "2025-10-07": "中秋節翌日",
  "2025-10-29": "重陽節",
  "2025-12-25": "聖誕節",
  "2025-12-26": "聖誕節後第一個周日",
  "2026-01-01": "一月一日",
  "2026-02-17": "農曆年初一",
  "2026-02-18": "農曆年初二",
  "2026-02-19": "農曆年初三",
  "2026-04-03": "耶穌受難節",
  "2026-04-04": "耶穌受難節翌日",
  "2026-04-06": "清明節翌日",
  "2026-04-07": "復活節星期一翌日",
  "2026-05-01": "勞動節",
  "2026-05-25": "佛誕翌日",
  "2026-06-19": "端午節",
  "2026-07-01": "香港特別行政區成立紀念日",
  "2026-09-26": "中秋節翌日",
  "2026-10-01": "國慶日",
  "2026-10-19": "重陽節翌日",
  "2026-12-25": "聖誕節",
  "2026-12-26": "聖誕節後第一個周日",
  "2027-01-01": "一月一日",
  "2027-02-06": "農曆年初一",
  "2027-02-08": "農曆年初三",
  "2027-02-09": "農曆年初四",
  "2027-03-26": "耶穌受難節",
  "2027-03-27": "耶穌受難節翌日",
  "2027-03-29": "復活節星期一",
  "2027-04-05": "清明節",
  "2027-05-01": "勞動節",
  "2027-05-13": "佛誕",
  "2027-06-09": "端午節",
  "2027-07-01": "香港特別行政區成立紀念日",
  "2027-09-16": "中秋節翌日",
  "2027-10-01": "國慶日",
  "2027-10-08": "重陽節",
  "2027-12-25": "聖誕節",
  "2027-12-27": "聖誕節後第一個周日"
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
  publicHolidays: { ...publicHolidayTable },
  forecasts: [],
  weather: null,
  themePreference: ""
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

/**
 * 天氣場景
 * ---------
 * 把「而家嘅天氣」畫成一個會動嘅背景天空：天色、太陽／月亮、星星、雲、
 * 雨、風、霧、熱浪、寒意。純視覺，唔會影響更表邏輯。
 *
 * 用法：
 *   const scene = createWeatherScene(document.querySelector("#weather-stage"));
 *   scene.update({ phase: "night", kind: "clear", rain: 0, wind: .2, ... });
 */

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function buildStars(host) {
  const count = window.innerWidth < 620 ? 70 : 130;
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < count; index += 1) {
    const star = document.createElement("i");
    star.style.setProperty("--x", `${randomBetween(0, 100).toFixed(2)}%`);
    star.style.setProperty("--y", `${randomBetween(0, 74).toFixed(2)}%`);
    star.style.setProperty("--s", `${randomBetween(0.8, 2.4).toFixed(2)}px`);
    star.style.setProperty("--o", randomBetween(0.35, 0.95).toFixed(2));
    star.style.animationDelay = `-${randomBetween(0, 6).toFixed(2)}s`;
    star.style.animationDuration = `${randomBetween(3.5, 8).toFixed(2)}s`;
    fragment.append(star);
  }
  host.replaceChildren(fragment);
}

function buildClouds(layerHosts) {
  const settings = [
    { count: 5, width: [280, 460], top: [-4, 24], duration: [200, 320], opacity: [0.16, 0.3], blur: [5, 8] },
    { count: 6, width: [190, 320], top: [6, 38], duration: [130, 210], opacity: [0.22, 0.38], blur: [3, 5] },
    { count: 6, width: [110, 230], top: [20, 54], duration: [85, 150], opacity: [0.26, 0.46], blur: [2, 3] }
  ];
  layerHosts.forEach((host, layerIndex) => {
    const config = settings[layerIndex] || settings[1];
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < config.count; index += 1) {
      const cloud = document.createElement("div");
      cloud.className = "ws-cloud";
      const duration = randomBetween(...config.duration);
      cloud.style.setProperty("--w", `${randomBetween(...config.width).toFixed(0)}px`);
      cloud.style.setProperty("--top", `${randomBetween(...config.top).toFixed(1)}%`);
      cloud.style.setProperty("--o", randomBetween(...config.opacity).toFixed(2));
      cloud.style.setProperty("--blur", `${randomBetween(...config.blur).toFixed(1)}px`);
      cloud.style.setProperty("--dur", `${duration.toFixed(0)}s`);
      // 負延遲：載入時雲已經散在天空不同位置，不會全部由左邊一次過飄出來
      cloud.style.setProperty("--delay", `-${randomBetween(0, duration).toFixed(1)}s`);
      fragment.append(cloud);
    }
    host.replaceChildren(fragment);
  });
}

function buildWind(host) {
  const fragment = document.createDocumentFragment();
  const streakCount = window.innerWidth < 620 ? 14 : 22;
  for (let index = 0; index < streakCount; index += 1) {
    const streak = document.createElement("i");
    streak.style.setProperty("--y", `${randomBetween(4, 88).toFixed(1)}%`);
    streak.style.setProperty("--len", `${randomBetween(150, 380).toFixed(0)}px`);
    const duration = randomBetween(1.8, 4);
    streak.style.setProperty("--dur", `${duration.toFixed(2)}s`);
    streak.style.setProperty("--delay", `-${randomBetween(0, duration).toFixed(2)}s`);
    fragment.append(streak);
  }
  for (let index = 0; index < 9; index += 1) {
    const leaf = document.createElement("span");
    leaf.className = "ws-leaf";
    leaf.style.setProperty("--y", `${randomBetween(16, 84).toFixed(1)}%`);
    const duration = randomBetween(4.5, 8);
    leaf.style.setProperty("--dur", `${duration.toFixed(2)}s`);
    leaf.style.setProperty("--delay", `-${randomBetween(0, duration).toFixed(2)}s`);
    fragment.append(leaf);
  }
  host.replaceChildren(fragment);
}

/**
 * 雨：用 canvas 畫，比幾百個 DOM 元素順暢得多。
 * intensity 0 = 停；0.3 = 微雨；1 = 大雨。
 */
function createRain(canvas) {
  const context = canvas.getContext("2d");
  let drops = [];
  let width = 0;
  let height = 0;
  let intensity = 0;
  let slant = 0.18;
  let frameId = 0;
  let lastTime = 0;

  function spawn(anywhere) {
    const speed = 620 + Math.random() * 900 * (0.55 + intensity);
    return {
      x: Math.random() * (width + 160) - 80,
      y: anywhere ? Math.random() * height : -30,
      length: 12 + Math.random() * 24 * (0.5 + intensity),
      speed,
      alpha: 0.22 + Math.random() * 0.46
    };
  }

  function reseed() {
    const area = Math.max(width * height, 1);
    const target = Math.round((area / 4200) * clamp(intensity, 0, 1.4));
    const total = Math.min(Math.max(target, intensity > 0 ? 40 : 0), 700);
    drops = Array.from({ length: total }, (_, index) => spawn(index < total * 0.85));
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth || window.innerWidth;
    height = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    reseed();
  }

  function draw(delta) {
    context.clearRect(0, 0, width, height);
    context.lineCap = "round";
    for (const drop of drops) {
      const fall = drop.speed * delta;
      drop.y += fall;
      drop.x += fall * slant;
      if (drop.y > height + 40) Object.assign(drop, spawn(false));
      if (drop.x > width + 90) drop.x = -80;
      if (drop.x < -90) drop.x = width + 80;
      context.strokeStyle = `rgba(214, 238, 255, ${drop.alpha})`;
      context.lineWidth = 1.35;
      context.beginPath();
      context.moveTo(drop.x, drop.y);
      context.lineTo(drop.x - drop.length * slant, drop.y - drop.length);
      context.stroke();
    }
  }

  function loop(time) {
    const delta = Math.min((time - (lastTime || time)) / 1000, 0.05);
    lastTime = time;
    draw(delta);
    frameId = window.requestAnimationFrame(loop);
  }

  function start() {
    if (frameId) return;
    lastTime = 0;
    frameId = window.requestAnimationFrame(loop);
  }

  function stop() {
    if (!frameId) return;
    window.cancelAnimationFrame(frameId);
    frameId = 0;
    context.clearRect(0, 0, width, height);
  }

  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (intensity > 0 && !prefersReducedMotion()) start();
  });
  resize();

  return {
    set(nextIntensity, wind) {
      intensity = clamp(nextIntensity, 0, 1.4);
      slant = 0.1 + clamp(wind, 0, 1) * 0.55;
      reseed();
      if (intensity <= 0.02 || prefersReducedMotion()) stop();
      else start();
    }
  };
}

function celestialPosition(phase, minutes, sunrise, sunset) {
  const nightLength = 24 * 60 - (sunset - sunrise);
  if (phase === "night") {
    const progress = minutes >= sunset
      ? clamp((minutes - sunset) / nightLength)
      : clamp((minutes + 24 * 60 - sunset) / nightLength);
    return { cx: 80 - 62 * progress, cy: Math.min(22, 68 - 54 * Math.sin(Math.PI * progress)) };
  }
  const progress = clamp((minutes - sunrise) / Math.max(sunset - sunrise, 1));
  return { cx: 13 + 62 * progress, cy: Math.min(23, 70 - 58 * Math.sin(Math.PI * progress)) };
}

function createWeatherScene(stage) {
  if (!stage) return { update() {} };

  stage.innerHTML = `
    <div class="ws-sky"></div>
    <div class="ws-stars"></div>
    <div class="ws-celestial">
      <div class="ws-sun"></div>
      <div class="ws-moon"><i></i><i></i><i></i></div>
    </div>
    <div class="ws-clouds">
      <div class="ws-cloud-layer"></div>
      <div class="ws-cloud-layer"></div>
      <div class="ws-cloud-layer"></div>
    </div>
    <div class="ws-dim"></div>
    <div class="ws-wet"></div>
    <div class="ws-fog"></div>
    <div class="ws-wind"></div>
    <canvas class="ws-rain"></canvas>
    <div class="ws-heat"></div>
    <div class="ws-cold"></div>
    <div class="ws-lightning"></div>
    <div class="ws-veil"></div>
  `;

  buildStars(stage.querySelector(".ws-stars"));
  buildClouds([...stage.querySelectorAll(".ws-cloud-layer")]);
  buildWind(stage.querySelector(".ws-wind"));
  const rain = createRain(stage.querySelector(".ws-rain"));
  const celestial = stage.querySelector(".ws-celestial");

  let lastCondition = null;

  function update(condition = {}) {
    const phase = condition.phase || "day";
    const isNight = phase === "night";
    const stars = isNight
      ? clamp((condition.stars ?? 0.95) * (1 - (condition.dim || 0) * 1.35))
      : phase === "dusk" || phase === "dawn"
        ? clamp(0.22 * (1 - (condition.dim || 0)))
        : 0;

    stage.dataset.phase = phase;
    stage.dataset.kind = condition.kind || "partly";
    stage.dataset.celestial = isNight ? "moon" : "sun";

    stage.style.setProperty("--cloud", String(clamp(condition.cloud ?? 0.4)));
    stage.style.setProperty("--dim", String(clamp(condition.dim ?? 0)));
    stage.style.setProperty("--wet", String(clamp((condition.rain ?? 0) * 0.55)));
    stage.style.setProperty("--fog", String(clamp(condition.fog ?? 0)));
    stage.style.setProperty("--wind", String(clamp(condition.wind ?? 0.2)));
    stage.style.setProperty("--heat", String(clamp(condition.heat ?? 0)));
    stage.style.setProperty("--cold", String(clamp(condition.cold ?? 0)));
    stage.style.setProperty("--stars", stars.toFixed(2));

    // 雲厚到一個程度，日月就會被遮住
    const celestialOpacity = clamp(1.16 - (condition.dim ?? 0) * 2.2 - (condition.cloud ?? 0) * 0.34);
    stage.style.setProperty("--celestial", celestialOpacity.toFixed(2));

    const position = celestialPosition(
      phase,
      condition.minutes ?? 12 * 60,
      condition.sunrise ?? 6 * 60 + 20,
      condition.sunset ?? 18 * 60 + 40
    );
    celestial.style.setProperty("--cx", `${position.cx.toFixed(2)}%`);
    celestial.style.setProperty("--cy", `${position.cy.toFixed(2)}%`);

    document.documentElement.dataset.sky = phase;

    rain.set(condition.rain ?? 0, condition.wind ?? 0.2);
    lastCondition = condition;
    return condition;
  }

  return {
    update,
    get condition() {
      return lastCondition;
    }
  };
}

/* ------------------------------------------------------------------ *
 * 天氣：官方圖示、日夜判斷、背景場景
 * ------------------------------------------------------------------ */

const weatherScene = createWeatherScene(document.querySelector("#weather-stage"));

const WEATHER_LABELS = {
  50: "天晴", 51: "間有陽光", 52: "短暫陽光", 53: "間有陽光及一兩陣驟雨", 54: "短暫陽光及驟雨",
  60: "多雲", 61: "密雲", 62: "微雨", 63: "有雨", 64: "大雨", 65: "雷暴",
  70: "天晴", 71: "天晴", 72: "天晴", 73: "天晴", 74: "天晴", 75: "天晴",
  76: "大致多雲", 77: "大致天晴",
  80: "大風", 81: "乾燥", 82: "潮濕", 83: "有霧", 84: "薄霧", 85: "煙霞",
  90: "炎熱", 91: "和暖", 92: "清涼", 93: "寒冷"
};

const WEATHER_KINDS = {
  50: "clear", 51: "partly", 52: "partly", 53: "shower", 54: "shower",
  60: "cloudy", 61: "overcast", 62: "drizzle", 63: "rain", 64: "heavy", 65: "storm",
  70: "clear", 71: "clear", 72: "clear", 73: "clear", 74: "clear", 75: "clear",
  76: "cloudy", 77: "clear",
  80: "windy", 81: "clear", 82: "cloudy", 83: "fog", 84: "fog", 85: "haze",
  90: "hot", 91: "clear", 92: "cold", 93: "cold"
};

const WEATHER_PROFILES = {
  clear: { cloud: 0.12, rain: 0, wind: 0.18, fog: 0, dim: 0 },
  partly: { cloud: 0.46, rain: 0, wind: 0.22, fog: 0, dim: 0.05 },
  cloudy: { cloud: 0.8, rain: 0, wind: 0.24, fog: 0.04, dim: 0.2 },
  overcast: { cloud: 0.96, rain: 0, wind: 0.26, fog: 0.08, dim: 0.36 },
  shower: { cloud: 0.62, rain: 0.34, wind: 0.3, fog: 0, dim: 0.14 },
  drizzle: { cloud: 0.82, rain: 0.3, wind: 0.26, fog: 0.12, dim: 0.28 },
  rain: { cloud: 0.9, rain: 0.66, wind: 0.38, fog: 0.06, dim: 0.36 },
  heavy: { cloud: 1, rain: 0.96, wind: 0.5, fog: 0.06, dim: 0.46 },
  storm: { cloud: 1, rain: 0.9, wind: 0.62, fog: 0, dim: 0.5 },
  fog: { cloud: 0.5, rain: 0, wind: 0.06, fog: 0.9, dim: 0.22 },
  haze: { cloud: 0.34, rain: 0, wind: 0.08, fog: 0.5, dim: 0.18 },
  windy: { cloud: 0.4, rain: 0.05, wind: 0.88, fog: 0, dim: 0.08 },
  hot: { cloud: 0.1, rain: 0, wind: 0.12, fog: 0, dim: 0 },
  cold: { cloud: 0.22, rain: 0, wind: 0.18, fog: 0.05, dim: 0.06 }
};

const WEATHER_ICONS = {
  clear: '<circle cx="24" cy="24" r="8"/><path d="M24 4.5v4.5M24 39v4.5M4.5 24H9M39 24h4.5M10 10l3.2 3.2M34.8 34.8 38 38M38 10l-3.2 3.2M13.2 34.8 10 38"/>',
  clearNight: '<path d="M29.5 5.6a16.8 16.8 0 1 0 12.9 26.8A17.4 17.4 0 0 1 29.5 5.6Z"/>',
  partly: '<circle cx="16.5" cy="14.5" r="5.5"/><path d="M16.5 4v2.6M16.5 22.4V25M6 14.5h2.6M24.4 14.5H27M8.5 6.5l1.9 1.9M22.5 20.5l1.9 1.9M24.5 6.5l-1.9 1.9"/><path d="M16.5 36a5.2 5.2 0 0 1 .6-10.4 8.4 8.4 0 0 1 16-1.4 5.6 5.6 0 0 1 1.1 11.8H16.5Z"/>',
  partlyNight: '<path d="M21.5 5.4a10.4 10.4 0 1 0 8.2 16.4A10.8 10.8 0 0 1 21.5 5.4Z"/><path d="M16.5 36a5.2 5.2 0 0 1 .6-10.4 8.4 8.4 0 0 1 16-1.4 5.6 5.6 0 0 1 1.1 11.8H16.5Z"/>',
  cloudy: '<path d="M14 35a5.6 5.6 0 0 1 .7-11.2A9 9 0 0 1 32 22.5 6 6 0 0 1 33 35H14Z"/>',
  overcast: '<path d="M10 30.5a4.4 4.4 0 0 1 .6-8.8 7 7 0 0 1 13.4-1.2" opacity=".55"/><path d="M16 37a5.2 5.2 0 0 1 .6-10.4 8.4 8.4 0 0 1 16-1.4A5.6 5.6 0 0 1 33.7 37H16Z"/>',
  drizzle: '<path d="M13.5 30a5.4 5.4 0 0 1 .6-10.7A8.7 8.7 0 0 1 30.8 18 5.8 5.8 0 0 1 31.8 30H13.5Z"/><path d="M19 35v3.4M27 36v3.4"/>',
  rain: '<path d="M13.5 29.5a5.4 5.4 0 0 1 .6-10.7A8.7 8.7 0 0 1 30.8 17.5 5.8 5.8 0 0 1 31.8 29.5H13.5Z"/><path d="M17 34v5.5M24 35v5.5M31 34v5.5"/>',
  heavy: '<path d="M13.5 28.5a5.4 5.4 0 0 1 .6-10.7A8.7 8.7 0 0 1 30.8 16.5 5.8 5.8 0 0 1 31.8 28.5H13.5Z"/><path d="M16 32.5 12.8 41M22.5 32.5 19.3 41M29 32.5 25.8 41M35 32.5 31.8 41"/>',
  storm: '<path d="M13.5 27.5a5.4 5.4 0 0 1 .6-10.7A8.7 8.7 0 0 1 30.8 15.5 5.8 5.8 0 0 1 31.8 27.5H13.5Z"/><path d="M26.5 31 20.5 39h5.4L23.5 46"/>',
  fog: '<path d="M13 24h22M17 31h18M14 38h18"/><path d="M19.5 17.5a5.6 5.6 0 0 1 10.6-3.2"/>',
  haze: '<circle cx="24" cy="15" r="5.5"/><path d="M12 28h24M16 34.5h18M20 41h12"/>',
  windy: '<path d="M8 17h17a4.2 4.2 0 1 0-4.2-4.2"/><path d="M8 25h24a4.2 4.2 0 1 1-4.2 4.2"/><path d="M8 33h12"/>',
  hot: '<circle cx="24" cy="16.5" r="7"/><path d="M24 3.5v3.2M24 26.3v3.2M11 16.5h3.2M33.8 16.5H37M14.2 6.7l2.3 2.3M31.5 23.9l2.3 2.3M33.8 6.7l-2.3 2.3"/><path d="M13 36c3.2 3.4 6.3-3.4 9.5 0s6.3-3.4 9.5 0"/><path d="M15.5 42.5c3-3 6 3 9 0s6 3 9 0"/>',
  cold: '<path d="M24 9.5v29M11.5 17 36.5 32M36.5 17 11.5 32"/><path d="M24 9.5 20.4 13M24 9.5l3.6 3.5M24 38.5 20.4 35M24 38.5l3.6-3.5"/>'
};

const clampValue = (value, min = 0, max = 1) => {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
};

function weatherIconMarkup(kind, night = false) {
  const key = kind === "clear"
    ? (night ? "clearNight" : "clear")
    : kind === "partly"
      ? (night ? "partlyNight" : "partly")
      : (WEATHER_ICONS[kind] ? kind : (night ? "partlyNight" : "partly"));
  return `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${WEATHER_ICONS[key]}</svg>`;
}

function conditionKind(code) {
  return WEATHER_KINDS[Number(code)] || "partly";
}

/** 天文台 70–77 號圖示只用於夜間 */
function atmosphereIsNight(code) {
  const value = Number(code);
  return value >= 70 && value <= 77;
}

/** 香港日出日落（NOAA 近似算法，誤差約一兩分鐘） */
function solarTimes(date) {
  const latitude = 22.3027;
  const longitude = 114.1747;
  const timeZone = 8;
  const rad = Math.PI / 180;
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date - startOfYear) / 86400000);
  const gamma = (2 * Math.PI / 365) * (dayOfYear - 1);
  const declination = 0.006918
    - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma)
    - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma)
    - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const equation = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma)
    - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const cosHourAngle = Math.cos(90.833 * rad) / (Math.cos(latitude * rad) * Math.cos(declination))
    - Math.tan(latitude * rad) * Math.tan(declination);
  if (!Number.isFinite(cosHourAngle) || Math.abs(cosHourAngle) > 1) {
    return { sunrise: 6 * 60 + 20, sunset: 18 * 60 + 40 };
  }
  const hourAngle = Math.acos(cosHourAngle) / rad;
  const solarNoon = 720 - 4 * longitude - equation;
  const toLocal = (minutes) => ((minutes + timeZone * 60) % 1440 + 1440) % 1440;
  return { sunrise: toLocal(solarNoon - 4 * hourAngle), sunset: toLocal(solarNoon + 4 * hourAngle) };
}

function skyPhase(minutes, sunrise, sunset) {
  if (minutes < sunrise - 40 || minutes > sunset + 35) return "night";
  if (minutes < sunrise + 50) return "dawn";
  if (minutes > sunset - 20) return "dusk";
  if (minutes > sunset - 95) return "golden";
  return "day";
}

function parseWindLevel(text) {
  const levels = String(text || "").match(/(\d+)\s*級/g);
  if (!levels) return null;
  return Math.max(...levels.map((item) => Number(item.replace(/\D/g, ""))));
}

function windHeadline(text) {
  const match = String(text || "").match(/^[^，。]+/);
  return match ? match[0].trim() : "";
}

function buildCondition({ iconCode, temperature, humidity, windText, warnings, minutes }) {
  const solar = solarTimes(new Date());
  const warningCodes = Object.keys(warnings || {});
  const warningNames = warningCodes.map((code) => warnings[code]?.name).filter(Boolean);

  let kind = conditionKind(iconCode);
  let phase = skyPhase(minutes, solar.sunrise, solar.sunset);
  // 天文台只在夜間使用 70–77 的圖示，直接用來校正日夜
  if (Number(iconCode) >= 70 && Number(iconCode) <= 77) phase = "night";

  const hasTyphoonSignal = warningCodes.some((code) => /^TC(8|9|10)/.test(code));
  const hasStrongWindWarning = hasTyphoonSignal || warningCodes.includes("WMS");

  if (warningCodes.includes("WRAIN")) kind = "heavy";
  else if (warningCodes.includes("WTS") && ["shower", "drizzle", "rain", "heavy", "storm"].includes(kind)) kind = "storm";

  const profile = { ...(WEATHER_PROFILES[kind] || WEATHER_PROFILES.partly) };
  const windLevel = parseWindLevel(windText);
  if (windLevel) profile.wind = Math.max(profile.wind, clampValue((windLevel - 1) / 7) * 0.92);
  if (hasStrongWindWarning) profile.wind = Math.max(profile.wind, hasTyphoonSignal ? 1 : 0.82);
  if (hasTyphoonSignal) {
    profile.cloud = Math.max(profile.cloud, 0.78);
    profile.dim = Math.max(profile.dim, 0.3);
  }

  const heat = Math.max(clampValue((temperature - 28) / 8), warningCodes.includes("WHOT") ? 0.78 : 0);
  const cold = Math.max(clampValue((17 - temperature) / 9), warningCodes.includes("WCOLD") ? 0.82 : 0);

  return {
    phase,
    kind,
    minutes,
    sunrise: solar.sunrise,
    sunset: solar.sunset,
    cloud: profile.cloud,
    rain: profile.rain,
    wind: profile.wind,
    fog: profile.fog,
    dim: profile.dim,
    heat,
    cold,
    temperature,
    humidity,
    label: WEATHER_LABELS[Number(iconCode)] || "天氣資料",
    windText: windHeadline(windText),
    warnings: warningNames,
    night: phase === "night"
  };
}

function renderCurrentWeather(condition) {
  const chip = $("#weather-now");
  const meta = $("#weather-now-meta");
  if (!chip || !condition) return;
  chip.hidden = false;
  $("#weather-now-icon").innerHTML = weatherIconMarkup(condition.kind, condition.night);
  $("#weather-now-temp").textContent = Number.isFinite(condition.temperature) ? `${Math.round(condition.temperature)}°` : "--";
  $("#weather-now-desc").textContent = condition.label;
  const items = [];
  if (Number.isFinite(condition.humidity)) items.push(`濕度 ${condition.humidity}%`);
  if (condition.windText) items.push(condition.windText);
  items.push(...condition.warnings);
  meta.replaceChildren();
  items.forEach((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    meta.append(item);
  });
  meta.hidden = items.length === 0;
}

function applyCondition(condition) {
  state.weather = condition;
  weatherScene.update(condition);
  renderCurrentWeather(condition);
  if (!state.themePreference) applyTheme(resolveTheme());
}

/** 只有天色，不出數據摘要（未拿到真實觀測時用，免得顯示假數字） */
function applySceneOnly(condition) {
  state.weather = condition;
  weatherScene.update(condition);
  if (!state.themePreference) applyTheme(resolveTheme());
}

/** 預覽用：網址加 ?wx=rain&sky=night 可以鎖定場景，方便檢查效果 */
const PREVIEW_CODES = {
  clear: 50, partly: 51, cloudy: 60, overcast: 61, drizzle: 62, rain: 63,
  heavy: 64, storm: 65, fog: 83, haze: 85, windy: 80, hot: 90, cold: 93
};

function previewCondition(search) {
  const params = new URLSearchParams(search);
  const key = params.get("wx");
  if (!key || !(key in PREVIEW_CODES)) return null;
  const sky = params.get("sky");
  const representativeMinutes = { day: 13 * 60, dawn: 6 * 60 + 45, golden: 17 * 60, dusk: 18 * 60 + 10, night: 22 * 60 };
  const temperature = params.has("t") ? Number(params.get("t")) : ({ hot: 34, cold: 9 }[key] ?? 27);
  const windLevel = params.has("w") ? Number(params.get("w")) : (key === "windy" ? 7 : 4);
  const condition = buildCondition({
    iconCode: PREVIEW_CODES[key],
    temperature,
    humidity: params.has("rh") ? Number(params.get("rh")) : 72,
    windText: `東風${windLevel}級`,
    warnings: {},
    minutes: representativeMinutes[sky] ?? (new Date().getHours() * 60 + new Date().getMinutes())
  });
  if (sky === "day" || sky === "night" || sky === "dawn" || sky === "dusk" || sky === "golden") {
    condition.phase = sky;
    condition.night = sky === "night";
  }
  return condition;
}

async function loadCurrentWeather() {
  const preview = previewCondition(location.search);
  if (preview) {
    applyCondition(preview);
    return;
  }
  const nowDate = new Date();
  const minutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  const todayForecast = state.forecasts[0] || null;
  const fallbackWind = todayForecast?.forecastWind || "";
  try {
    const [currentResponse, warningResponse] = await Promise.all([
      fetch(hkoCurrentSource, { cache: "no-store" }),
      fetch(hkoWarningSource, { cache: "no-store" }).catch(() => null)
    ]);
    if (!currentResponse.ok) throw new Error(`Current weather returned ${currentResponse.status}`);
    const data = await currentResponse.json();
    const warnings = warningResponse && warningResponse.ok ? await warningResponse.json() : {};
    const iconCode = Array.isArray(data.icon) ? data.icon[0] : data.icon;
    const station = (data.temperature?.data || []).find((item) => item.place === "香港天文台")
      || (data.temperature?.data || [])[0];
    const temperature = station ? Number(station.value) : Number.NaN;
    const humidity = Number((data.humidity?.data || [])[0]?.value ?? Number.NaN);
    applyCondition(buildCondition({
      iconCode,
      temperature,
      humidity,
      windText: todayForecast?.forecastWind || fallbackWind,
      warnings: warnings || {},
      minutes
    }));
  } catch (error) {
    console.warn("Could not load current weather:", error);
    if (!todayForecast) {
      applySceneOnly(buildCondition({ iconCode: 51, minutes }));
      return;
    }
    const visual = weatherVisualType(todayForecast.forecastWeather);
    const kindMap = { storm: "storm", rain: "rain", fog: "fog", cloud: "cloudy", sun: "clear", partly: "partly" };
    const temperature = (Number(todayForecast.forecastMaxtemp?.value) + Number(todayForecast.forecastMintemp?.value)) / 2;
    applyCondition(buildCondition({
      iconCode: { storm: 65, rain: 63, fog: 83, cloud: 60, sun: 50, partly: 51 }[visual] || 51,
      temperature: Number.isFinite(temperature) ? temperature : Number.NaN,
      humidity: Number.NaN,
      windText: todayForecast.forecastWind,
      warnings: {},
      minutes
    }));
  }
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
    const icon = document.createElement("span");
    icon.className = "weather-icon";
    icon.innerHTML = weatherIconMarkup(conditionKind(forecast.ForecastIcon), atmosphereIsNight(forecast.ForecastIcon));
    card.append(weekday, day, icon, temperature, rain, description);
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
    state.forecasts = [todayForecast, ...forecasts.filter((item) => item !== todayForecast)];
    applyWeatherBackdrop(weatherVisualType(todayForecast.forecastWeather));
    renderWeatherForecast(forecasts);
    status.textContent = "香港天文台・已更新";
    void loadCurrentWeather();
  } catch (error) {
    console.warn("Could not load Hong Kong weather forecast:", error);
    $("#weather-grid").innerHTML = '<p class="weather-error">暫時未能讀取天氣資料，請稍後重新整理。</p>';
    status.textContent = "暫未能更新";
  }
}

function systemPrefersDark() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches === true;
}

function readThemePreference() {
  try { return localStorage.getItem(themeStorageKey) || ""; } catch { return ""; }
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  $("#theme-icon").textContent = isDark ? "☀" : "☾";
  $("#theme-label").textContent = isDark ? "淺色" : "深色";
  $("#theme-toggle").setAttribute("aria-label", isDark ? "切換淺色模式" : "切換深色模式");
}

/** 天色係夜就自動用深色，免得深色天空配淺色文字看唔清 */
function resolveTheme() {
  if (state.themePreference) return state.themePreference;
  if (state.weather?.night) return "dark";
  return systemPrefersDark() ? "dark" : "light";
}

function initialiseTheme() {
  state.themePreference = readThemePreference();
  applyTheme(resolveTheme());
}

function toggleTheme() {
  state.themePreference = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  try { localStorage.setItem(themeStorageKey, state.themePreference); } catch { /* storage unavailable */ }
  applyTheme(state.themePreference);
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
  $("#theme-toggle").addEventListener("click", toggleTheme);
}

initialiseTheme();
registerEvents();
state.days = createDemoSchedule(state.year);
render();

// 未拿到真實天氣之前，先按時間畫一個合理的天色，避免背景一片死板
const previewNow = previewCondition(location.search);
if (previewNow) {
  applyCondition(previewNow);
} else {
  const initialCondition = buildCondition({
    iconCode: 51,
    minutes: new Date().getHours() * 60 + new Date().getMinutes()
  });
  state.weather = initialCondition;
  weatherScene.update(initialCondition);
  // 先跟天色決定深淺，免得太陽／月亮未載入時用錯主題
  if (!state.themePreference) applyTheme(resolveTheme());
}

void loadWeatherForecast();
void loadCurrentWeather();

// 天氣每 10 分鐘更新一次；回到畫面時亦重新讀取（涵蓋跨日、下班回家等情況）
window.setInterval(() => {
  void loadWeatherForecast();
  void loadCurrentWeather();
}, 10 * 60 * 1000);
window.addEventListener("focus", () => { void loadCurrentWeather(); });
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) void loadCurrentWeather();
});

if (configured) startFirebase();
