const NAV_ITEMS = [
  { href: "dashboard.html", key: "dashboard", label: "Dashboard", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>` },
  { href: "students.html", key: "students", label: "Students", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>` },
  { href: "marks.html", key: "marks", label: "Marks Entry", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>` },
  { href: "attendance.html", key: "attendance", label: "Attendance", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 16 2 2 4-4"/></svg>` },
  { href: "reports.html", key: "reports", label: "Report Cards", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15h6M9 11h2"/></svg>` },
  { href: "settings.html", key: "settings", label: "School Settings", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>` }
];

// Icons swapped on the sidebar-collapse toggle button
const ICON_MENU_OPEN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M3 12h18M3 6h18M3 18h18"/></svg>`;
const ICON_MENU_CLOSE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M18 6 6 18M6 6l12 12"/></svg>`;

function renderShell({ activeKey, eyebrow, title }) {
  requireAuthOrRedirect();
  const user = getAdminUser() || { name: "Admin" };

  const navHtml = NAV_ITEMS.map(
    (item) => `<a href="${item.href}" class="${item.key === activeKey ? "active" : ""}" data-label="${item.label}">${item.icon}<span class="nav-label">${item.label}</span></a>`
  ).join("");

  const shell = document.createElement("div");
  shell.className = "app-shell";
  const sidebarCollapsed = localStorage.getItem("vs_sidebar_collapsed") === "1";
  shell.innerHTML = `
    <aside class="sidebar${sidebarCollapsed ? " collapsed" : ""}" id="sidebar">
      <div class="brand">
        <div class="glyph">VS</div>
        <div class="name">Vidya Setu<small>${(user.schoolName || "School Management")}</small></div>
      </div>
      <nav>${navHtml}</nav>
      <div class="sidebar-footer">
        <div class="user-chip">
          <div class="avatar">${initials(user.name)}</div>
          <div>
            <div class="u-name">${user.name}</div>
            <div class="u-role">Administrator</div>
          </div>
        </div>
        <button class="logout-btn" onclick="logout()">Log Out</button>
      </div>
    </aside>
    <div class="main-col">
      <header class="topbar">
        <div style="display:flex;align-items:center;gap:12px;">
          <button class="menu-toggle icon-btn" id="menu-toggle-btn" title="Toggle sidebar controls">
            ${sidebarCollapsed ? ICON_MENU_OPEN : ICON_MENU_CLOSE}
          </button>
          <div class="page-title">
            <span class="eyebrow">${eyebrow || ""}</span>
            <h1>${title || ""}</h1>
          </div>
        </div>
        <div class="top-actions">
          <div class="session-switch-wrap" id="session-switch-wrap">
            <button class="session-switch-btn" id="session-switch-btn" title="Switch academic session">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
              <span id="session-switch-label">Session</span>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            <div class="session-switch-panel" id="session-switch-panel"></div>
          </div>
          <span class="mono" style="font-size:12px;color:var(--slate);">${new Date().toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}</span>
          <div class="notif-wrap" id="notif-wrap">
            <button class="icon-btn notif-bell" id="notif-bell" title="Notifications">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              <span class="notif-dot" id="notif-dot" style="display:none;"></span>
            </button>
            <div class="notif-panel" id="notif-panel">
              <div class="notif-panel-head">
                <h4>Parent Replies</h4>
                <button class="btn-ghost btn-sm" id="notif-mark-all" style="font-size:11.5px;">Mark all read</button>
              </div>
              <div class="notif-list" id="notif-list"><div class="center-loader" style="padding:24px;"><div class="loader"></div></div></div>
            </div>
          </div>
        </div>
      </header>
      <main class="content" id="page-content"></main>
    </div>
  `;

  document.body.insertBefore(shell, document.body.firstChild);
  initSidebarToggle();
  initSessionSwitcher();
  initNotifications();
  return document.getElementById("page-content");
}

/* ============================================================
   Sidebar collapse toggle — clicking the icon next to the page
   title toggles the left navigation bar, and the icon itself swaps
   between the "menu" and "close" glyph to reflect the new state.
   ============================================================ */
function initSidebarToggle() {
  const btn = document.getElementById("menu-toggle-btn");
  const sidebar = document.getElementById("sidebar");
  btn.addEventListener("click", () => {
    const isMobile = window.matchMedia("(max-width: 880px)").matches;
    if (isMobile) {
      const nowOpen = sidebar.classList.toggle("open");
      btn.innerHTML = nowOpen ? ICON_MENU_CLOSE : ICON_MENU_OPEN;
    } else {
      const nowCollapsed = sidebar.classList.toggle("collapsed");
      localStorage.setItem("vs_sidebar_collapsed", nowCollapsed ? "1" : "0");
      btn.innerHTML = nowCollapsed ? ICON_MENU_OPEN : ICON_MENU_CLOSE;
    }
  });
}

/* ============================================================
   Academic session switcher — lets an admin flip between the
   current session and any previous session to view its historical
   data (students / marks / attendance / dashboard all respect this).
   ============================================================ */
async function initSessionSwitcher() {
  const btn = document.getElementById("session-switch-btn");
  const panel = document.getElementById("session-switch-panel");
  const label = document.getElementById("session-switch-label");

  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const isOpen = panel.classList.toggle("show");
    if (isOpen) await loadSessionPanel();
  });
  document.addEventListener("click", (e) => {
    if (!document.getElementById("session-switch-wrap").contains(e.target)) panel.classList.remove("show");
  });

  try {
    const data = await apiFetch("/sessions");
    const viewing = getViewingSessionId() || data.activeSessionId;
    const current = data.sessions.find((s) => s.id === viewing);
    label.textContent = current ? current.label : "Session";
    if (viewing && viewing !== data.activeSessionId) {
      btn.classList.add("viewing-past");
      label.textContent += " (past)";
    }
  } catch {
    /* ignore — page will still work against the active session */
  }
}

async function loadSessionPanel() {
  const panel = document.getElementById("session-switch-panel");
  panel.innerHTML = `<div class="center-loader" style="padding:18px;"><div class="loader"></div></div>`;
  try {
    const data = await apiFetch("/sessions");
    const viewing = getViewingSessionId() || data.activeSessionId;
    const rows = data.sessions
      .map(
        (s) => `
        <button class="session-option ${s.id === viewing ? "active" : ""}" onclick="chooseSession('${s.id}')">
          <span>${s.label}</span>
          ${s.id === data.activeSessionId ? '<span class="tag-pill" style="background:var(--leaf-light);color:var(--leaf);">Current</span>' : '<span class="tag-pill" style="background:var(--navy-100);color:var(--navy-700);">Past</span>'}
        </button>`
      )
      .join("");
    panel.innerHTML = `
      <div class="session-switch-panel-head">View a different academic session</div>
      <div class="session-option-list">${rows}</div>
      <a href="settings.html#sessions" class="session-manage-link">+ Start a new session</a>
    `;
  } catch (err) {
    panel.innerHTML = `<div class="empty-state" style="padding:20px;"><p style="margin:0;font-size:12.5px;">${err.message}</p></div>`;
  }
}

function chooseSession(id) {
  setViewingSessionId(id);
  window.location.reload();
}

/* ============================================================
   Notification bell — parent WhatsApp replies
   ============================================================ */
let NOTIF_POLL_TIMER = null;

function initNotifications() {
  const bell = document.getElementById("notif-bell");
  const panel = document.getElementById("notif-panel");
  const markAllBtn = document.getElementById("notif-mark-all");

  bell.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = panel.classList.toggle("show");
    if (isOpen) loadNotifications();
  });
  document.addEventListener("click", (e) => {
    if (!document.getElementById("notif-wrap").contains(e.target)) panel.classList.remove("show");
  });
  markAllBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    await apiFetch("/notifications/read-all", { method: "PUT" });
    loadNotifications();
    refreshUnreadCount();
  });

  refreshUnreadCount();
  NOTIF_POLL_TIMER = setInterval(refreshUnreadCount, 15000);
}

async function refreshUnreadCount() {
  try {
    const data = await apiFetch("/notifications/unread-count");
    const dot = document.getElementById("notif-dot");
    if (!dot) return;
    if (data.unreadCount > 0) {
      dot.style.display = "flex";
      dot.textContent = data.unreadCount > 9 ? "9+" : data.unreadCount;
    } else {
      dot.style.display = "none";
    }
  } catch {
    /* ignore polling errors (e.g. brief network blip) */
  }
}

async function loadNotifications() {
  const list = document.getElementById("notif-list");
  try {
    const data = await apiFetch("/notifications");
    if (!data.notifications.length) {
      list.innerHTML = `<div class="empty-state" style="padding:30px 16px;"><p style="margin:0;font-size:13px;">No parent replies yet.</p></div>`;
      return;
    }
    list.innerHTML = data.notifications
      .map(
        (n) => `
        <div class="notif-item ${n.read ? "" : "unread"}" onclick="openNotification('${n.id}')">
          <div class="notif-avatar">${initials(n.studentName || "?")}</div>
          <div class="notif-body">
            <div class="notif-title">${n.studentName || "Unknown number"}</div>
            <div class="notif-msg">${(n.message || "").slice(0, 70)}${(n.message || "").length > 70 ? "…" : ""}</div>
            <div class="notif-time">${timeAgo(n.receivedAt)}</div>
          </div>
          ${n.read ? "" : `<span class="notif-unread-dot"></span>`}
        </div>`
      )
      .join("");
  } catch (err) {
    list.innerHTML = `<div class="empty-state" style="padding:24px;"><p style="margin:0;font-size:13px;">${err.message}</p></div>`;
  }
}

let NOTIF_CACHE = [];
async function openNotification(id) {
  const data = await apiFetch("/notifications");
  NOTIF_CACHE = data.notifications;
  const n = NOTIF_CACHE.find((x) => String(x.id) === String(id));
  if (!n) return;

  if (!n.read) {
    await apiFetch(`/notifications/${id}/read`, { method: "PUT" });
    refreshUnreadCount();
    loadNotifications();
  }

  let studentHtml = `<p style="font-size:13px;color:var(--slate);">This number does not match any student on record.</p>`;
  if (n.studentId) {
    try {
      const sd = await apiFetch("/students/" + n.studentId + "?" + withSession().toString());
      const s = sd.student;
      studentHtml = `
        <div class="report-meta-grid" style="margin-bottom:0;">
          <div><span>Class / Section</span><span>${s.class}-${s.section}${s.stream ? " · " + s.stream : ""}</span></div>
          <div><span>Roll No.</span><span>${s.rollNo}</span></div>
          <div><span>Father's Name</span><span>${s.fatherName}</span></div>
          <div><span>Contact</span><span>${s.contact || "-"}</span></div>
        </div>`;
    } catch {
      /* student may have been removed since, or not enrolled in the session being viewed */
    }
  }

  showModalDialog(
    `Message about ${n.studentName || "Unknown"}`,
    `
    <div class="wa-bubble">
      <div class="wa-bubble-meta">${n.from || ""} · ${timeAgo(n.receivedAt)}</div>
      <div class="wa-bubble-text">${(n.message || "").replace(/</g, "&lt;")}</div>
    </div>
    <div class="field-section-title">Student Details</div>
    ${studentHtml}
    `
  );
}

// Small generic modal used for notification detail (avoids per-page duplication)
function showModalDialog(title, bodyHtml) {
  let overlay = document.getElementById("generic-modal");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = "generic-modal";
    overlay.innerHTML = `
      <div class="modal" style="max-width:480px;">
        <div class="modal-head">
          <h3 id="generic-modal-title"></h3>
          <button class="modal-close" onclick="document.getElementById('generic-modal').classList.remove('show')">✕</button>
        </div>
        <div class="modal-body" id="generic-modal-body"></div>
      </div>`;
    document.body.appendChild(overlay);
  }
  document.getElementById("generic-modal-title").textContent = title;
  document.getElementById("generic-modal-body").innerHTML = bodyHtml;
  overlay.classList.add("show");
}

function timeAgo(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  const days = Math.floor(hrs / 24);
  return days + "d ago";
}
