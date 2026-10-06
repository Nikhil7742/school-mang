const express = require("express");
const { supabase, unwrap } = require("../utils/supabaseClient");
const { sendWhatsAppMessage, isLiveModeEnabled, normalizePhone } = require("../utils/whatsapp");
const { buildReportMessage } = require("../utils/reportMessage");
const { resolveRequestedSession } = require("../utils/sessions");
const { getAttendanceSummary } = require("../utils/attendance");

const router = express.Router();

async function loadStudentWithEnrollment(schoolId, studentId, session) {
  const student = unwrap(
    await supabase.from("students").select("*").eq("id", studentId).eq("school_id", schoolId).maybeSingle()
  );
  if (!student) return null;
  const enrollment = unwrap(
    await supabase.from("enrollments").select("*").eq("student_id", studentId).eq("session_id", session.id).maybeSingle()
  );
  if (!enrollment) return null;
  return {
    id: student.id,
    name: student.name,
    regNo: student.reg_no,
    rollNo: enrollment.roll_no,
    class: enrollment.class,
    section: enrollment.section,
    stream: enrollment.stream,
    subjects: enrollment.subjects || [],
    marks: enrollment.marks || {},
    fees: enrollment.fees || { totalFee: 0, paidFee: 0 },
    contact: student.contact,
    altContact: student.alt_contact
  };
}

// ---- Send a student's report to the parent's WhatsApp ----
// body: { description?: string, featuredExamKeys?: string[], sessionId?: string }
router.post("/:studentId/send", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const session = await resolveRequestedSession(schoolId, req.body.sessionId);

    const school = unwrap(await supabase.from("schools").select("*").eq("id", schoolId).single());
    const student = await loadStudentWithEnrollment(schoolId, req.params.studentId, session);
    if (!student) return res.status(404).json({ error: "Student not found in this session." });

    const description = (req.body && req.body.description) || "";
    const featuredExamKeys = Array.isArray(req.body.featuredExamKeys) ? req.body.featuredExamKeys : req.body.featuredExam ? [req.body.featuredExam] : [];
    const parentNumber = student.contact || student.altContact;

    if (!parentNumber) {
      return res.status(400).json({ error: "This student has no parent WhatsApp number on record (set at admission)." });
    }

    const attendance = await getAttendanceSummary(schoolId, student.id, session.id);
    const message = buildReportMessage({
      school: { name: school.name, phone: school.phone },
      student,
      description,
      attendance,
      featuredExamKeys
    });

    const result = await sendWhatsAppMessage(school, parentNumber, message);
    if (!result.ok) {
      return res.status(502).json({ error: result.error || "Failed to send WhatsApp message." });
    }

    unwrap(
      await supabase.from("report_logs").insert({
        school_id: schoolId,
        student_id: student.id,
        session_id: session.id,
        description,
        to_number: result.to,
        simulated: !!result.simulated
      })
    );

    res.json({
      ok: true,
      simulated: !!result.simulated,
      liveMode: isLiveModeEnabled(school),
      message,
      to: normalizePhone(parentNumber)
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ---- History of reports sent for a student ----
router.get("/:studentId/history", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const student = unwrap(
      await supabase.from("students").select("id").eq("id", req.params.studentId).eq("school_id", schoolId).maybeSingle()
    );
    if (!student) return res.status(404).json({ error: "Student not found." });

    const logs = unwrap(
      await supabase
        .from("report_logs")
        .select("*")
        .eq("school_id", schoolId)
        .eq("student_id", student.id)
        .order("sent_at", { ascending: false })
    );
    res.json({
      reportLogs: (logs || []).map((l) => ({
        id: l.id,
        sentAt: l.sent_at,
        description: l.description,
        to: l.to_number,
        simulated: l.simulated
      }))
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
