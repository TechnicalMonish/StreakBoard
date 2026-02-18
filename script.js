// ===== State =====
let tasks = JSON.parse(localStorage.getItem("taskboard-tasks")) || [];
let currentView = "kanban";
let calYear, calMonth;
let draggedTaskId = null;

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// DOM refs
const newTaskBtn = $("#newTaskBtn");
const modalOverlay = $("#modalOverlay");
const taskForm = $("#taskForm");
const cancelBtn = $("#cancelBtn");
const modalCloseBtn = $("#modalCloseBtn");
const subtaskInput = $("#subtaskInput");
const addSubtaskBtn = $("#addSubtaskBtn");
const subtasksList = $("#subtasksList");
const emptyState = $("#emptyState");
const board = $("#board");
const detailOverlay = $("#detailOverlay");
const detailCloseBtn = $("#detailCloseBtn");
const detailDeleteBtn = $("#detailDeleteBtn");
const detailContent = $("#detailContent");
const detailTitle = $("#detailTitle");

let currentSubtasks = [];
let viewingTaskId = null;

// ===== Helpers =====
const genId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const save = () =>
  localStorage.setItem("taskboard-tasks", JSON.stringify(tasks));

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}
function formatDate(ds) {
  if (!ds) return "";
  return new Date(ds + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
function formatDateFull(ds) {
  if (!ds) return "";
  return new Date(ds + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function getDueStatus(ds, taskStatus) {
  if (!ds) return "";
  if (taskStatus === "done") return "";
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = (new Date(ds + "T00:00:00") - now) / 864e5;
  if (diff < 0) return "overdue";
  if (diff <= 2) return "soon";
  return "";
}

// SVG due date icon (replaces calendar emoji)
const dueDateIcon =
  '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" style="vertical-align:-1px;margin-right:2px"><rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" stroke-width="2"/><path d="M3 10h18" stroke="currentColor" stroke-width="2"/><path d="M8 2v4M16 2v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

// SVG clock icon for time badges
const clockIcon =
  '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" style="vertical-align:-1px;margin-right:1px"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5"/><path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>';
function statusLabel(s) {
  return (
    {
      tasks:
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="vertical-align:-1px"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="2"/><path d="M8 10h8M8 14h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Tasks',
      "in-progress":
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="vertical-align:-1px"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 8v4l3 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> In Progress',
      "will-see-later":
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="vertical-align:-1px"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M16 12H8M12 16V8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Will See Later',
      done: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="vertical-align:-1px"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M8 12l3 3 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Done',
    }[s] || s
  );
}
function statusIcon(s) {
  const icons = {
    tasks:
      '<svg width="10" height="10" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="2.5"/></svg>',
    "in-progress":
      '<svg width="10" height="10" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5"/><path d="M12 8v4l3 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    "will-see-later":
      '<svg width="10" height="10" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5"/><path d="M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    done: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5"/><path d="M8 12l3 3 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  return icons[s] || icons.tasks;
}

// Format seconds to human readable time
function formatTimeSpent(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return "0m";
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// Migrate old tasks that don't have timeSpent
function migrateTasks() {
  let changed = false;
  tasks.forEach((t) => {
    if (typeof t.timeSpent === "undefined") {
      t.timeSpent = 0;
      changed = true;
    }
  });
  if (changed) save();
}
migrateTasks();

// ===== Stats =====
function updateStats() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  $("#statTotal").textContent = tasks.length;
  $("#statProgress").textContent = tasks.filter(
    (t) => t.status === "in-progress",
  ).length;
  $("#statDone").textContent = tasks.filter((t) => t.status === "done").length;
  $("#statOverdue").textContent = tasks.filter((t) => {
    if (!t.dueDate || t.status === "done") return false;
    return new Date(t.dueDate + "T00:00:00") < now;
  }).length;
}

// ===== View Switching =====
function switchView(view) {
  currentView = view;
  $$(".view-tab").forEach((t) =>
    t.classList.toggle("active", t.dataset.view === view),
  );
  $$(".view-panel").forEach((p) =>
    p.classList.toggle("active", p.id === "view-" + view),
  );
  renderCurrentView();
}
function renderCurrentView() {
  updateStats();
  if (currentView === "kanban") renderKanban();
  else if (currentView === "calendar") renderCalendar();
  else if (currentView === "timeline") renderTimeline();
  else if (currentView === "gantt") renderGantt();
}

// ===== Modal Controls =====
function openModal() {
  modalOverlay.classList.add("active");
  currentSubtasks = [];
  renderFormSubtasks();
  taskForm.reset();
  $("#taskDue").value = new Date().toISOString().split("T")[0];
  setTimeout(() => $("#taskTitle").focus(), 100);
}
function closeModal() {
  modalOverlay.classList.remove("active");
}

// ===== Detail Modal with Status Change & Time Spent =====
function openDetail(taskId) {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;
  viewingTaskId = taskId;
  detailTitle.textContent = task.title;
  const done = task.subtasks.filter((s) => s.done).length;
  const timeSpent = task.timeSpent || 0;

  const statuses = [
    {
      value: "tasks",
      label:
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="2"/><path d="M8 10h8M8 14h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Tasks',
      color: "#3b82f6",
    },
    {
      value: "in-progress",
      label:
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 8v4l3 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> In Progress',
      color: "#f59e0b",
    },
    {
      value: "will-see-later",
      label:
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M16 12H8M12 16V8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Later',
      color: "#8b5cf6",
    },
    {
      value: "done",
      label:
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M8 12l3 3 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Done',
      color: "#10b981",
    },
  ];

  detailContent.innerHTML = `
    <div class="detail-section">
      <div class="detail-label">Status</div>
      <div class="detail-status-picker" id="statusPicker">
        ${statuses
          .map(
            (s) => `
          <button class="status-option ${task.status === s.value ? "active" : ""}" data-status="${s.value}" style="--status-color:${s.color}">
            ${s.label}
          </button>
        `,
          )
          .join("")}
      </div>
    </div>
    <div class="detail-section">
      <div class="detail-label">Category</div>
      <div class="detail-value"><span class="category-badge category-${task.category}">${task.category}</span></div>
    </div>
    ${task.description ? `<div class="detail-section"><div class="detail-label">Description</div><div class="detail-value">${escapeHtml(task.description)}</div></div>` : ""}
    ${task.dueDate ? `<div class="detail-section"><div class="detail-label">Due Date</div><div class="detail-value due-date ${getDueStatus(task.dueDate, task.status)}">${dueDateIcon} ${formatDateFull(task.dueDate)}</div></div>` : ""}
    <div class="detail-section">
      <div class="detail-label"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="vertical-align:-1px;margin-right:3px"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Time Spent</div>
      <div class="detail-time-spent">
        <div class="time-spent-display">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <span class="time-spent-value">${formatTimeSpent(timeSpent)}</span>
        </div>
        ${
          timeSpent > 0
            ? `<div class="time-spent-bar"><div class="time-spent-fill" style="width:${Math.min(((timeSpent / 3600) * 100) / 3, 100)}%"></div></div>
        <div class="time-spent-hint">${Math.floor(timeSpent / 60)} minutes tracked via Pomodoro</div>`
            : '<div class="time-spent-hint">Start a Pomodoro session with this task selected to track time</div>'
        }
      </div>
    </div>
    ${
      task.subtasks.length
        ? `<div class="detail-section"><div class="detail-label">Subtasks (${done}/${task.subtasks.length})</div>
      <ul class="detail-subtasks">${task.subtasks
        .map(
          (s, i) => `<li class="detail-subtask ${s.done ? "completed" : ""}">
        <input type="checkbox" ${s.done ? "checked" : ""} data-index="${i}" aria-label="Toggle subtask"><span>${escapeHtml(s.text)}</span></li>`,
        )
        .join("")}</ul></div>`
        : ""
    }
  `;

  // Status change buttons
  detailContent.querySelectorAll(".status-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      const newStatus = btn.dataset.status;
      if (task.status !== newStatus) {
        task.status = newStatus;
        save();
        renderCurrentView();
        openDetail(taskId); // Re-render detail to update active state
      }
    });
  });

  // Subtask checkboxes
  detailContent.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener("change", (e) => {
      task.subtasks[parseInt(e.target.dataset.index)].done = e.target.checked;
      save();
      renderCurrentView();
      openDetail(taskId);
    });
  });

  detailOverlay.classList.add("active");
}

function closeDetail() {
  detailOverlay.classList.remove("active");
  viewingTaskId = null;
}

// ===== Subtask Form =====
function renderFormSubtasks() {
  subtasksList.innerHTML = currentSubtasks
    .map(
      (t, i) => `
    <div class="subtask-item"><span class="subtask-text">${escapeHtml(t)}</span>
    <button type="button" class="subtask-remove" data-index="${i}" aria-label="Remove">&times;</button></div>`,
    )
    .join("");
  subtasksList.querySelectorAll(".subtask-remove").forEach((b) =>
    b.addEventListener("click", (e) => {
      currentSubtasks.splice(parseInt(e.target.dataset.index), 1);
      renderFormSubtasks();
    }),
  );
  $("#subtaskRow").style.display =
    currentSubtasks.length >= 5 ? "none" : "flex";
}
function addSubtask() {
  const v = subtaskInput.value.trim();
  if (!v || currentSubtasks.length >= 5) return;
  currentSubtasks.push(v);
  subtaskInput.value = "";
  renderFormSubtasks();
  subtaskInput.focus();
}
function createTask(e) {
  e.preventDefault();
  const title = $("#taskTitle").value.trim();
  const description = $("#taskDesc").value.trim();
  const dueDate = $("#taskDue").value;
  if (!title || !description || !dueDate) return;
  tasks.push({
    id: genId(),
    title,
    description,
    category: $("#taskCategory").value,
    dueDate,
    subtasks: currentSubtasks.map((t) => ({ text: t, done: false })),
    status: "tasks",
    createdAt: Date.now(),
    timeSpent: 0,
  });
  save();
  closeModal();
  renderCurrentView();
}
function deleteTask(id) {
  const card = document.querySelector(`[data-id="${id}"]`);
  if (card) {
    card.style.animation = "cardRemove .35s var(--ease) forwards";
    setTimeout(() => {
      tasks = tasks.filter((t) => t.id !== id);
      save();
      closeDetail();
      renderCurrentView();
    }, 350);
  } else {
    tasks = tasks.filter((t) => t.id !== id);
    save();
    closeDetail();
    renderCurrentView();
  }
}

// ===== KANBAN RENDER =====
function renderKanban() {
  const cols = ["tasks", "in-progress", "will-see-later", "done"];
  cols.forEach((status) => {
    const col = $(`#col-${status}`),
      count = $(`#count-${status}`);
    const list = tasks.filter((t) => t.status === status);
    count.textContent = list.length;
    col.innerHTML = "";
    list.forEach((task, idx) => {
      const card = document.createElement("div");
      card.className = "task-card";
      card.draggable = true;
      card.dataset.id = task.id;
      card.style.animationDelay = `${idx * 0.04}s`;
      const cDone = task.subtasks.filter((s) => s.done).length,
        cTotal = task.subtasks.length;
      const pct = cTotal ? (cDone / cTotal) * 100 : 0;
      const timeStr =
        task.timeSpent > 0
          ? `<span class="card-time-badge">${clockIcon} ${formatTimeSpent(task.timeSpent)}</span>`
          : "";
      card.innerHTML = `
        <div class="task-card-top">
          <span class="drag-handle">⠿</span>
          <span class="category-badge category-${task.category}">${task.category}</span>
          ${timeStr}
          <div class="status-dot s-${task.status}" style="margin-left:auto"></div>
        </div>
        <div class="task-card-title">${escapeHtml(task.title)}</div>
        ${task.description ? `<div class="task-card-desc">${escapeHtml(task.description)}</div>` : ""}
        ${
          task.dueDate || cTotal
            ? `<div class="task-card-footer">
          ${task.dueDate ? `<span class="due-date ${getDueStatus(task.dueDate, task.status)}">${dueDateIcon} ${formatDate(task.dueDate)}${getDueStatus(task.dueDate, task.status) === "overdue" ? " — Overdue" : ""}</span>` : "<span></span>"}
          ${cTotal ? `<div class="subtask-progress"><div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div><span class="progress-text">${cDone}/${cTotal}</span></div>` : ""}
        </div>`
            : ""
        }`;
      card.addEventListener("click", (e) => {
        if (!e.target.closest(".drag-handle")) openDetail(task.id);
      });
      card.addEventListener("dragstart", handleDragStart);
      card.addEventListener("dragend", handleDragEnd);
      col.appendChild(card);
    });
  });
  board.style.display = tasks.length ? "grid" : "none";
  emptyState.classList.toggle("visible", !tasks.length);
}

// ===== Drag & Drop =====
function handleDragStart(e) {
  draggedTaskId = e.target.dataset.id;
  e.target.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", draggedTaskId);
  requestAnimationFrame(() => (e.target.style.opacity = "0.35"));
}
function handleDragEnd(e) {
  e.target.classList.remove("dragging");
  e.target.style.opacity = "";
  draggedTaskId = null;
  $$(".column").forEach((c) => c.classList.remove("drag-over"));
  $$(".drop-placeholder").forEach((p) => p.remove());
}
function initDropZones() {
  $$(".column-body").forEach((cb) => {
    cb.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      cb.closest(".column").classList.add("drag-over");
      if (!cb.querySelector(".drop-placeholder")) {
        const ph = document.createElement("div");
        ph.className = "drop-placeholder";
        cb.appendChild(ph);
      }
    });
    cb.addEventListener("dragleave", (e) => {
      if (!cb.contains(e.relatedTarget)) {
        cb.closest(".column").classList.remove("drag-over");
        const ph = cb.querySelector(".drop-placeholder");
        if (ph) ph.remove();
      }
    });
    cb.addEventListener("drop", (e) => {
      e.preventDefault();
      const col = cb.closest(".column");
      col.classList.remove("drag-over");
      const ph = cb.querySelector(".drop-placeholder");
      if (ph) ph.remove();
      const id = e.dataTransfer.getData("text/plain"),
        ns = col.dataset.status;
      const task = tasks.find((t) => t.id === id);
      if (task && task.status !== ns) {
        task.status = ns;
        save();
        renderCurrentView();
      }
    });
  });
}

// Touch drag
let touchData = null,
  touchClone = null,
  touchStartX = 0,
  touchStartY = 0,
  hasMoved = false;
function initTouchDrag() {
  document.addEventListener(
    "touchstart",
    (e) => {
      const card = e.target.closest(".task-card");
      if (!card || currentView !== "kanban") return;
      const t = e.touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      hasMoved = false;
      touchData = { id: card.dataset.id, el: card };
    },
    { passive: true },
  );
  document.addEventListener(
    "touchmove",
    (e) => {
      if (!touchData) return;
      const t = e.touches[0];
      if (
        !hasMoved &&
        (Math.abs(t.clientX - touchStartX) > 10 ||
          Math.abs(t.clientY - touchStartY) > 10)
      ) {
        hasMoved = true;
        touchData.el.classList.add("dragging");
        touchClone = touchData.el.cloneNode(true);
        touchClone.style.cssText = `position:fixed;z-index:9999;pointer-events:none;width:${touchData.el.offsetWidth}px;opacity:.9;transform:rotate(3deg) scale(1.05);box-shadow:0 20px 60px rgba(0,0,0,.5);transition:none;`;
        document.body.appendChild(touchClone);
      }
      if (hasMoved && touchClone) {
        e.preventDefault();
        touchClone.style.left = t.clientX - touchData.el.offsetWidth / 2 + "px";
        touchClone.style.top = t.clientY - 30 + "px";
        $$(".column").forEach((c) => c.classList.remove("drag-over"));
        const el = document.elementFromPoint(t.clientX, t.clientY);
        const col = el?.closest(".column");
        if (col) col.classList.add("drag-over");
      }
    },
    { passive: false },
  );
  document.addEventListener("touchend", (e) => {
    if (!touchData) return;
    if (hasMoved) {
      const t = e.changedTouches[0],
        el = document.elementFromPoint(t.clientX, t.clientY);
      const col = el?.closest(".column");
      if (col) {
        const ns = col.dataset.status,
          task = tasks.find((t2) => t2.id === touchData.id);
        if (task && task.status !== ns) {
          task.status = ns;
          save();
          renderCurrentView();
        }
      }
    } else {
      openDetail(touchData.id);
    }
    if (touchClone) {
      touchClone.remove();
      touchClone = null;
    }
    if (touchData.el) touchData.el.classList.remove("dragging");
    $$(".column").forEach((c) => c.classList.remove("drag-over"));
    touchData = null;
    hasMoved = false;
  });
}

// ===== CALENDAR VIEW =====
function initCalendar() {
  const n = new Date();
  calYear = n.getFullYear();
  calMonth = n.getMonth();
}
function renderCalendar() {
  const grid = $("#calendarGrid"),
    title = $("#calTitle");
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  title.textContent = `${months[calMonth]} ${calYear}`;
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const prevDays = new Date(calYear, calMonth, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let html = "";
  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach(
    (d) => (html += `<div class="cal-header-cell">${d}</div>`),
  );
  for (let i = firstDay - 1; i >= 0; i--)
    html += `<div class="cal-cell other-month"><div class="cal-date">${prevDays - i}</div></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(calYear, calMonth, d);
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const isToday = dateObj.getTime() === today.getTime();
    const dayTasks = tasks.filter((t) => t.dueDate === dateStr);
    html += `<div class="cal-cell${isToday ? " today" : ""}"><div class="cal-date">${d}</div>`;
    dayTasks.forEach(
      (t) =>
        (html += `<div class="cal-task s-${t.status}" data-id="${t.id}" title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</div>`),
    );
    html += "</div>";
  }
  const remaining = (7 - ((firstDay + daysInMonth) % 7)) % 7;
  for (let i = 1; i <= remaining; i++)
    html += `<div class="cal-cell other-month"><div class="cal-date">${i}</div></div>`;
  grid.innerHTML = html;
  grid.querySelectorAll(".cal-task").forEach((el) => {
    el.addEventListener("click", () => openDetail(el.dataset.id));
    // Make calendar tasks draggable
    el.draggable = true;
    el.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", el.dataset.id);
      e.dataTransfer.effectAllowed = "move";
      el.style.opacity = "0.4";
    });
    el.addEventListener("dragend", () => {
      el.style.opacity = "";
    });
  });
  // Make calendar cells drop targets
  grid.querySelectorAll(".cal-cell:not(.other-month)").forEach((cell) => {
    cell.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      cell.classList.add("cal-cell-dragover");
    });
    cell.addEventListener("dragleave", () => {
      cell.classList.remove("cal-cell-dragover");
    });
    cell.addEventListener("drop", (e) => {
      e.preventDefault();
      cell.classList.remove("cal-cell-dragover");
      const taskId = e.dataTransfer.getData("text/plain");
      const dateNum = cell.querySelector(".cal-date")?.textContent;
      if (!taskId || !dateNum) return;
      const newDate = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(dateNum).padStart(2, "0")}`;
      const task = tasks.find((t) => t.id === taskId);
      if (task && task.dueDate !== newDate) {
        task.dueDate = newDate;
        save();
        renderCurrentView();
      }
    });
  });
}

// ===== TIMELINE VIEW =====
function renderTimeline() {
  const container = $("#timelineContainer");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(now);
  endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
  const groups = [
    {
      key: "overdue",
      title: "OVERDUE",
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px"><path d="M12 2L2 20h20L12 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 9v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      cls: "overdue-header",
      tasks: [],
    },
    {
      key: "today",
      title: "TODAY",
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      cls: "soon-header",
      tasks: [],
    },
    {
      key: "thisweek",
      title: "THIS WEEK",
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px"><rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" stroke-width="2"/><path d="M3 10h18" stroke="currentColor" stroke-width="2"/><path d="M8 2v4M16 2v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      cls: "soon-header",
      tasks: [],
    },
    {
      key: "nextweek",
      title: "NEXT WEEK",
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px"><rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" stroke-width="2"/><path d="M3 10h18" stroke="currentColor" stroke-width="2"/><path d="M8 2v4M16 2v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      cls: "future-header",
      tasks: [],
    },
    {
      key: "later",
      title: "LATER",
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M2 12h20" stroke="currentColor" stroke-width="2"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" stroke="currentColor" stroke-width="2"/></svg>',
      cls: "future-header",
      tasks: [],
    },
    {
      key: "nodate",
      title: "NO DUE DATE",
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="2"/><path d="M8 10h8M8 14h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
      cls: "nodate-header",
      tasks: [],
    },
  ];
  tasks.forEach((t) => {
    if (!t.dueDate) {
      groups[5].tasks.push(t);
      return;
    }
    const due = new Date(t.dueDate + "T00:00:00"),
      diff = (due - now) / 864e5;
    if (diff < 0) groups[0].tasks.push(t);
    else if (diff < 1) groups[1].tasks.push(t);
    else if (due <= endOfWeek) groups[2].tasks.push(t);
    else if (diff <= 14) groups[3].tasks.push(t);
    else groups[4].tasks.push(t);
  });
  if (!tasks.length) {
    container.innerHTML =
      '<div class="empty-state visible"><p class="empty-desc">No tasks to show in timeline.</p></div>';
    return;
  }
  let html = "";
  groups.forEach((g) => {
    if (!g.tasks.length) return;
    html += `<div class="timeline-group"><div class="timeline-group-header ${g.cls}">
      <span class="tg-icon">${g.icon}</span><span class="tg-title">${g.title} (${g.tasks.length})</span><span class="tg-chevron">▼</span>
    </div><div class="timeline-group-body">`;
    g.tasks.forEach((t) => {
      const cDone = t.subtasks.filter((s) => s.done).length,
        cTotal = t.subtasks.length;
      const timeStr =
        t.timeSpent > 0
          ? `<span class="tl-time-badge">${clockIcon} ${formatTimeSpent(t.timeSpent)}</span>`
          : "";
      html += `<div class="tl-card" data-id="${t.id}"><div class="status-dot s-${t.status}"></div>
        <div class="tl-card-main"><div class="tl-card-title">${escapeHtml(t.title)}</div>
        <div class="tl-card-meta"><span class="category-badge category-${t.category}">${t.category}</span>
        ${t.dueDate ? `<span class="tl-card-due ${getDueStatus(t.dueDate, t.status)}">Due: ${formatDate(t.dueDate)}${getDueStatus(t.dueDate, t.status) === "overdue" ? " — Overdue" : ""}</span>` : ""}
        ${cTotal ? `<span class="subtask-count" style="font-size:.65rem;color:var(--text-muted)">${cDone}/${cTotal}</span>` : ""}
        ${timeStr}
        </div></div></div>`;
    });
    html += "</div></div>";
  });
  container.innerHTML = html;
  container
    .querySelectorAll(".timeline-group-header")
    .forEach((h) =>
      h.addEventListener("click", () =>
        h.parentElement.classList.toggle("collapsed"),
      ),
    );
  container
    .querySelectorAll(".tl-card")
    .forEach((c) =>
      c.addEventListener("click", () => openDetail(c.dataset.id)),
    );
}

// ===== GANTT VIEW =====
function renderGantt() {
  const wrapper = $("#ganttWrapper");
  if (!tasks.length) {
    wrapper.innerHTML =
      '<div class="empty-state visible"><p class="empty-desc">No tasks to show in Gantt chart.</p></div>';
    return;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 2);
  const days = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    days.push(d);
  }
  const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
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

  // Find today's column index
  const todayIdx = days.findIndex((d) => d.getTime() === today.getTime());

  let html =
    '<div class="gantt-scroll"><table class="gantt-table"><thead><tr><th>Task</th>';
  days.forEach((d, i) => {
    const isT = d.getTime() === today.getTime();
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    html += `<th class="${isT ? "gantt-today-col" : ""}${isWeekend ? " gantt-weekend" : ""}" data-col="${i}">
      <span class="gantt-day-name">${dayNames[d.getDay()]}</span>
      <span class="gantt-day-num${isT ? " gantt-today-num" : ""}">${d.getDate()}</span>
      <span class="gantt-day-month">${monthNames[d.getMonth()]}</span>
    </th>`;
  });
  html += "</tr></thead><tbody>";

  // Sort tasks: in-progress first, then tasks, will-see-later, done
  const statusOrder = {
    "in-progress": 0,
    tasks: 1,
    "will-see-later": 2,
    done: 3,
  };
  const sorted = [...tasks].sort(
    (a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9),
  );

  sorted.forEach((task) => {
    const cDone = task.subtasks.filter((s) => s.done).length,
      cTotal = task.subtasks.length;
    const pct = cTotal ? Math.round((cDone / cTotal) * 100) : 0;
    const timeStr =
      task.timeSpent > 0
        ? `<span class="gantt-time-badge">${clockIcon} ${formatTimeSpent(task.timeSpent)}</span>`
        : "";
    html += `<tr><td><div class="gantt-task-info" data-id="${task.id}">
      <div class="gantt-status-icon s-${task.status}">${statusIcon(task.status)}</div>
      <div><div class="gantt-task-name">${escapeHtml(task.title)}</div>
      <div class="gantt-task-meta"><span class="category-badge category-${task.category}">${task.category}</span>
      ${cTotal ? `<span class="gantt-subtask-pill">${cDone}/${cTotal}<span class="gantt-subtask-bar"><span class="gantt-subtask-fill" style="width:${pct}%"></span></span></span>` : ""}
      ${timeStr}</div></div></div></td>`;
    days.forEach((d, i) => {
      const isT = d.getTime() === today.getTime();
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const isDue = task.dueDate === ds;
      // Check if task was created on this day
      const createdDate = new Date(task.createdAt);
      createdDate.setHours(0, 0, 0, 0);
      const isCreated = createdDate.getTime() === d.getTime();

      html += `<td class="gantt-bar-cell${isT ? " gantt-today-col" : ""}${isWeekend ? " gantt-weekend" : ""}" data-col="${i}">`;
      if (isDue) {
        html += `<div class="gantt-bar s-${task.status}" style="left:4px;right:4px;" data-id="${task.id}">
          <span class="gantt-bar-text">${escapeHtml(task.title.substring(0, 14))}${task.title.length > 14 ? "…" : ""}</span>
        </div>`;
      } else if (isCreated && !isDue) {
        html += `<div class="gantt-marker gantt-marker-created" title="Created"></div>`;
      }
      html += "</td>";
    });
    html += "</tr>";
  });
  html += "</tbody></table>";

  // Today vertical line overlay
  if (todayIdx >= 0) {
    html += `<div class="gantt-today-line" id="ganttTodayLine"></div>`;
  }
  html += "</div>";

  wrapper.innerHTML = html;

  // Position the today line
  if (todayIdx >= 0) {
    const line = wrapper.querySelector("#ganttTodayLine");
    const firstTh = wrapper.querySelector(`th[data-col="${todayIdx}"]`);
    if (line && firstTh) {
      const scrollEl = wrapper.querySelector(".gantt-scroll");
      const scrollRect = scrollEl.getBoundingClientRect();
      const thRect = firstTh.getBoundingClientRect();
      const left = thRect.left - scrollRect.left + thRect.width / 2;
      line.style.left = left + "px";
    }
  }

  wrapper
    .querySelectorAll(".gantt-task-info,.gantt-bar")
    .forEach((el) =>
      el.addEventListener("click", () => openDetail(el.dataset.id)),
    );

  // Make gantt bars draggable
  wrapper.querySelectorAll(".gantt-bar").forEach((bar) => {
    bar.draggable = true;
    bar.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", bar.dataset.id);
      e.dataTransfer.effectAllowed = "move";
      bar.style.opacity = "0.4";
    });
    bar.addEventListener("dragend", () => {
      bar.style.opacity = "";
    });
  });

  // Also allow dragging from the task name column
  wrapper.querySelectorAll(".gantt-task-info").forEach((info) => {
    info.draggable = true;
    info.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", info.dataset.id);
      e.dataTransfer.effectAllowed = "move";
      info.style.opacity = "0.4";
    });
    info.addEventListener("dragend", () => {
      info.style.opacity = "";
    });
  });

  // Make gantt date cells drop targets
  wrapper.querySelectorAll(".gantt-bar-cell").forEach((cell) => {
    cell.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      cell.classList.add("gantt-cell-dragover");
    });
    cell.addEventListener("dragleave", () => {
      cell.classList.remove("gantt-cell-dragover");
    });
    cell.addEventListener("drop", (e) => {
      e.preventDefault();
      cell.classList.remove("gantt-cell-dragover");
      const taskId = e.dataTransfer.getData("text/plain");
      const colIdx = parseInt(cell.dataset.col);
      if (!taskId || isNaN(colIdx)) return;
      const targetDay = days[colIdx];
      if (!targetDay) return;
      const newDate = `${targetDay.getFullYear()}-${String(targetDay.getMonth() + 1).padStart(2, "0")}-${String(targetDay.getDate()).padStart(2, "0")}`;
      const task = tasks.find((t) => t.id === taskId);
      if (task && task.dueDate !== newDate) {
        task.dueDate = newDate;
        save();
        renderCurrentView();
      }
    });
  });
}

// ===== POMODORO TIMER WITH TIME TRACKING & PERSISTENCE =====
// Pomodoro particle effects
let pomoParticleInterval = null;
function spawnPomoParticles() {
  const container = document.getElementById("pomoParticles");
  if (!container) return;
  clearPomoParticles();
  pomoParticleInterval = setInterval(() => {
    if (!pomoState.running) return;
    const p = document.createElement("div");
    p.className = "pomo-particle";
    const colors = ["#ef4444", "#f59e0b", "#f87171", "#fbbf24"];
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.left = Math.random() * 100 + "%";
    p.style.bottom = Math.random() * 30 + "%";
    p.style.animationDuration = 2 + Math.random() * 2 + "s";
    p.style.animationDelay = Math.random() * 0.5 + "s";
    p.style.width = 2 + Math.random() * 3 + "px";
    p.style.height = p.style.width;
    container.appendChild(p);
    setTimeout(() => p.remove(), 4000);
  }, 400);
}
function clearPomoParticles() {
  if (pomoParticleInterval) {
    clearInterval(pomoParticleInterval);
    pomoParticleInterval = null;
  }
  const container = document.getElementById("pomoParticles");
  if (container) container.innerHTML = "";
}

const pomoPanel = $("#pomoPanel");
const pomoToggle = $("#pomodoroToggle");
const pomoClose = $("#pomoClose");
const pomoTime = $("#pomoTime");
const pomoLabel = $("#pomoLabel");
const pomoRing = $("#pomoRing");
const pomoStart = $("#pomoStart");
const pomoPause = $("#pomoPause");
const pomoReset = $("#pomoReset");
const pomoModes = $("#pomoModes");
const pomoTaskSelect = $("#pomoTask");
const pomoSessionsEl = $("#pomoSessions");

let pomoState = {
  minutes: 25,
  totalSeconds: 25 * 60,
  remaining: 25 * 60,
  running: false,
  interval: null,
  sessions: parseInt(localStorage.getItem("pomo-sessions-today") || "0"),
  lastDate: localStorage.getItem("pomo-last-date") || "",
  trackingTaskId: null,
};

// Reset sessions if new day
const todayStr = new Date().toDateString();
if (pomoState.lastDate !== todayStr) {
  pomoState.sessions = 0;
  localStorage.setItem("pomo-sessions-today", "0");
  localStorage.setItem("pomo-last-date", todayStr);
}
pomoSessionsEl.textContent = pomoState.sessions;

// SVG ring
const RING_CIRCUMFERENCE = 2 * Math.PI * 90;
pomoRing.style.strokeDasharray = RING_CIRCUMFERENCE;

// Add gradient def for ring
const svgNS = "http://www.w3.org/2000/svg";
const ringSvg = pomoRing.closest("svg");
const defs = document.createElementNS(svgNS, "defs");
const grad = document.createElementNS(svgNS, "linearGradient");
grad.id = "pomoGrad";
grad.setAttribute("x1", "0%");
grad.setAttribute("y1", "0%");
grad.setAttribute("x2", "100%");
grad.setAttribute("y2", "100%");
const stop1 = document.createElementNS(svgNS, "stop");
stop1.setAttribute("offset", "0%");
stop1.setAttribute("stop-color", "#ef4444");
const stop2 = document.createElementNS(svgNS, "stop");
stop2.setAttribute("offset", "100%");
stop2.setAttribute("stop-color", "#f59e0b");
grad.appendChild(stop1);
grad.appendChild(stop2);
defs.appendChild(grad);
ringSvg.insertBefore(defs, ringSvg.firstChild);

// Save/restore timer state to localStorage
function savePomoState() {
  localStorage.setItem(
    "pomo-state",
    JSON.stringify({
      minutes: pomoState.minutes,
      totalSeconds: pomoState.totalSeconds,
      remaining: pomoState.remaining,
      running: pomoState.running,
      trackingTaskId: pomoState.trackingTaskId,
      savedAt: Date.now(),
    }),
  );
}

function restorePomoState() {
  const saved = localStorage.getItem("pomo-state");
  if (!saved) return;
  try {
    const data = JSON.parse(saved);
    pomoState.minutes = data.minutes;
    pomoState.totalSeconds = data.totalSeconds;
    pomoState.trackingTaskId = data.trackingTaskId || null;

    if (data.running && data.savedAt) {
      // Calculate elapsed time while page was closed
      const elapsedSec = Math.floor((Date.now() - data.savedAt) / 1000);
      const newRemaining = data.remaining - elapsedSec;

      if (newRemaining > 0) {
        pomoState.remaining = newRemaining;

        // Account for time tracked on task while page was closed
        if (pomoState.trackingTaskId) {
          const trackedTask = tasks.find(
            (t) => t.id === pomoState.trackingTaskId,
          );
          if (trackedTask) {
            trackedTask.timeSpent = (trackedTask.timeSpent || 0) + elapsedSec;
            save();
          }
        }
        // Record elapsed time for streak
        recordDailyTime(elapsedSec);

        // Auto-resume the timer
        updatePomoDisplay();
        updatePomoUI(true);
        startPomo();
        // Open the panel so user sees it's running
        pomoPanel.classList.add("open");
        pomoPanel.classList.add("pomo-running");
        pomoToggle.classList.add("active");
      } else {
        // Timer would have completed while page was closed
        const timeTracked = data.remaining; // seconds that were left = time that passed on task
        if (pomoState.trackingTaskId) {
          const trackedTask = tasks.find(
            (t) => t.id === pomoState.trackingTaskId,
          );
          if (trackedTask) {
            trackedTask.timeSpent = (trackedTask.timeSpent || 0) + timeTracked;
            save();
          }
        }
        // Record for streak
        recordDailyTime(timeTracked);
        pomoState.remaining = 0;
        pomoState.running = false;
        pomoState.sessions++;
        localStorage.setItem("pomo-sessions-today", pomoState.sessions);
        localStorage.setItem("pomo-last-date", new Date().toDateString());
        pomoSessionsEl.textContent = pomoState.sessions;
        pomoState.trackingTaskId = null;
        updatePomoDisplay();
        updatePomoUI(false);
        pomoLabel.textContent = "Session Complete! 🎉";
        clearPomoSavedState();
        renderCurrentView();
        return;
      }
    } else {
      // Was paused/stopped — just restore the remaining time
      pomoState.remaining = data.remaining;
      updatePomoDisplay();
      updatePomoUI(false);
    }

    // Update mode buttons
    $$(".pomo-mode").forEach((b) =>
      b.classList.toggle(
        "active",
        parseInt(b.dataset.minutes) === pomoState.minutes,
      ),
    );
  } catch (e) {
    clearPomoSavedState();
  }
}

function clearPomoSavedState() {
  localStorage.removeItem("pomo-state");
}

// Update UI elements based on running state
function updatePomoUI(isRunning) {
  if (isRunning) {
    pomoStart.style.display = "none";
    pomoPause.style.display = "flex";
    pomoModes.style.display = "none";
    pomoReset.style.display = "none";
    pomoTaskSelect.parentElement.style.display = "none";
  } else {
    pomoStart.style.display = "flex";
    pomoPause.style.display = "none";
    pomoModes.style.display = "flex";
    pomoReset.style.display =
      pomoState.remaining < pomoState.totalSeconds ? "flex" : "none";
    pomoTaskSelect.parentElement.style.display = "block";
  }
}

function updatePomoDisplay() {
  const mins = Math.floor(pomoState.remaining / 60);
  const secs = pomoState.remaining % 60;
  pomoTime.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  const progress = 1 - pomoState.remaining / pomoState.totalSeconds;
  pomoRing.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - progress);
}

function startPomo() {
  if (pomoState.running) return;
  pomoState.running = true;
  updatePomoUI(true);
  pomoLabel.textContent = "Focus Time 🎯";
  pomoPanel.classList.add("pomo-running");
  spawnPomoParticles();

  // Capture which task we're tracking (only if not already set from restore)
  if (!pomoState.trackingTaskId) {
    const selectedTaskId = pomoTaskSelect.value;
    pomoState.trackingTaskId = selectedTaskId || null;
  }

  savePomoState();

  pomoState.interval = setInterval(() => {
    pomoState.remaining--;
    updatePomoDisplay();

    // Track time on selected task every second
    if (pomoState.trackingTaskId) {
      const trackedTask = tasks.find((t) => t.id === pomoState.trackingTaskId);
      if (trackedTask) {
        trackedTask.timeSpent = (trackedTask.timeSpent || 0) + 1;
        if (pomoState.remaining % 10 === 0) save();
      }
    }

    // Record daily time for streak (every second)
    {
      const sd = getStreakData();
      const dk = localDateKey();
      const prevTime = sd.days[dk] || 0;
      sd.days[dk] = prevTime + 1;
      // Recalculate streak immediately when crossing 60s threshold, or every 10s
      if (
        (prevTime < 60 && sd.days[dk] >= 60) ||
        pomoState.remaining % 10 === 0
      ) {
        sd.current = calcStreak(sd.days);
        saveStreakData(sd);
        updateStreakUI();
      } else {
        saveStreakData(sd);
      }
    }

    // Persist timer state every 5 seconds
    if (pomoState.remaining % 5 === 0) savePomoState();

    if (pomoState.remaining <= 0) {
      clearInterval(pomoState.interval);
      pomoState.running = false;
      pomoPanel.classList.remove("pomo-running");
      clearPomoParticles();
      updatePomoUI(false);
      pomoLabel.textContent = "Session Complete! 🎉";

      save();
      clearPomoSavedState();
      renderCurrentView();

      pomoState.sessions++;
      localStorage.setItem("pomo-sessions-today", pomoState.sessions);
      localStorage.setItem("pomo-last-date", new Date().toDateString());
      pomoSessionsEl.textContent = pomoState.sessions;

      // Sound
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 800;
        osc.type = "sine";
        gain.gain.value = 0.3;
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
        setTimeout(() => {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.frequency.value = 1000;
          osc2.type = "sine";
          gain2.gain.value = 0.3;
          osc2.start();
          osc2.stop(ctx.currentTime + 0.3);
        }, 350);
      } catch (e) {}

      if (Notification.permission === "granted") {
        const taskName = pomoState.trackingTaskId
          ? tasks.find((t) => t.id === pomoState.trackingTaskId)?.title
          : "";
        new Notification("🍅 Pomodoro Complete!", {
          body: `Great focus session!${taskName ? " Worked on: " + taskName : ""}`,
        });
      }

      pomoState.trackingTaskId = null;
    }
  }, 1000);
}

function stopPomo() {
  clearInterval(pomoState.interval);
  pomoState.running = false;
  pomoPanel.classList.remove("pomo-running");
  clearPomoParticles();
  // Reset to full duration
  pomoState.remaining = pomoState.totalSeconds;
  pomoState.trackingTaskId = null;
  updatePomoUI(false);
  pomoReset.style.display = "none"; // Nothing to reset after stop
  pomoLabel.textContent = "Focus Time";
  save();
  clearPomoSavedState();
  renderCurrentView();
  updatePomoDisplay();
}

function resetPomo() {
  clearInterval(pomoState.interval);
  pomoState.running = false;
  pomoPanel.classList.remove("pomo-running");
  clearPomoParticles();
  pomoState.remaining = pomoState.totalSeconds;
  pomoState.trackingTaskId = null;
  updatePomoUI(false);
  pomoReset.style.display = "none";
  pomoLabel.textContent = "Focus Time";
  save();
  clearPomoSavedState();
  renderCurrentView();
  updatePomoDisplay();
}

function setPomoMode(minutes) {
  if (pomoState.running) return; // Don't allow mode change while running
  clearInterval(pomoState.interval);
  pomoState.running = false;
  pomoState.minutes = minutes;
  pomoState.totalSeconds = minutes * 60;
  pomoState.remaining = minutes * 60;
  pomoState.trackingTaskId = null;
  updatePomoUI(false);
  pomoReset.style.display = "none";
  pomoLabel.textContent = "Focus Time";
  $$(".pomo-mode").forEach((b) =>
    b.classList.toggle("active", parseInt(b.dataset.minutes) === minutes),
  );
  clearPomoSavedState();
  updatePomoDisplay();
}

function populatePomoTasks() {
  const activeTasks = tasks.filter((t) => t.status !== "done");
  const currentVal = pomoTaskSelect.value;
  pomoTaskSelect.innerHTML = '<option value="">— Select a task —</option>';
  activeTasks.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.title;
    pomoTaskSelect.appendChild(opt);
  });
  // Restore selection if still valid
  if (currentVal && activeTasks.find((t) => t.id === currentVal)) {
    pomoTaskSelect.value = currentVal;
  }
}

function togglePomoPanel() {
  const isOpen = pomoPanel.classList.toggle("open");
  pomoToggle.classList.toggle("active", isOpen);
  if (isOpen) {
    populatePomoTasks();
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }
}

// Pomo event listeners
pomoToggle.addEventListener("click", togglePomoPanel);
pomoClose.addEventListener("click", () => {
  pomoPanel.classList.remove("open");
  pomoToggle.classList.remove("active");
});
pomoStart.addEventListener("click", startPomo);
pomoPause.addEventListener("click", stopPomo);
pomoReset.addEventListener("click", resetPomo);
$$(".pomo-mode").forEach((b) =>
  b.addEventListener("click", () => setPomoMode(parseInt(b.dataset.minutes))),
);
updatePomoDisplay();
restorePomoState();

// ===== Event Listeners =====
newTaskBtn.addEventListener("click", openModal);
cancelBtn.addEventListener("click", closeModal);
modalCloseBtn.addEventListener("click", closeModal);
taskForm.addEventListener("submit", createTask);
addSubtaskBtn.addEventListener("click", addSubtask);
subtaskInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addSubtask();
  }
});
detailCloseBtn.addEventListener("click", closeDetail);
detailDeleteBtn.addEventListener("click", () => {
  if (viewingTaskId) deleteTask(viewingTaskId);
});

modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});
detailOverlay.addEventListener("click", (e) => {
  if (e.target === detailOverlay) closeDetail();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (detailOverlay.classList.contains("active")) closeDetail();
    else if (modalOverlay.classList.contains("active")) closeModal();
    else if (pomoPanel.classList.contains("open")) {
      pomoPanel.classList.remove("open");
      pomoToggle.classList.remove("active");
    }
  }
});

// View tabs
$$(".view-tab").forEach((tab) =>
  tab.addEventListener("click", () => switchView(tab.dataset.view)),
);

// Calendar nav
$("#calPrev").addEventListener("click", () => {
  calMonth--;
  if (calMonth < 0) {
    calMonth = 11;
    calYear--;
  }
  renderCalendar();
});
$("#calNext").addEventListener("click", () => {
  calMonth++;
  if (calMonth > 11) {
    calMonth = 0;
    calYear++;
  }
  renderCalendar();
});
$("#calToday").addEventListener("click", () => {
  const n = new Date();
  calYear = n.getFullYear();
  calMonth = n.getMonth();
  renderCalendar();
});

// ===== STREAK TRACKING =====
// Streak: user must track >= 1min (60s) of Pomodoro time per day
function localDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function localDateKeyFor(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function getStreakData() {
  return JSON.parse(
    localStorage.getItem("streak-data") || '{"days":{},"current":0}',
  );
}
function saveStreakData(data) {
  localStorage.setItem("streak-data", JSON.stringify(data));
}
function recordDailyTime(seconds) {
  const data = getStreakData();
  const dk = localDateKey();
  data.days[dk] = (data.days[dk] || 0) + seconds;
  data.current = calcStreak(data.days);
  saveStreakData(data);
  updateStreakUI();
}
function calcStreak(days) {
  let streak = 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const tk = localDateKeyFor(d);
  if ((days[tk] || 0) >= 60) {
    streak = 1;
    d.setDate(d.getDate() - 1);
    while (true) {
      const key = localDateKeyFor(d);
      if ((days[key] || 0) >= 60) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
  } else {
    d.setDate(d.getDate() - 1);
    const yKey = localDateKeyFor(d);
    if ((days[yKey] || 0) >= 60) {
      let tempStreak = 0;
      while (true) {
        const key = localDateKeyFor(d);
        if ((days[key] || 0) >= 60) {
          tempStreak++;
          d.setDate(d.getDate() - 1);
        } else {
          break;
        }
      }
      return -tempStreak; // Negative = at risk
    }
  }
  return streak;
}
function updateStreakUI() {
  const data = getStreakData();
  const streakEl = $("#streakCount");
  const btn = $("#streakBtn");
  const streak = data.current;
  const tk = localDateKey();
  const todayTime = data.days[tk] || 0;
  const todayMins = Math.floor(todayTime / 60);
  const todaySecs = todayTime % 60;

  if (streak > 0) {
    streakEl.textContent = streak;
    btn.classList.add("streak-active");
    btn.classList.remove("streak-risk");
    btn.title = `${streak} day streak! Today: ${todayMins}m tracked`;
  } else if (streak < 0) {
    streakEl.textContent = Math.abs(streak);
    btn.classList.remove("streak-active");
    btn.classList.add("streak-risk");
    const secsLeft = Math.max(0, 60 - todayTime);
    btn.title = `${Math.abs(streak)} day streak at risk! Track ${secsLeft}s more today. (${todayMins}m ${todaySecs}s so far)`;
  } else {
    streakEl.textContent = "0";
    btn.classList.remove("streak-active", "streak-risk");
    btn.title = `No streak yet. Track 1 min today to start! (${todayMins}m ${todaySecs}s so far)`;
  }
}

// Hook into Pomodoro completion to record daily time
const _origPomoComplete = null; // We'll patch the interval callback via a wrapper

// ===== LIGHT / DARK THEME =====
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
// Restore saved theme
const savedTheme = localStorage.getItem("taskflow-theme") || "dark";
applyTheme(savedTheme);
$("#themeToggle").addEventListener("click", toggleTheme);

// ===== Init =====
initCalendar();
renderCurrentView();
initDropZones();
initTouchDrag();
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
