// ============================================================
// WhatsApp integration (Meta WhatsApp Cloud API) — multi-school aware
// ============================================================
// Each school can connect its OWN WhatsApp Business number from
// Settings -> WhatsApp Integration inside the app. Those credentials
// are stored on the `schools` row (whatsapp_token, whatsapp_phone_number_id,
// whatsapp_verify_token) and passed into these functions per-request.
//
// To go live for a school:
//   1. Create a Meta App -> add "WhatsApp" product -> get a permanent
//      access token + a Phone Number ID.
//   2. Paste those into that school's Settings -> WhatsApp Integration.
//   3. In the Meta App dashboard, set the Webhook callback URL to:
//        https://<your-deployed-domain>/api/webhook/whatsapp
//      and the Verify Token to the same value saved in Settings.
//
// Until a school connects its own credentials, that school runs in
// SIMULATE MODE: messages are logged + stored (not actually sent),
// so the "Send Report" -> "Parent Reply" flow can be tested end to
// end without live WhatsApp credentials.
// ============================================================

const GRAPH_VERSION = "v20.0";

// Fallback, only used if a school hasn't configured its own credentials.
const FALLBACK_TOKEN = process.env.WHATSAPP_TOKEN || "";
const FALLBACK_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";

function resolveCreds(school) {
  const token = (school && school.whatsapp_token) || FALLBACK_TOKEN;
  const phoneNumberId = (school && school.whatsapp_phone_number_id) || FALLBACK_PHONE_ID;
  return { token, phoneNumberId };
}

function isLiveModeEnabled(school) {
  const { token, phoneNumberId } = resolveCreds(school);
  return Boolean(token && phoneNumberId);
}

// Normalizes an Indian mobile number to E.164 format used by WhatsApp (e.g. 919876543210)
function normalizePhone(raw) {
  if (!raw) return null;
  let digits = String(raw).replace(/[^\d]/g, "");
  if (digits.length === 10) digits = "91" + digits; // assume India, add country code
  if (digits.length === 11 && digits.startsWith("0")) digits = "91" + digits.slice(1);
  return digits;
}

// Sends a plain text WhatsApp message on behalf of a specific school.
// Returns { ok, simulated, error?, raw? }
async function sendWhatsAppMessage(school, toRawNumber, message) {
  const to = normalizePhone(toRawNumber);
  if (!to) {
    return { ok: false, simulated: false, error: "Parent's WhatsApp number is missing or invalid." };
  }

  const { token, phoneNumberId } = resolveCreds(school);

  if (!(token && phoneNumberId)) {
    // ---- Simulate mode: this school has no live credentials configured ----
    console.log("=====================================================");
    console.log(`[WhatsApp SIMULATE MODE] School "${school ? school.name : "?"}" would send message to:`, to);
    console.log(message);
    console.log("=====================================================");
    return { ok: true, simulated: true, to };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message, preview_url: false }
      })
    });

    const data = await res.json();
    if (!res.ok) {
      return { ok: false, simulated: false, error: (data && data.error && data.error.message) || "WhatsApp API error.", raw: data };
    }
    return { ok: true, simulated: false, to, raw: data };
  } catch (err) {
    return { ok: false, simulated: false, error: err.message };
  }
}

module.exports = { sendWhatsAppMessage, normalizePhone, isLiveModeEnabled, resolveCreds };
