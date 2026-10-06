# SETUP.md — Detailed Setup Guide

## 1. Create your Supabase project

1. Go to https://supabase.com, sign up/login, click **New Project**.
2. Pick a name, a database password (save it somewhere safe), and a region close to your users.
3. Wait ~2 minutes for the project to finish provisioning.

## 2. Run the database schema

1. In your Supabase project, open **SQL Editor** (left sidebar) → **New query**.
2. Open `supabase/schema.sql` from this project, copy its entire content, paste it into the editor.
3. Click **Run**. You should see "Success. No rows returned." This creates every table (schools,
   academic_sessions, admin_users, students, enrollments, attendance_records, report_logs, notifications).

You only need to do this once per Supabase project.

## 3. Get your API credentials

In Supabase: **Project Settings → API**.

- Copy the **Project URL** → this is `SUPABASE_URL`.
- Copy the **service_role** key (NOT the `anon`/`public` key) → this is `SUPABASE_SERVICE_ROLE_KEY`.

⚠️ The service role key has full database access and must stay on the server only. Never put it in
any frontend file or commit it to a public repository.

## 4. Configure environment variables

Copy `.env.example` to `.env` in the project root and fill in:

```
PORT=4000
JWT_SECRET=<any long random string>
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your service role key>
```

## 5. Install & run

```bash
npm install
npm start
```

Visit `http://localhost:4000`. Use the **Register School** tab to create your first school + admin login.
Every school that signs up this way gets its own isolated data — nothing is ever shared between schools.

## 6. Deploying

Deploy the Node app to any host that runs Node 18+ (Render, Railway, a VPS, etc.) and set the same
environment variables there. The `public/` folder is served by the same Express server, so there is
nothing separate to deploy for the frontend.

## 7. Connecting WhatsApp (per school)

Each school can connect its own WhatsApp Business number from **Settings → WhatsApp Integration**
inside the app:

1. Create a Meta Developer App at https://developers.facebook.com, add the **WhatsApp** product.
2. From the WhatsApp product's Getting Started page, note down:
   - A **Permanent Access Token** (System User token, recommended over the temporary one).
   - The **Phone Number ID** for the number you want to send from.
3. In Vidya Setu, go to **Settings → WhatsApp Integration**, paste the Token and Phone Number ID,
   and choose any string as your **Webhook Verify Token**.
4. Back in the Meta App dashboard → WhatsApp → Configuration → Webhook, set:
   - **Callback URL**: `https://<your-deployed-domain>/api/webhook/whatsapp`
   - **Verify Token**: the same value you saved in step 3.
   - Subscribe to the `messages` field.

Until these are filled in, that school's reports send in **simulate mode**: the message is composed,
logged, and shown in the app exactly as it would be sent, but nothing actually goes out over WhatsApp.
This lets you test the whole "send report → parent replies → notification bell" flow safely before
going live. You can also try this using the built-in `POST /api/webhook/simulate-reply` helper (used
internally — trigger it by sending yourself a report, then manually testing a reply via that endpoint
with a REST client, if you want to see a notification appear without live WhatsApp).

## 8. Notes on how data is organized

- **Multi-tenant isolation**: every table has a `school_id` column, and every single backend query
  filters by the logged-in admin's school. Two schools' data can never mix.
- **Academic sessions**: `students` holds a student's permanent identity (name, DOB, parents, contact,
  photo). Their class, section, roll number, subjects, marks, fees and attendance for a *specific* year
  live in `enrollments` and `attendance_records`, tied to an `academic_sessions` row (e.g. "2026-2027").
  Starting a new session (Settings → Academic Sessions) never touches previous years' data — switch
  back to it anytime from the session switcher in the top bar.
- **Photos**: stored directly as a compressed base64 JPEG in `students.photo_url` — no separate file
  storage bucket needs to be configured. (If you later want to move to Supabase Storage for smaller
  database rows, that's a straightforward follow-up change.)
- **Attendance-driven values**: attendance is only ever entered from the Attendance page. Everywhere
  else (student profile, report cards, WhatsApp reports, dashboard) reads the computed
  present/total days from `attendance_records` automatically.
