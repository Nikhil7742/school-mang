const express = require("express");
const { supabase, unwrap } = require("../utils/supabaseClient");
const { resolveRequestedSession } = require("../utils/sessions");
const { getAttendanceSummary } = require("../utils/attendance");

const router = express.Router();

// ---- Daily register: students of a class/section with their status for one date ----
router.get("/daily", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const session = await resolveRequestedSession(schoolId, req.query.sessionId);
    const { class: cls, section, date } = req.query;
    const targetDate = date || new Date().toISOString().slice(0, 10);

    if (!cls) return res.status(400).json({ error: "Class is required." });

    let query = supabase
      .from("enrollments")
      .select("*, students(*)")
      .eq("school_id", schoolId)
      .eq("session_id", session.id)
      .eq("class", String(cls));
    if (section) query = query.ilike("section", section);

    const enrollments = unwrap(await query, "Could not load class list.");
    const rows = (enrollments || []).filter((e) => e.students);
    const studentIds = rows.map((e) => e.students.id);

    let existing = [];
    if (studentIds.length) {
      existing = unwrap(
        await supabase
          .from("attendance_records")
          .select("*")
          .eq("school_id", schoolId)
          .eq("session_id", session.id)
          .eq("date", targetDate)
          .in("student_id", studentIds)
      );
    }
    const statusByStudent = {};
    (existing || []).forEach((r) => (statusByStudent[r.student_id] = r.status));

    const students = rows
      .map((e) => ({
        id: e.students.id,
        name: e.students.name,
        regNo: e.students.reg_no,
        rollNo: e.roll_no,
        photoUrl: e.students.photo_url,
        status: statusByStudent[e.students.id] || null
      }))
      .sort((a, b) => Number(a.rollNo) - Number(b.rollNo));

    res.json({ date: targetDate, class: cls, section: section || "", students, session });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ---- Save/overwrite a whole day's attendance in one call ----
// body: { date, sessionId?, records: [{ studentId, status: 'present'|'absent'|'leave' }] }
router.post("/mark", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const session = await resolveRequestedSession(schoolId, req.body.sessionId);
    const { date, records } = req.body || {};

    if (!date) return res.status(400).json({ error: "Date is required." });
    if (!Array.isArray(records) || !records.length) {
      return res.status(400).json({ error: "At least one student's attendance status is required." });
    }

    const validStatuses = new Set(["present", "absent", "leave"]);
    const upsertRows = [];
    for (const r of records) {
      if (!r.studentId || !validStatuses.has(r.status)) continue;
      upsertRows.push({
        school_id: schoolId,
        student_id: r.studentId,
        session_id: session.id,
        date,
        status: r.status
      });
    }
    if (!upsertRows.length) return res.status(400).json({ error: "No valid attendance entries to save." });

    const saved = unwrap(
      await supabase.from("attendance_records").upsert(upsertRows, { onConflict: "school_id,student_id,date" }).select(),
      "Could not save attendance."
    );

    res.json({ ok: true, saved: saved.length, date, session });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ---- Monthly calendar view for one student ----
router.get("/monthly", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const session = await resolveRequestedSession(schoolId, req.query.sessionId);
    const { studentId, month } = req.query; // month = 'YYYY-MM'

    if (!studentId || !month) return res.status(400).json({ error: "studentId and month (YYYY-MM) are required." });

    const start = `${month}-01`;
    const [y, m] = month.split("-").map(Number);
    const endDate = new Date(y, m, 0); // last day of month
    const end = endDate.toISOString().slice(0, 10);

    const rows = unwrap(
      await supabase
        .from("attendance_records")
        .select("date, status")
        .eq("school_id", schoolId)
        .eq("session_id", session.id)
        .eq("student_id", studentId)
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: true })
    );

    const summary = await getAttendanceSummary(schoolId, studentId, session.id);
    res.json({ month, records: rows || [], sessionSummary: summary });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
