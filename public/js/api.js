// ===== Shared frontend utilities =====

const API_BASE = "/api";

function getToken() {
  return localStorage.getItem("vs_token");
}
function getAdminUser() {
  try {
    return JSON.parse(localStorage.getItem("vs_admin_user") || "null");
  } catch {
    return null;
  }
}
function setSession(token, user) {
  localStorage.setItem("vs_token", token);
  localStorage.setItem("vs_admin_user", JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem("vs_token");
  localStorage.removeItem("vs_admin_user");
}

// Redirect to login if no token present. Call at top of every protected page.
function requireAuthOrRedirect() {
  if (!getToken()) {
    window.location.href = "index.html";
  }
}

/* ============================================================
   Active academic session (the "View previous session" control)
   ============================================================ */
function getViewingSessionId() {
  return localStorage.getItem("vs_viewing_session_id") || "";
}
function setViewingSessionId(id) {
  if (id) localStorage.setItem("vs_viewing_session_id", id);
  else localStorage.removeItem("vs_viewing_session_id");
}
// Appends the currently-viewed session (if any) to an API query string.
function withSession(params) {
  const p = params instanceof URLSearchParams ? params : new URLSearchParams(params || {});
  const sid = getViewingSessionId();
  if (sid) p.set("sessionId", sid);
  return p;
}

async function apiFetch(path, options = {}) {
  const headers = options.headers || {};
  if (!(options.body instanceof Blob)) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers["Authorization"] = "Bearer " + token;

  const res = await fetch(API_BASE + path, { ...options, headers });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (res.status === 401) {
    clearSession();
    window.location.href = "index.html";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    throw new Error(data.error || "Something went wrong. Please try again.");
  }
  return data;
}

// Downloads a file from a protected (auth-required) endpoint — plain
// <a href> can't attach the Authorization header, so we fetch as a
// blob and trigger the save ourselves.
async function apiDownload(path, filenameFallback) {
  const token = getToken();
  const res = await fetch(API_BASE + path, {
    headers: token ? { Authorization: "Bearer " + token } : {}
  });
  if (!res.ok) {
    let msg = "Could not generate the file.";
    try {
      const j = await res.json();
      msg = j.error || msg;
    } catch {}
    throw new Error(msg);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = (match && match[1]) || filenameFallback || "download.xlsx";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function logout() {
  clearSession();
  window.location.href = "index.html";
}

// ===== Toast =====
function toast(message, type = "info") {
  let root = document.getElementById("toast-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "toast-root";
    document.body.appendChild(root);
  }
  const el = document.createElement("div");
  el.className = "toast " + (type === "error" ? "error" : type === "success" ? "success" : "");
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ===== small helpers =====
function initials(name) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function ordinalClass(c) {
  const map = { "1": "1st", "2": "2nd", "3": "3rd" };
  return (map[c] || c + "th") + " Class";
}

function debounce(fn, wait = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function computeSummary(student) {
  const subjects = student.subjects || [];
  let bestExamKey = "final";
  const hasFinal = subjects.some((s) => student.marks[s] && student.marks[s].final !== null);
  const hasHalf = subjects.some((s) => student.marks[s] && student.marks[s].halfYearly !== null);
  if (!hasFinal && hasHalf) bestExamKey = "halfYearly";

  let obtained = 0,
    max = 0,
    filledCount = 0;
  subjects.forEach((s) => {
    const v = student.marks[s] ? student.marks[s][bestExamKey] : null;
    const examMax = bestExamKey === "final" || bestExamKey === "halfYearly" ? 100 : 25;
    if (v !== null && v !== undefined) {
      obtained += Number(v);
      max += examMax;
      filledCount++;
    }
  });
  const percentage = max > 0 ? (obtained / max) * 100 : null;
  let grade = "-";
  if (percentage !== null) {
    if (percentage >= 90) grade = "A+";
    else if (percentage >= 75) grade = "A";
    else if (percentage >= 60) grade = "B";
    else if (percentage >= 45) grade = "C";
    else grade = "D";
  }
  return { obtained, max, percentage, grade, examLabel: bestExamKey === "final" ? "Final" : "Half Yearly", filledCount };
}

/* ============================================================
   Photo helper — resizes/compresses a chosen photo file down to a
   small JPEG data-URL client-side, so it can travel inside the same
   JSON create/update student request (no separate upload endpoint,
   no storage bucket setup required).
   ============================================================ */
function compressImageFile(file, maxDim = 420, quality = 0.75) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (!file.type.startsWith("image/")) return reject(new Error("Please choose an image file."));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected photo."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not read the selected photo."));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
