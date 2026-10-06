const express = require("express");
const XLSX = require("xlsx");
const { supabase, unwrap } = require("../utils/supabaseClient");
const { getSubjectsForClass, needsStream, EXAM_TYPES } = require("../config/subjects");
const { getActiveSession, resolveRequestedSession } = require("../utils/sessions");
const { getAttendanceSummary, getAttendanceSummaryBulk } = require("../utils/attendance");

const router = express.Router();

// ---- shape helpers ----
function toClientStudent(student, enrollment, attendance) {
  return {
    id: student.id,
    regNo: student.reg_no,
    name: student.name,
    fatherName: student.father_name,
    motherName: student.mother_name || "",
    dob: student.dob,
    gender: student.gender || "",
    address: student.address || "",
    contact: student.contact || "",
    altContact: student.alt_contact || "",
    email: student.email || "",
    photoUrl: student.photo_url || null,
    admissionDate: student.admission_date,
    createdAt: student.created_at,
    // enrollment (session-scoped) fields
    class: enrollment ? enrollment.class : null,
    section: enrollment ? enrollment.section : null,
    stream: enrollment ? enrollment.stream : null,
    rollNo: enrollment ? enrollment.roll_no : null,
    subjects: enrollment ? enrollment.subjects || [] : [],
    marks: enrollment ? enrollment.marks || {} : {},
    fees: enrollment ? enrollment.fees || { totalFee: 0, paidFee: 0 } : { totalFee: 0, paidFee: 0 },
    sessionId: enrollment ? enrollment.session_id : null,
    enrollmentId: enrollment ? enrollment.id : null,
    attendance: attendance || { presentDays: 0, totalDays: 0 }
  };
}

async function nextRegNo(schoolId, session, className) {
  const key = String(className);
  const counters = session.reg_counters || {};
  const next = (counters[key] || 0) + 1;
  counters[key] = next;
  unwrap(await supabase.from("academic_sessions").update({ reg_counters: counters }).eq("id", session.id));
  return String(parseInt(className, 10) * 100 + next);
}

// ---- List students (optionally filtered), scoped to a session ----
router.get("/", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const session = await resolveRequestedSession(schoolId, req.query.sessionId);
    const { class: cls, section, stream, search } = req.query;

    let query = supabase
      .from("enrollments")
      .select("*, students(*)")
      .eq("school_id", schoolId)
      .eq("session_id", session.id);

    if (cls) query = query.eq("class", String(cls));
    if (section) query = query.ilike("section", section);
    if (stream) query = query.ilike("stream", stream);

    const enrollments = unwrap(await query, "Could not load students.");

    let list = (enrollments || [])
      .filter((e) => e.students)
      .map((e) => toClientStudent(e.students, e, null));

    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          String(s.regNo).toLowerCase().includes(q) ||
          String(s.rollNo).toLowerCase().includes(q) ||
          (s.fatherName || "").toLowerCase().includes(q) ||
          (s.contact || "").includes(q)
      );
    }

    // fill in computed attendance for the returned page of students
    const summaryMap = await getAttendanceSummaryBulk(
      schoolId,
      list.map((s) => s.id),
      session.id
    );
    list.forEach((s) => (s.attendance = summaryMap[s.id] || { presentDays: 0, totalDays: 0 }));

    list.sort((a, b) => {
      if (Number(a.class) !== Number(b.class)) return Number(a.class) - Number(b.class);
      return Number(a.rollNo) - Number(b.rollNo);
    });

    res.json({ students: list, total: list.length, session });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ---- Export filtered students to Excel (.xlsx) — only key columns ----
router.get("/export", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const session = await resolveRequestedSession(schoolId, req.query.sessionId);
    const { class: cls, section, stream, search } = req.query;

    let query = supabase.from("enrollments").select("*, students(*)").eq("school_id", schoolId).eq("session_id", session.id);
    if (cls) query = query.eq("class", String(cls));
    if (section) query = query.ilike("section", section);
    if (stream) query = query.ilike("stream", stream);

    const enrollments = unwrap(await query, "Could not load students.");
    let list = (enrollments || []).filter((e) => e.students).map((e) => toClientStudent(e.students, e, null));

    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          String(s.regNo).toLowerCase().includes(q) ||
          String(s.rollNo).toLowerCase().includes(q) ||
          (s.fatherName || "").toLowerCase().includes(q) ||
          (s.contact || "").includes(q)
      );
    }

    const summaryMap = await getAttendanceSummaryBulk(
      schoolId,
      list.map((s) => s.id),
      session.id
    );

    list.sort((a, b) => {
      if (Number(a.class) !== Number(b.class)) return Number(a.class) - Number(b.class);
      return Number(a.rollNo) - Number(b.rollNo);
    });

    // Only the important columns go into the printed excel — no marks/photo/address clutter.
    const rows = list.map((s) => {
      const att = summaryMap[s.id] || { presentDays: 0, totalDays: 0 };
      const attPct = att.totalDays ? ((att.presentDays / att.totalDays) * 100).toFixed(1) + "%" : "-";
      const due = Math.max(0, (s.fees.totalFee || 0) - (s.fees.paidFee || 0));
      return {
        "Reg No.": s.regNo,
        "Student Name": s.name,
        "Class": s.class,
        "Section": s.section,
        "Roll No.": s.rollNo,
        "Father's Name": s.fatherName,
        "Contact Number": s.contact,
        "Date of Birth": s.dob,
        "Attendance %": attPct,
        "Fee Paid (Rs.)": s.fees.paidFee || 0,
        "Fee Due (Rs.)": due
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 10 }, { wch: 22 }, { wch: 8 }, { wch: 9 }, { wch: 9 },
      { wch: 20 }, { wch: 15 }, { wch: 13 }, { wch: 12 }, { wch: 13 }, { wch: 13 }
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    const filename = `students-${session.label}${cls ? "-class" + cls : ""}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ---- Get single student (in a given/active session) ----
router.get("/:id", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const session = await resolveRequestedSession(schoolId, req.query.sessionId);

    const student = unwrap(
      await supabase.from("students").select("*").eq("id", req.params.id).eq("school_id", schoolId).maybeSingle()
    );
    if (!student) return res.status(404).json({ error: "Student not found." });

    const enrollment = unwrap(
      await supabase
        .from("enrollments")
        .select("*")
        .eq("student_id", student.id)
        .eq("session_id", session.id)
        .eq("school_id", schoolId)
        .maybeSingle()
    );
    if (!enrollment) {
      return res.status(404).json({ error: `${student.name} was not enrolled in session ${session.label}.` });
    }

    const attendance = await getAttendanceSummary(schoolId, student.id, session.id);
    res.json({ student: toClientStudent(student, enrollment, attendance) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ---- Create new student (always admitted into the ACTIVE session) ----
router.post("/", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const session = await getActiveSession(schoolId);
    const {
      name,
      class: cls,
      section,
      stream,
      rollNo,
      fatherName,
      motherName,
      dob,
      gender,
      address,
      contact,
      altContact,
      email,
      admissionDate,
      photo, // base64 data-URL, optional
      fees
    } = req.body || {};

    if (!name || !cls || !rollNo || !fatherName || !dob) {
      return res.status(400).json({ error: "Name, class, roll number, father's name and date of birth are required." });
    }
    if (needsStream(cls) && !stream) {
      return res.status(400).json({ error: "Stream (Science / Commerce / Arts) is required for class 11 & 12." });
    }

    const regNo = await nextRegNo(schoolId, session, cls);
    const subjects = getSubjectsForClass(cls, stream);
    const marks = {};
    subjects.forEach((subj) => (marks[subj] = { ut1: null, ut2: null, ut3: null, halfYearly: null, final: null }));

    const student = unwrap(
      await supabase
        .from("students")
        .insert({
          school_id: schoolId,
          reg_no: regNo,
          name: name.trim(),
          father_name: fatherName,
          mother_name: motherName || "",
          dob,
          gender: gender || "",
          address: address || "",
          contact: contact || "",
          alt_contact: altContact || "",
          email: email || "",
          photo_url: photo || null,
          admission_date: admissionDate || new Date().toISOString().slice(0, 10)
        })
        .select()
        .single(),
      "Could not save student."
    );

    const enrollment = unwrap(
      await supabase
        .from("enrollments")
        .insert({
          school_id: schoolId,
          student_id: student.id,
          session_id: session.id,
          class: String(cls),
          section: section || "A",
          stream: needsStream(cls) ? stream : null,
          roll_no: String(rollNo),
          subjects,
          marks,
          fees: { totalFee: fees && fees.totalFee !== undefined ? Number(fees.totalFee) : 0, paidFee: fees && fees.paidFee !== undefined ? Number(fees.paidFee) : 0 }
        })
        .select()
        .single(),
      `Roll number ${rollNo} may already exist in Class ${cls}-${section || "A"}.`
    );

    res.status(201).json({ student: toClientStudent(student, enrollment, { presentDays: 0, totalDays: 0 }) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ---- Update student profile (core fields + this session's enrollment fields) ----
router.put("/:id", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const session = await resolveRequestedSession(schoolId, req.query.sessionId);

    const student = unwrap(
      await supabase.from("students").select("*").eq("id", req.params.id).eq("school_id", schoolId).maybeSingle()
    );
    if (!student) return res.status(404).json({ error: "Student not found." });

    const enrollment = unwrap(
      await supabase.from("enrollments").select("*").eq("student_id", student.id).eq("session_id", session.id).maybeSingle()
    );
    if (!enrollment) return res.status(404).json({ error: `${student.name} is not enrolled in session ${session.label}.` });

    // ---- core (student-level, applies across all sessions) ----
    const coreFields = {};
    const coreMap = {
      name: "name",
      fatherName: "father_name",
      motherName: "mother_name",
      dob: "dob",
      gender: "gender",
      address: "address",
      contact: "contact",
      altContact: "alt_contact",
      email: "email",
      admissionDate: "admission_date"
    };
    Object.keys(coreMap).forEach((k) => {
      if (req.body[k] !== undefined) coreFields[coreMap[k]] = req.body[k];
    });
    if (req.body.photo !== undefined) coreFields.photo_url = req.body.photo || null;

    let updatedStudent = student;
    if (Object.keys(coreFields).length) {
      updatedStudent = unwrap(
        await supabase.from("students").update(coreFields).eq("id", student.id).select().single(),
        "Could not update student."
      );
    }

    // ---- enrollment (session-level) ----
    const enrollFields = {};
    if (req.body.section !== undefined) enrollFields.section = req.body.section;
    if (req.body.rollNo !== undefined) enrollFields.roll_no = String(req.body.rollNo);
    if (req.body.fees) {
      enrollFields.fees = {
        totalFee: req.body.fees.totalFee !== undefined ? Number(req.body.fees.totalFee) : (enrollment.fees || {}).totalFee || 0,
        paidFee: req.body.fees.paidFee !== undefined ? Number(req.body.fees.paidFee) : (enrollment.fees || {}).paidFee || 0
      };
    }
    // stream change (class 11/12) -> refresh subject list, keep existing marks where subject names match
    if (needsStream(enrollment.class) && req.body.stream && req.body.stream !== enrollment.stream) {
      const newSubjects = getSubjectsForClass(enrollment.class, req.body.stream);
      const newMarks = {};
      newSubjects.forEach((subj) => {
        newMarks[subj] = (enrollment.marks || {})[subj] || { ut1: null, ut2: null, ut3: null, halfYearly: null, final: null };
      });
      enrollFields.stream = req.body.stream;
      enrollFields.subjects = newSubjects;
      enrollFields.marks = newMarks;
    }

    let updatedEnrollment = enrollment;
    if (Object.keys(enrollFields).length) {
      updatedEnrollment = unwrap(
        await supabase.from("enrollments").update(enrollFields).eq("id", enrollment.id).select().single(),
        `Roll number ${req.body.rollNo || enrollment.roll_no} may already exist in this class-section.`
      );
    }

    const attendance = await getAttendanceSummary(schoolId, student.id, session.id);
    res.json({ student: toClientStudent(updatedStudent, updatedEnrollment, attendance) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ---- Delete student (removes the student and ALL their sessions' data) ----
router.delete("/:id", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const removed = unwrap(
      await supabase.from("students").delete().eq("id", req.params.id).eq("school_id", schoolId).select().maybeSingle()
    );
    if (!removed) return res.status(404).json({ error: "Student not found." });
    res.json({ removed });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ---- Update marks for a student, scoped to a session ----
router.put("/:id/marks", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const session = await resolveRequestedSession(schoolId, req.query.sessionId);

    const student = unwrap(
      await supabase.from("students").select("id, name").eq("id", req.params.id).eq("school_id", schoolId).maybeSingle()
    );
    if (!student) return res.status(404).json({ error: "Student not found." });

    const enrollment = unwrap(
      await supabase.from("enrollments").select("*").eq("student_id", student.id).eq("session_id", session.id).maybeSingle()
    );
    if (!enrollment) return res.status(404).json({ error: `${student.name} is not enrolled in session ${session.label}.` });

    const marks = enrollment.marks || {};
    const incoming = (req.body && req.body.marks) || {};
    const maxByType = {};
    EXAM_TYPES.forEach((e) => (maxByType[e.key] = e.max));

    Object.keys(incoming).forEach((subject) => {
      if (!marks[subject]) return; // ignore unknown subjects
      const entry = incoming[subject];
      Object.keys(entry).forEach((examKey) => {
        if (!(examKey in maxByType)) return;
        let val = entry[examKey];
        if (val === "" || val === null || val === undefined) {
          marks[subject][examKey] = null;
          return;
        }
        val = Number(val);
        if (isNaN(val) || val < 0 || val > maxByType[examKey]) return;
        marks[subject][examKey] = val;
      });
    });

    const updatedEnrollment = unwrap(
      await supabase.from("enrollments").update({ marks }).eq("id", enrollment.id).select().single(),
      "Could not save marks."
    );

    const fullStudent = unwrap(await supabase.from("students").select("*").eq("id", student.id).single());
    const attendance = await getAttendanceSummary(schoolId, student.id, session.id);
    res.json({ student: toClientStudent(fullStudent, updatedEnrollment, attendance) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
