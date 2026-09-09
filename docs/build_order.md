# Techcess — Recommended Build Order
## Work through this sequentially. Each phase depends on the previous.

---

## PHASE 0 — Before Any Code (You, Not Claude Code)

Work through setup_checklist.md Parts 1–6 completely.
Nothing else starts until this is done.

```
[ ] Supabase auth config (email/password, email verification)
[ ] Supabase Vault enabled (phone encryption key created and backed up)
[ ] DROP FUNCTION get_dashboard
[ ] All user_profiles ALTER TABLE columns added
[ ] All 22 new tables created (Part 3 of setup_checklist)
[ ] All DB functions created (Part 4 of setup_checklist)
[ ] RLS enabled on all new tables (Part 5 of setup_checklist)
[ ] Resend account + all email templates created
[ ] Termii account + WhatsApp templates approved
[ ] Paystack secondary school plans created
[ ] GPT-5 Nano and GPT-5.6 Luna confirmed accessible on OpenAI key
[ ] All new API keys added to backend .env
```

---

## PHASE 1 — Foundation (Backend First)

These are shared infrastructure that every feature depends on.

### 1A — Security utilities (backend)
```
[ ] bleach sanitize_input() utility function
[ ] XSS sanitization wired into all existing text input endpoints
[ ] Device token middleware (reads X-Device-Token header)
[ ] Subscription + membership access check middleware
[ ] Role check utility (student / parent / school_admin / admin)
```

### 1B — Auth expansion (backend)
```
[ ] Email/password signup handler
[ ] Email verification check before onboarding proceeds
[ ] Post-signup hook: check subscription_invites + pending_parent_links
    for new user's email, auto-resolve any pending links
[ ] Password reset flow (Supabase native)
```

### 1C — Device token (frontend)
```
[ ] Device token generation on first app load
[ ] X-Device-Token added to API client interceptor (one place)
```

---

## PHASE 2 — Onboarding (Backend + Frontend Together)

Onboarding populates user_profiles fields that everything else reads.
Build this before dashboards and lesson flow.

### 2A — Backend
```
[ ] POST /onboarding/secondary (incremental, 8 screens)
[ ] POST /onboarding/university (incremental, 7 screens)
[ ] POST /onboarding/parent (2 screens)
[ ] POST /onboarding/promo (validate + redeem promo code)
[ ] POST /admin/promo/create
[ ] GET  /admin/promo/list
[ ] PATCH /admin/promo/{id}/toggle
[ ] Membership detection at paywall screen
[ ] Under-13 hard stop
```

### 2B — Frontend
```
[ ] Onboarding routing + screen progression logic
[ ] Screen 1: name
[ ] Screen 2: DOB + age range response + under-13 block
[ ] Screen 3: class level selection
[ ] Screen 4: school autocomplete
[ ] Screen 5: goal multi-select
[ ] Screen 6: education sentiment + empathetic response
[ ] Screen 7: notification preferences + phone number
[ ] Screen 8: paywall + promo code + free chapter escape
[ ] Invited member variant of screen 8
[ ] Uni onboarding screens (7)
[ ] Parent onboarding screens (2)
[ ] GSAP transitions between all screens
[ ] Incremental save + resume on re-login
```

---

## PHASE 3 — Multi-Device + Subscription Members (Backend + Frontend)

### 3A — Backend
```
[ ] GET  /devices
[ ] DELETE /devices/{device_token}
[ ] GET  /subscriptions/members
[ ] POST /subscriptions/invite
[ ] POST /subscriptions/invite/accept
[ ] DELETE /subscriptions/members/{user_id}
[ ] Invite resend logic
[ ] Member lapse on owner lapse (APScheduler update)
[ ] Member restore on owner resubscription (Paystack webhook update)
[ ] Subscription access check middleware completed
```

### 3B — Frontend
```
[ ] Device limit 403 screen with deregister option
[ ] Subscription members management UI
[ ] Invite flow UI
[ ] Accept invite landing screen
```

---

## PHASE 4 — Secondary School Curriculum + Admin Tool (Backend)

No frontend yet — this seeds the content students will see.

```
[ ] POST /admin/curriculum/seed
[ ] GET  /admin/curriculum/visuals
[ ] POST /admin/curriculum/visuals/render
[ ] POST /admin/curriculum/visuals/approve
[ ] PUT  /admin/curriculum/visuals/prompt
[ ] Admin panel frontend (basic — just enough to seed and approve visuals)
[ ] Seed SS1 Maths Term 1 content from spreadsheet
[ ] Render and approve all Term 1 Manim visuals
```

---

## PHASE 5 — Secondary School Lesson Flow (Backend)

Build all endpoints before building the frontend for them.

### 5A — Content endpoints
```
[ ] GET /secondary/subjects
[ ] GET /secondary/chapters/{subject_id}
[ ] GET /secondary/sections/{chapter_id}
[ ] GET /secondary/subsections/{subsection_id}
```

### 5B — Session + tutor
```
[ ] POST /secondary/sessions/start
[ ] POST /secondary/sessions/chat (SSE + asyncio assessment)
[ ] POST /secondary/sessions/complete (Haiku extraction + state update)
[ ] GET  /secondary/sessions/{session_id}/history
[ ] System prompt assembly (all fields, cached prefix pattern)
[ ] Assessment call (GPT-5.6 Luna, non-blocking)
[ ] Haiku extraction (background task on completion)
[ ] Global knowledge profile update on user_profiles
```

### 5C — Quiz
```
[ ] GET  /secondary/quiz/{subsection_id}
[ ] POST /secondary/quiz/submit (string match + GPT-5 Nano routing)
[ ] POST /secondary/quiz/reveal
[ ] GET  /secondary/problems/{chapter_id}
[ ] POST /secondary/problems/submit
[ ] POST /secondary/problems/chat/start
[ ] POST /secondary/problems/chat (SSE)
[ ] POST /secondary/problems/understood
```

---

## PHASE 6 — Secondary School Lesson Flow (Frontend)

With backend complete and content seeded, build the student UI.

```
[ ] Subject list page
[ ] Chapter grid page (lock/progress/complete states)
[ ] Section accordion TOC
[ ] Subsection page (full scroll layout)
[ ] Static content zone (all block types + Manim inline)
[ ] GSAP static-to-tutor transition
[ ] Tutor chat + SSE streaming
[ ] Next button (3 states + GSAP unlock animation)
[ ] Chapter complete celebration animation
[ ] Mini quiz component (single question, progress bar, result states)
[ ] Solution reveal component
[ ] End of chapter problems (tabs, text area, slide-up tutor)
[ ] Completion tick propagation (subsection → section → chapter → subject)
[ ] Streak GSAP animation
```

---

## PHASE 7 — Dashboards (Backend + Frontend)

### 7A — Backend
```
[ ] GET /dashboard (uni — expanded multi-query)
[ ] GET /secondary/dashboard
[ ] GET /parent/dashboard
[ ] POST /profile/link-parent
[ ] GET /school/dashboard
[ ] GET /school/report/monthly
[ ] calculate_streak called from Python (RPC exists — call it)
[ ] get_usage_graph_uni / get_usage_graph_secondary called from Python based on user_type (RPCs exist — call the correct one)
[ ] APScheduler: weekly parent WhatsApp nudge job
[ ] APScheduler: monthly school report job
```

### 7B — Frontend
```
[ ] Uni dashboard (upgraded — streak, usage graph, % highlights)
[ ] Secondary student dashboard (all widgets)
[ ] Parent dashboard (student summary cards)
[ ] School admin dashboard (overview + student table + weak topics)
[ ] 7-day bar graph component (shared, used across all dashboards)
[ ] Streak counter with GSAP animation (shared component)
[ ] Percentage highlight chips above graph
```

---

## PHASE 8 — Notes Quiz Theory + Keyword Highlighting (Uni Side)

Small contained features. Build together in one session.

```
[ ] ALTER TABLE note_quizzes ADD COLUMN quiz_type (David runs this)
[ ] POST /notes/{note_id}/quiz — quiz_type param added
[ ] POST /notes/{note_id}/quiz/submit — theory branch (answer reveal)
[ ] Theory system prompt block added
[ ] Quiz type toggle UI (Objective / Theory)
[ ] Theory question display (text area + solution reveal)
[ ] Keyword highlighting in notes chat (frontend only)
[ ] Hover tooltip (desktop) + bottom sheet (mobile)
```

---

## PHASE 9 — Landing Page Refresh (Frontend)

With the full product built, the landing page refresh has full context
of what the product actually looks like and does.

```
[ ] Read existing landing page components
[ ] Apply full design system: typography, spacing, colour
[ ] GSAP ScrollTrigger animations on scroll
[ ] Motion hover states on cards and CTAs
[ ] Visual consistency with secondary school UI
[ ] Keep all existing content — refine execution only
[ ] No new sections invented
```

---

## PHASE 10 — Polish + Integration Pass

Final pass before launch.

```
[ ] End-to-end test: signup → onboarding → lesson → quiz → dashboard
[ ] Test invited member full flow
[ ] Test promo code redemption
[ ] Test device limit enforcement
[ ] Test parent linking (existing account + new account)
[ ] Mobile responsiveness audit (every new screen at 375px)
[ ] Accessibility audit (keyboard nav + screen reader)
[ ] Rate limit verification on all new endpoints
[ ] Security audit: IDOR checks, parameterized queries, RLS
[ ] model_usage logging verified across all AI calls
[ ] user_events logging verified across all significant actions
[ ] Supabase security advisor — resolve any new warnings
[ ] Vercel deployment: confirm all env vars set
[ ] Render deployment: confirm all env vars set
```

---

## Session Structure Recommendation

Each Claude Code session should target one phase or one half of a phase.
Start every session with:
1. Paste CLAUDE.md for that repo
2. Paste feature_checklist.md
3. State which phase/items you're building today
4. Ask Claude Code to scan the codebase before writing anything

End every session with:
1. Update checkboxes in feature_checklist.md
2. Test what was built before closing the session
3. Note any blockers for next session

---

## Parallel Work Opportunities

Backend and frontend can run in parallel once backend endpoints exist:
- Phase 5 backend and Phase 6 frontend: build backend first,
  then frontend can start while Phase 7 backend is being built
- Phase 8 is fully independent — can be done any time after Phase 4

Do not start frontend work for a feature until its backend endpoints
are complete and returning correct responses.

