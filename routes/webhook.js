const express = require("express");
const { supabase, unwrap } = require("../utils/supabaseClient");
const { normalizePhone } = require("../utils/whatsapp");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const FALLBACK_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "vidya-setu-verify-token";

async function findSchoolByPhoneNumberId(phoneNumberId) {
  if (!phoneNumberId) return null;
  return unwrap(await supabase.from("schools").select("*").eq("whatsapp_phone_number_id", phoneNumberId).maybeSingle());
}

async function findStudentByPhone(schoolId, phone) {
  const target = normalizePhone(phone);
  if (!target) return null;
  const candidates = unwrap(
    await supabase.from("students").select("id, name, contact, alt_contact").eq("school_id", schoolId)
  );
  return (candidates || []).find((s) => normalizePhone(s.contact) === target || normalizePhone(s.alt_contact) === target) || null;
}

async function pushNotification(schoolId, { studentId, studentName, from, message }) {
  return unwrap(
    await supabase
      .from("notifications")
      .insert({
        school_id: schoolId,
        student_id: studentId || null,
        student_name: studentName || "Unknown number",
        from_number: from,
        message,
        read: false
      })
      .select()
      .single()
  );
}

// ---- Meta webhook verification (GET) ----
// Meta calls this once per school's Phone Number when the callback URL
// is registered. We accept the fallback token OR any school's own
// saved verify token, so each school can use its own value if it wants.
router.get("/whatsapp", async (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode !== "subscribe") return res.sendStatus(403);
  if (token === FALLBACK_VERIFY_TOKEN) return res.status(200).send(challenge);

  const school = unwrap(await supabase.from("schools").select("id").eq("whatsapp_verify_token", token).maybeSingle());
  if (school) return res.status(200).send(challenge);

  return res.sendStatus(403);
});

// ---- Incoming WhatsApp messages (POST) ----
// Routes each message to the correct school using the WhatsApp
// Business phone_number_id in the payload metadata, so replies never
// leak between schools.
router.post("/whatsapp", async (req, res) => {
  try {
    const entry = req.body.entry && req.body.entry[0];
    const change = entry && entry.changes && entry.changes[0];
    const value = change && change.value;
    const messages = value && value.messages;
    const phoneNumberId = value && value.metadata && value.metadata.phone_number_id;

    if (messages && messages.length) {
      const school = await findSchoolByPhoneNumberId(phoneNumberId);
      if (school) {
        for (const msg of messages) {
          const from = msg.from;
          const text = msg.text ? msg.text.body : "[Non-text message received]";
          const student = await findStudentByPhone(school.id, from);
          await pushNotification(school.id, {
            studentId: student ? student.id : null,
            studentName: student ? student.name : null,
            from,
            message: text
          });
        }
      } else {
        console.warn("WhatsApp webhook: no school matched phone_number_id", phoneNumberId);
      }
    }
  } catch (err) {
    console.error("WhatsApp webhook processing error:", err.message);
  }

  // Always 200, so Meta doesn't retry / disable the webhook
  res.sendStatus(200);
});

// ---- Dev/testing helper: simulate a parent reply arriving ----
// Lets the admin panel demo the full "send report -> parent replies ->
// dashboard notification" flow without live WhatsApp credentials.
router.post("/simulate-reply", requireAuth, async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { studentId, message } = req.body;
    const student = unwrap(
      await supabase.from("students").select("*").eq("id", studentId).eq("school_id", schoolId).maybeSingle()
    );
    if (!student) return res.status(404).json({ error: "Student not found." });

    const notification = await pushNotification(schoolId, {
      studentId: student.id,
      studentName: student.name,
      from: normalizePhone(student.contact),
      message: message && message.trim() ? message.trim() : "Thank you for the update, noted."
    });
    res.status(201).json({
      notification: {
        id: notification.id,
        studentId: notification.student_id,
        studentName: notification.student_name,
        from: notification.from_number,
        message: notification.message,
        receivedAt: notification.received_at,
        read: notification.read
      }
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
