// Helpers to compute a student's attendance summary from the
// attendance_records table. Wherever the app used to show a manually
// typed "Days Present / Total Days" field, it now fetches this
// computed value automatically instead.

const { supabase, unwrap } = require("./supabaseClient");

// Returns { presentDays, totalDays } for one student in one session.
// totalDays = every day that was marked at all (present + absent + leave counts as a working day, leave excluded from denominator by choice below).
async function getAttendanceSummary(schoolId, studentId, sessionId) {
  const rows = unwrap(
    await supabase
      .from("attendance_records")
      .select("status")
      .eq("school_id", schoolId)
      .eq("student_id", studentId)
      .eq("session_id", sessionId)
  );
  let presentDays = 0;
  let totalDays = 0;
  (rows || []).forEach((r) => {
    if (r.status === "present" || r.status === "absent") {
      totalDays += 1;
      if (r.status === "present") presentDays += 1;
    }
    // 'leave' days are excluded from both counts (neither present nor counted absent)
  });
  return { presentDays, totalDays };
}

// Batched version — computes the summary for many students in one
// session at once (used by dashboard / class lists / excel export so
// we don't run N queries for N students).
async function getAttendanceSummaryBulk(schoolId, studentIds, sessionId) {
  const map = {};
  studentIds.forEach((id) => (map[id] = { presentDays: 0, totalDays: 0 }));
  if (!studentIds.length) return map;

  const rows = unwrap(
    await supabase
      .from("attendance_records")
      .select("student_id, status")
      .eq("school_id", schoolId)
      .eq("session_id", sessionId)
      .in("student_id", studentIds)
  );
  (rows || []).forEach((r) => {
    if (!map[r.student_id]) map[r.student_id] = { presentDays: 0, totalDays: 0 };
    if (r.status === "present" || r.status === "absent") {
      map[r.student_id].totalDays += 1;
      if (r.status === "present") map[r.student_id].presentDays += 1;
    }
  });
  return map;
}

module.exports = { getAttendanceSummary, getAttendanceSummaryBulk };
