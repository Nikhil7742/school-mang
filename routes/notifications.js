const express = require("express");
const { supabase, unwrap } = require("../utils/supabaseClient");

const router = express.Router();

function toClient(n) {
  return {
    id: n.id,
    studentId: n.student_id,
    studentName: n.student_name,
    from: n.from_number,
    message: n.message,
    receivedAt: n.received_at,
    read: n.read
  };
}

// ---- List all notifications for this school (most recent first) ----
router.get("/", async (req, res) => {
  try {
    const rows = unwrap(
      await supabase
        .from("notifications")
        .select("*")
        .eq("school_id", req.user.schoolId)
        .order("received_at", { ascending: false })
    );
    const list = (rows || []).map(toClient);
    res.json({ notifications: list, unreadCount: list.filter((n) => !n.read).length });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ---- Unread count only (lightweight, for polling) ----
router.get("/unread-count", async (req, res) => {
  try {
    const rows = unwrap(
      await supabase.from("notifications").select("id", { count: "exact" }).eq("school_id", req.user.schoolId).eq("read", false)
    );
    res.json({ unreadCount: (rows || []).length });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ---- Mark a single notification as read ----
router.put("/:id/read", async (req, res) => {
  try {
    const updated = unwrap(
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", req.params.id)
        .eq("school_id", req.user.schoolId)
        .select()
        .maybeSingle()
    );
    if (!updated) return res.status(404).json({ error: "Notification not found." });
    res.json({ notification: toClient(updated) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ---- Mark all as read ----
router.put("/read-all", async (req, res) => {
  try {
    unwrap(await supabase.from("notifications").update({ read: true }).eq("school_id", req.user.schoolId).eq("read", false));
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
