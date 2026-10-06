# Vidya Setu — School Management System (v2)

School ke liye multi-school-ready (SaaS style), Supabase-backed management system.
Yeh sabhi 8 requested changes is version me implement kiye gaye hain.

## Kya-kya badla (aapke points ke हिसाब से)

**Dashboard**
1. Quick Actions section hata diya — uski jagah "Reports Summary" section hai (reports sent this month, unread parent replies, fee collection %, aaj ka attendance).
2. Class-wise Strength ab ek animated, professional SVG bar chart hai — grid lines, gradient bars, aur active academic session ka label saath me dikhta hai.
3. Overview ke pass wale icon (topbar, title ke bagal me) pe click karne se left sidebar collapse/expand hota hai, aur icon khud bhi menu ↔ close me badal jaata hai.

**Students**
1. "Export Excel" button add hua — current filters (class/section/search) ke hisaab se sirf zaroori columns (Reg No, Name, Class-Section, Roll No, Father's Name, Contact, DOB, Attendance %, Fee Paid/Due) wali `.xlsx` file download hoti hai.
2. Blood Group field poori tarah hata diya gaya hai — form, database schema, kahin bhi nahi hai.

**Report Cards**
1. "Which exam to feature as the highlighted total" ab **multi-select** hai (checkboxes) — UT1 + UT2 + UT3 ya koi bhi combination choose kar sakte hain, unka combined total/percentage dikhega.

**Baaki Changes**
1. Har page ke topbar me ek **Session switcher** hai — "2026-2027", "2027-2028" jaise sessions ke beech switch karke purana data (prev session) dekh sakte hain, bina kuch delete kiye.
2. Har cheez (students, marks, fees, attendance) **academic session ke hisaab se alag-alag save** hoti hai (e.g. 2025-26 vs 2026-27 poori tarah alag rehte hain).
3. Parent login/portal poori tarah hata diya gaya hai.
4. Add/Edit Student form me **photo upload** field hai (dono jagah).
5. Report WhatsApp pe **admission ke time diye gaye number** par hi jaata hai; parent ka reply admin ke **notification bell** me aata hai, jise click karke padh/reply track kar sakte hain.
6. System ab **multi-school (multi-tenant)** hai — har school apna alag username/password banata hai ("Register School" tab), aur backend me har school ka data completely isolated rehta hai (`school_id` se scoped).
7. Naya **Attendance** page — daily register (present/absent/leave, ek din ke liye pura class) aur monthly calendar view. Jahan pehle attendance manually type hoti thi (student form, report card, WhatsApp report) — ab woh sab is Attendance data se **automatically calculate** hoke aata hai.
8. Poora backend **Supabase (Postgres)** par based hai — schema `supabase/schema.sql` me hai, aur Node server usी se baat karta hai.

## Quick Start

1. **Supabase project banaye**: https://supabase.com par free project banaye.
2. `supabase/schema.sql` ka pura content copy karke Supabase Dashboard → SQL Editor me paste karke Run karein (ek hi baar).
3. `.env.example` ko `.env` naam se copy karein aur apne Supabase project ka URL + **service role key** (Settings → API me milegi) daalein.
4. Terminal me:
   ```
   npm install
   npm start
   ```
5. Browser me `http://localhost:4000` kholein → "Register School" tab se apne school ka pehla account banayein.

Poora detailed setup (WhatsApp connect karna, deployment, waghera) `SETUP.md` me hai.

## Important note — WhatsApp & Supabase credentials

Yeh app aapke **apne** Supabase project aur (chahe to) **apne** WhatsApp Business API credentials use karta hai — yeh cheezein sirf aap hi provide kar sakte hain, kyunki yeh aapke business accounts hain. Jab tak WhatsApp credentials Settings me nahi daale jaate, reports "simulate mode" me chalte hain (app ke andar dikhte hain, real WhatsApp pe nahi jaate) — taaki poora flow (report bhejna → parent ka reply → notification) bina live credentials ke bhi test kiya ja sake.
