const express = require("express");
const { supabase, unwrap } = require("../utils/supabaseClient");
const { listSessions, getActiveSession } = require("../utils/sessions");

const router = express.Router();

// ---- List every academic session this school has (newest first) ----
router.get("/", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const sessions = await listSessions(schoolId);
    const active = await getActiveSession(schoolId);
    res.json({ sessions, activeSessionId: active.id });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ---- Start a new academic session (e.g. moving from 2026-27 to 2027-28) ----
router.post("/", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { label, startDate, endDate, makeActive } = req.body || {};
    if (!label || !String(label).trim()) {
      return res.status(400).json({ error: "Session label is required, e.g. 2027-2028." });
    }

    const session = unwrap(
      await supabase
        .from("academic_sessions")
        .insert({
          school_id: schoolId,
          label: String(label).trim(),
          start_date: startDate || null,
          end_date: endDate || null,
          is_active: false,
          reg_counters: {}
        })
        .select()
        .single(),
      "Could not create academic session."
    );

    if (makeActive !== false) {
      unwrap(await supabase.from("schools").update({ active_session_id: session.id }).eq("id", schoolId));
    }

    res.status(201).json({ session });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ---- Switch which session is "active" (used for new admissions / daily attendance) ----
router.put("/:id/activate", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const session = unwrap(
      await supabase.from("academic_sessions").select("*").eq("id", req.params.id).eq("school_id", schoolId).maybeSingle()
    );
    if (!session) return res.status(404).json({ error: "Session not found." });

    unwrap(await supabase.from("schools").update({ active_session_id: session.id }).eq("id", schoolId));
    res.json({ session });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
