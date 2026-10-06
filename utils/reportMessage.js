// Builds the full WhatsApp report text for a student: attendance, fees,
// marks summary (one or more exams combined) and an optional custom
// description typed by the school.

const EXAM_MAX = { ut1: 25, ut2: 25, ut3: 25, halfYearly: 100, final: 100 };
const EXAM_LABEL = { ut1: "Unit Test 1", ut2: "Unit Test 2", ut3: "Unit Test 3", halfYearly: "Half Yearly", final: "Final / Annual" };
const EXAM_ORDER = ["ut1", "ut2", "ut3", "halfYearly", "final"];

function pctOrDash(n, d) {
  if (!d) return "—";
  return ((n / d) * 100).toFixed(1) + "%";
}

// featuredExamKeys: array of exam keys to combine, e.g. ["ut1","ut2","ut3"]
// Falls back to auto-picking the most recent exam that has any marks.
function summarizeExams(student, featuredExamKeys) {
  const subjects = student.subjects || [];
  let keys = (featuredExamKeys || []).filter((k) => EXAM_MAX[k]);

  if (!keys.length) {
    // auto-pick: prefer final, then halfYearly, then ut3/2/1
    for (const key of ["final", "halfYearly", "ut3", "ut2", "ut1"]) {
      const any = subjects.some((subj) => student.marks[subj] && student.marks[subj][key] !== null && student.marks[subj][key] !== undefined);
      if (any) {
        keys = [key];
        break;
      }
    }
  }
  if (!keys.length) return null;

  // keep them in natural exam order for a stable label like "UT1 + UT2 + UT3"
  keys = EXAM_ORDER.filter((k) => keys.includes(k));

  let obtained = 0,
    max = 0,
    any = false;
  const perSubject = {};

  subjects.forEach((subj) => {
    let subjObtained = 0,
      subjMax = 0,
      subjAny = false;
    keys.forEach((key) => {
      const v = student.marks[subj] ? student.marks[subj][key] : null;
      if (v !== null && v !== undefined) {
        subjObtained += Number(v);
        subjMax += EXAM_MAX[key];
        subjAny = true;
        any = true;
      }
    });
    if (subjAny) {
      obtained += subjObtained;
      max += subjMax;
      perSubject[subj] = { obtained: subjObtained, max: subjMax };
    }
  });

  if (!any) return null;

  const label = keys.map((k) => EXAM_LABEL[k]).join(" + ");
  return { keys, label, obtained, max, pct: max ? (obtained / max) * 100 : null, perSubject };
}

// attendance: { presentDays, totalDays } — pass the value already
// computed from attendance_records for the relevant academic session.
function buildReportMessage({ school, student, description, attendance, featuredExamKeys }) {
  const att = attendance || { presentDays: 0, totalDays: 0 };
  const fees = student.fees || { totalFee: 0, paidFee: 0 };
  const due = Math.max(0, (fees.totalFee || 0) - (fees.paidFee || 0));
  const exam = summarizeExams(student, featuredExamKeys);

  const lines = [];
  lines.push(`*${school.name || "School"}*`);
  lines.push(`Progress Report — ${student.name}`);
  lines.push("");
  lines.push(`*Student:* ${student.name} (Roll ${student.rollNo}, Reg. ${student.regNo})`);
  lines.push(`*Class:* ${student.class}-${student.section}${student.stream ? " (" + student.stream + ")" : ""}`);
  lines.push("");
  lines.push(`*Attendance:* ${att.presentDays}/${att.totalDays} days present (${pctOrDash(att.presentDays, att.totalDays)})`);
  lines.push(`*Fees:* Paid Rs.${fees.paidFee || 0} of Rs.${fees.totalFee || 0}${due > 0 ? ` — Due Rs.${due}` : " — Fully Paid"}`);
  lines.push("");
  if (exam) {
    lines.push(`*Marks (${exam.label}):* ${exam.obtained}/${exam.max} (${exam.pct.toFixed(1)}%)`);
    (student.subjects || []).forEach((subj) => {
      const s = exam.perSubject[subj];
      lines.push(`  • ${subj}: ${s ? s.obtained + "/" + s.max : "—"}`);
    });
  } else {
    lines.push("*Marks:* Not entered yet.");
  }

  if (description && description.trim()) {
    lines.push("");
    lines.push(`*Note from school:*`);
    lines.push(description.trim());
  }

  lines.push("");
  lines.push(`Reply to this message for any queries.`);
  lines.push(`— ${school.name || "School"}${school.phone ? " · " + school.phone : ""}`);

  return lines.join("\n");
}

module.exports = { buildReportMessage, summarizeExams, EXAM_MAX, EXAM_LABEL, EXAM_ORDER };
