const express = require("express");
const { supabase, unwrap } = require("../utils/supabaseClient");
const { getSubjectsForClass, needsStream, EXAM_TYPES } = require("../config/subjects");
const { resolveRequestedSession, listSessions } = require("../utils/sessions");

const router = express.Router();

const CLASSES = Array.from({ length: 12 }, (_, i) => String(i + 1));
const STREAMS = ["Science", "Commerce", "Arts"];

router.get("/classes", (req, res) => {
  res.json({ classes: CLASSES, streams: STREAMS, classesNeedingStream: CLASSES.filter((c) => needsStream(c)) });
});

router.get("/subjects/:class", (req, res) => {
  const { class: cls } = req.params;
  const { stream } = req.query;
  if (needsStream(cls) && !stream) {
    return res.json({ subjects: [], needsStream: true, streams: STREAMS });
  }
  res.json({ subjects: getSubjectsForClass(cls, stream), needsStream: needsStream(cls) });
});

router.get("/exam-types", (req, res) => {
  res.json({ examTypes: EXAM_TYPES });
});

// ---- School profile (name/address/phone/email + per-school WhatsApp creds) ----
router.get("/school", async (req, res) => {
  try {
    const school = unwrap(await supabase.from("schools").select("*").eq("id", req.user.schoolId).single());
    const session = await resolveRequestedSession(req.user.schoolId, req.query.sessionId);
    res.json({
      school: {
        id: school.id,
        name: school.name,
        address: school.address,
        phone: school.phone,
        email: school.email,
        session: session.label,
        whatsappConfigured: Boolean(school.whatsapp_token && school.whatsapp_phone_number_id),
        whatsappPhoneNumberId: school.whatsapp_phone_number_id || "",
        whatsappVerifyToken: school.whatsapp_verify_token || ""
      }
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.put("/school", async (req, res) => {
  try {
    const allowed = ["name", "address", "phone", "email"];
    const update = {};
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) update[k] = req.body[k];
    });
    // WhatsApp credentials — kept separate from the visible token value in responses.
    if (req.body.whatsappToken !== undefined) update.whatsapp_token = req.body.whatsappToken || null;
    if (req.body.whatsappPhoneNumberId !== undefined) update.whatsapp_phone_number_id = req.body.whatsappPhoneNumberId || null;
    if (req.body.whatsappVerifyToken !== undefined) update.whatsapp_verify_token = req.body.whatsappVerifyToken || null;

    const school = unwrap(
      await supabase.from("schools").update(update).eq("id", req.user.schoolId).select().single(),
      "Could not update school profile."
    );
    res.json({
      school: {
        id: school.id,
        name: school.name,
        address: school.address,
        phone: school.phone,
        email: school.email,
        whatsappConfigured: Boolean(school.whatsapp_token && school.whatsapp_phone_number_id)
      }
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ---- Dashboard analytics (scoped to a session) ----
router.get("/dashboard", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const session = await resolveRequestedSession(schoolId, req.query.sessionId);

    const enrollments = unwrap(
      await supabase.from("enrollments").select("*, students(*)").eq("school_id", schoolId).eq("session_id", session.id),
      "Could not load dashboard."
    );
    const rows = (enrollments || []).filter((e) => e.students);

    const classWise = {};
    CLASSES.forEach((c) => (classWise[c] = 0));
    let male = 0,
      female = 0,
      other = 0;

    rows.forEach((e) => {
      classWise[String(e.class)] = (classWise[String(e.class)] || 0) + 1;
      const g = e.students.gender;
      if (g === "Male") male++;
      else if (g === "Female") female++;
      else other++;
    });

    const recent = [...rows]
      .sort((a, b) => new Date(b.students.created_at) - new Date(a.students.created_at))
      .slice(0, 6)
      .map((e) => ({
        id: e.students.id,
        name: e.students.name,
        regNo: e.students.reg_no,
        class: e.class,
        section: e.section,
        stream: e.stream,
        photoUrl: e.students.photo_url
      }));

    // ---- "Reports" snapshot (replaces the old Quick Actions block) ----
    let totalFeeCollected = 0,
      totalFeeExpected = 0;
    rows.forEach((e) => {
      const fees = e.fees || { totalFee: 0, paidFee: 0 };
      totalFeeCollected += Number(fees.paidFee || 0);
      totalFeeExpected += Number(fees.totalFee || 0);
    });

    const studentIds = rows.map((e) => e.students.id);
    let reportsSentThisMonth = 0;
    if (studentIds.length) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const logs = unwrap(
        await supabase
          .from("report_logs")
          .select("id", { count: "exact" })
          .eq("school_id", schoolId)
          .in("student_id", studentIds)
          .gte("sent_at", monthStart.toISOString())
      );
      reportsSentThisMonth = (logs || []).length;
    }

    const unread = unwrap(
      await supabase.from("notifications").select("id", { count: "exact" }).eq("school_id", schoolId).eq("read", false)
    );

    const today = new Date().toISOString().slice(0, 10);
    const todayAttendance = studentIds.length
      ? unwrap(
          await supabase
            .from("attendance_records")
            .select("status")
            .eq("school_id", schoolId)
            .eq("session_id", session.id)
            .eq("date", today)
            .in("student_id", studentIds)
        )
      : [];
    const presentToday = (todayAttendance || []).filter((r) => r.status === "present").length;
    const markedToday = (todayAttendance || []).length;

    res.json({
      totalStudents: rows.length,
      totalClasses: CLASSES.length,
      classWise,
      genderSplit: { male, female, other },
      recent,
      session,
      reportsSnapshot: {
        reportsSentThisMonth,
        unreadReplies: (unread || []).length,
        feeCollectionPct: totalFeeExpected ? Math.round((totalFeeCollected / totalFeeExpected) * 100) : null,
        feeDue: Math.max(0, totalFeeExpected - totalFeeCollected),
        attendanceMarkedToday: markedToday,
        presentToday
      }
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
