// ===== State =====
let habits = JSON.parse(localStorage.getItem("habitflow-habits")) || [];
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const save = () =>
  localStorage.setItem("habitflow-habits", JSON.stringify(habits));
const genId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

// ===== Date Helpers =====
function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function todayKey() {
  return localDateStr(new Date());
}
function dateKey(d) {
  return localDateStr(d);
}

function getWeekDays() {
  const days = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  return days;
}

function formatWeekRange(days) {
  const opts = { month: "short", day: "numeric" };
  return `${days[0].toLocaleDateString("en-US", opts)} — ${days[6].toLocaleDateString("en-US", opts)}`;
}

const DAY_NAMES = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function isDayActive(habit, date) {
  const dow = date.getDay();
  if (habit.frequency === "weekdays") return dow >= 1 && dow <= 5;
  if (habit.frequency === "weekends") return dow === 0 || dow === 6;
  return true;
}

// ===== Streak Calculation per Habit =====
function calcHabitStreak(habit) {
  let streak = 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const todayActive = isDayActive(habit, d);
  const todayDone =
    todayActive && habit.completedDays && habit.completedDays[localDateStr(d)];
  if (todayActive && !todayDone) d.setDate(d.getDate() - 1);
  while (true) {
    const key = localDateStr(d);
    if (!isDayActive(habit, d)) {
      d.setDate(d.getDate() - 1);
      continue;
    }
    if (habit.completedDays && habit.completedDays[key]) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return streak;
}

function calcBestStreak(habit) {
  if (!habit.completedDays) return 0;
  const keys = Object.keys(habit.completedDays)
    .filter((k) => habit.completedDays[k])
    .sort();
  if (!keys.length) return 0;
  let best = 0,
    current = 0;
  const start = new Date(keys[0] + "T00:00:00");
  const end = new Date(keys[keys.length - 1] + "T00:00:00");
  const d = new Date(start);
  while (d <= end) {
    const key = localDateStr(d);
    if (!isDayActive(habit, d)) {
      d.setDate(d.getDate() + 1);
      continue;
    }
    if (habit.completedDays[key]) {
      current++;
      if (current > best) best = current;
    } else current = 0;
    d.setDate(d.getDate() + 1);
  }
  return best;
}

// ===== Render Habits =====
function render() {
  const container = $("#habitsContainer");
  const empty = $("#emptyState");
  const weekDays = getWeekDays();
  const tk = todayKey();

  const weekRangeEl = $("#weekRange");
  if (weekRangeEl) weekRangeEl.textContent = formatWeekRange(weekDays);

  if (!habits.length) {
    container.innerHTML = "";
    empty.classList.add("visible");
    $("#heatmapSection").style.display = "none";
    updateStats();
    return;
  }
  empty.classList.remove("visible");
  $("#heatmapSection").style.display = "block";

  container.innerHTML = habits
    .map((habit, idx) => {
      const streak = calcHabitStreak(habit);
      const best = calcBestStreak(habit);
      const weekChecked = weekDays.filter(
        (d) =>
          isDayActive(habit, d) &&
          habit.completedDays &&
          habit.completedDays[dateKey(d)],
      ).length;
      const weekTotal = weekDays.filter((d) => isDayActive(habit, d)).length;
      const pct = weekTotal ? Math.round((weekChecked / weekTotal) * 100) : 0;
      const activeDays = weekDays.filter((d) => isDayActive(habit, d));
      const activeDayIndices = weekDays
        .map((d, i) => (isDayActive(habit, d) ? i : -1))
        .filter((i) => i !== -1);

      return `<div class="habit-card" style="--habit-color:${habit.color};animation-delay:${idx * 0.05}s" data-id="${habit.id}">
      <div class="habit-card-header">
        <div class="habit-icon">${habit.icon}</div>
        <div class="habit-info">
          <div class="habit-name">${escapeHtml(habit.name)}</div>
          <div class="habit-freq">${habit.frequency === "daily" ? "Every day" : habit.frequency === "weekdays" ? "Weekdays" : "Weekends"}</div>
        </div>
        <button class="habit-delete" data-id="${habit.id}" aria-label="Delete habit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="habit-streak-row">
        <span class="habit-streak-badge${streak === 0 ? " no-streak" : ""}">
          <svg viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          ${streak > 0 ? streak + " day streak" : "No streak"}
        </span>
        <span class="habit-best-badge">Best: ${best}</span>
        <span class="habit-completion-badge" style="--habit-color:${habit.color}">${pct}%</span>
      </div>
      <div class="habit-week" style="grid-template-columns:repeat(${activeDays.length},1fr)">
        ${activeDayIndices
          .map((i) => {
            const d = weekDays[i];
            const key = dateKey(d);
            const checked = habit.completedDays && habit.completedDays[key];
            const isToday = key === tk;
            const isNotToday = key !== tk;
            return `<div class="habit-day${checked ? " checked" : ""}${isToday ? " today" : ""}${isNotToday ? " disabled" : ""}" data-habit="${habit.id}" data-date="${key}">
            <span class="habit-day-label">${DAY_NAMES[i]}</span>
            <div class="habit-day-circle" style="--habit-color:${habit.color}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L19 7" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
          </div>`;
          })
          .join("")}
      </div>
      <div class="habit-progress">
        <div class="habit-progress-bar"><div class="habit-progress-fill" style="width:${pct}%;background:${habit.color}"></div></div>
        <span class="habit-progress-text">${weekChecked}/${weekTotal}</span>
      </div>
    </div>`;
    })
    .join("");

  container.querySelectorAll(".habit-day:not(.disabled)").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset.habit;
      const date = el.dataset.date;
      const habit = habits.find((h) => h.id === id);
      if (!habit) return;
      if (!habit.completedDays) habit.completedDays = {};
      habit.completedDays[date] = !habit.completedDays[date];
      save();
      render();
      renderHeatmap();
    });
  });

  container.querySelectorAll(".habit-delete").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      habits = habits.filter((h) => h.id !== btn.dataset.id);
      save();
      render();
      renderHeatmap();
    });
  });

  updateStats();
  renderHeatmap();
}

// ===== GitHub-style Contribution Graph =====
function initHeatmap() {}

function renderHeatmap() {
  if (!habits.length) return;
  const grid = $("#heatmapGrid");
  const rangeEl = $("#heatRange");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tk = todayKey();
  rangeEl.textContent = "2026";

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const dayFmt = { month: "short", day: "numeric", year: "numeric" };

  // Build all 365 days
  const dayData = {};
  const d = new Date(2026, 0, 1);
  while (d.getFullYear() === 2026) {
    const key = dateKey(d);
    const isFuture = d > today;
    const activeHabits = habits.filter((h) => isDayActive(h, d));
    const total = activeHabits.length;
    const done = activeHabits.filter(
      (h) => h.completedDays && h.completedDays[key],
    ).length;
    dayData[key] = {
      date: new Date(d),
      key,
      ratio: total > 0 ? done / total : 0,
      done,
      total,
      isFuture,
    };
    d.setDate(d.getDate() + 1);
  }

  // Build columns per month — weeks split at month boundaries
  // Each column belongs to exactly one month. No date bleeds into another month's block.
  const columns = []; // { month, slots: [day|null x 7] }
  for (let m = 0; m < 12; m++) {
    const daysInMonth = new Date(2026, m + 1, 0).getDate();
    let col = new Array(7).fill(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const dd = new Date(2026, m, day);
      const dow = (dd.getDay() + 6) % 7; // Mon=0
      const key = dateKey(dd);
      // New column on Monday if current col has data
      if (dow === 0 && col.some((c) => c !== null)) {
        columns.push({ month: m, slots: col });
        col = new Array(7).fill(null);
      }
      col[dow] = dayData[key];
    }
    if (col.some((c) => c !== null)) columns.push({ month: m, slots: col });
  }

  // Grid column defs: 13px per col, 8px spacer between months
  const colDefs = [];
  const colToGrid = [];
  let gc = 1;
  for (let ci = 0; ci < columns.length; ci++) {
    if (ci > 0 && columns[ci].month !== columns[ci - 1].month) {
      colDefs.push("8px");
      gc++;
    }
    colToGrid.push(gc);
    colDefs.push("13px");
    gc++;
  }

  grid.style.gridTemplateColumns = colDefs.join(" ");
  grid.style.gridTemplateRows = "repeat(7, 13px)";
  grid.style.gridAutoFlow = "unset";

  // Emit cells with explicit placement
  const totalCols = columns.length;
  let html = "";
  for (let ci = 0; ci < totalCols; ci++) {
    const gCol = colToGrid[ci];
    const isLeftEdge = ci < 8;
    const isRightEdge = ci > totalCols - 8;
    for (let row = 0; row < 7; row++) {
      const day = columns[ci].slots[row];
      const style = `grid-column:${gCol};grid-row:${row + 1}`;
      if (!day) {
        html += `<div class="heatmap-cell empty-cell" style="${style}"></div>`;
      } else {
        const isToday = day.key === tk;
        const level = day.isFuture
          ? 0
          : day.ratio === 0
            ? 0
            : day.ratio <= 0.25
              ? 1
              : day.ratio <= 0.5
                ? 2
                : day.ratio <= 0.75
                  ? 3
                  : 4;
        const cls = day.isFuture ? " future-cell" : "";
        const tipH = isLeftEdge ? " tip-right" : isRightEdge ? " tip-left" : "";
        const tipV = row >= 5 ? " tip-up" : "";
        const dateLabel = day.date.toLocaleDateString("en-US", dayFmt);
        const tip = day.isFuture
          ? dateLabel
          : `${day.done} habits completed on ${dateLabel}`;
        html += `<div class="heatmap-cell level-${level}${cls}${tipH}${tipV}" data-tip="${tip}" style="${style}"></div>`;
      }
    }
  }
  grid.innerHTML = html;
}

function initHeatmapNav() {}

// ===== Stats =====
function updateStats() {
  const tk = todayKey();
  const today = new Date();
  const totalActive = habits.filter((h) => isDayActive(h, today)).length;
  const doneToday = habits.filter(
    (h) => isDayActive(h, today) && h.completedDays && h.completedDays[tk],
  ).length;
  const bestStreak = habits.reduce(
    (max, h) => Math.max(max, calcBestStreak(h)),
    0,
  );
  const rate = totalActive ? Math.round((doneToday / totalActive) * 100) : 0;
  $("#statTotal").textContent = habits.length;
  $("#statDoneToday").textContent = doneToday;
  $("#statBestStreak").textContent = bestStreak;
  $("#statCompletion").textContent = rate + "%";
}

// ===== Modal =====
function openModal() {
  $("#modalOverlay").classList.add("active");
  $("#habitForm").reset();
  setTimeout(() => $("#habitName").focus(), 100);
}
function closeModal() {
  $("#modalOverlay").classList.remove("active");
}

$("#addHabitBtn").addEventListener("click", openModal);
$("#cancelBtn").addEventListener("click", closeModal);
$("#modalCloseBtn").addEventListener("click", closeModal);
$("#modalOverlay").addEventListener("click", (e) => {
  if (e.target === $("#modalOverlay")) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

$("#habitForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("#habitName").value.trim();
  if (!name) return;
  habits.push({
    id: genId(),
    name,
    icon: $("#habitIcon").value,
    color: $("#habitColor").value,
    frequency: $("#habitFreq").value,
    completedDays: {},
    createdAt: Date.now(),
  });
  save();
  closeModal();
  render();
});

// ===== Shared Streak (reads from TaskFlow's Pomodoro streak) =====
function updateStreakUI() {
  const data = JSON.parse(
    localStorage.getItem("streak-data") || '{"days":{},"current":0}',
  );
  const streakEl = $("#streakCount");
  const btn = $("#streakBtn");
  const streak = data.current;
  const todayTime = data.days[todayKey()] || 0;
  const todayMins = Math.floor(todayTime / 60);

  if (streak > 0) {
    streakEl.textContent = streak;
    btn.classList.add("streak-active");
    btn.classList.remove("streak-risk");
    btn.title = `${streak} day streak! Today: ${todayMins}m tracked`;
  } else if (streak < 0) {
    streakEl.textContent = Math.abs(streak);
    btn.classList.remove("streak-active");
    btn.classList.add("streak-risk");
    btn.title = `${Math.abs(streak)} day streak at risk! Track ${60 - todayMins}m more today. (${todayMins}m so far)`;
  } else {
    streakEl.textContent = "0";
    btn.classList.remove("streak-active", "streak-risk");
    btn.title = `No streak yet. Track 1hr today to start! (${todayMins}m so far)`;
  }
}

// ===== Theme (shared with TaskFlow) =====
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("taskflow-theme", theme);
  const btn = $("#themeToggle");
  const darkIcon = btn.querySelector(".theme-icon-dark");
  const lightIcon = btn.querySelector(".theme-icon-light");
  if (theme === "light") {
    darkIcon.style.display = "none";
    lightIcon.style.display = "block";
  } else {
    darkIcon.style.display = "block";
    lightIcon.style.display = "none";
  }
}
function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  applyTheme(current === "dark" ? "light" : "dark");
}
const savedTheme = localStorage.getItem("taskflow-theme") || "dark";
applyTheme(savedTheme);
$("#themeToggle").addEventListener("click", toggleTheme);

// ===== Init =====
initHeatmap();
initHeatmapNav();
render();
updateStreakUI();

// ===== Splash Screen =====
(function () {
  const splash = document.getElementById("splashScreen");
  if (!splash) return;
  setTimeout(() => {
    splash.classList.add("hidden");
    setTimeout(() => splash.remove(), 600);
  }, 2200);
})();
