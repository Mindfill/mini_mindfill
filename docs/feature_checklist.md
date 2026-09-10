# Techcess — Feature Checklist
## Paste into every Claude Code session. Update checkboxes as features are completed.
## [ ] = not built  [x] = complete  [~] = in progress

---

## PREREQUISITE — Read Before Building Anything
- [ ] Read CLAUDE.md for this repo
- [ ] Read setup_checklist.md — confirm all DB tables and external services exist
- [ ] Ask David for schemas of any existing tables you need to query
- [ ] Do not touch existing working endpoints without explicit instruction

---

## FEATURE 01 — Multi-Device Enforcement + Subscription Members
### Secondary school only. Uni side unaffected.

**DB (YOU run these in Supabase SQL editor — not Claude Code):**
- [ ] user_devices table created
- [ ] subscription_members table created
- [ ] subscription_invites table created
- [ ] can_register_device RPC created (YOU run this in Supabase SQL editor)
- [ ] can_add_member RPC created (YOU run this in Supabase SQL editor)

**Backend:**
- [ ] Device token middleware added to auth chain (paid users only)
- [ ] Fingerprint fallback logic on missing token
- [ ] Token rotation on login/signup (server-side fresh UUID)
- [ ] GET /devices — list user's registered devices
- [ ] DELETE /devices/{device_token} — deregister device (is_active = false)
- [ ] GET /subscriptions/members — owner lists members
- [ ] POST /subscriptions/invite — owner sends invite email via Resend
- [ ] POST /subscriptions/invite/accept — invitee accepts, resolves membership
- [ ] DELETE /subscriptions/members/{user_id} — owner removes member
- [ ] Invite resend logic (same endpoint, rotates token, no duplicate rows)
- [ ] Post-signup hook: check subscription_invites for email match, auto-resolve
- [ ] Member lapse on owner subscription lapse (APScheduler existing worker updated)
- [ ] Member restore on owner resubscription (Paystack webhook updated)
- [ ] Subscription access check: owner OR active member of active subscription
- [ ] bleach sanitize_input utility function added (all text input fields)
- [ ] Rate limiting on all device and invite endpoints
- [ ] user_events logging: device_registered, device_deregistered,
      device_limit_hit, member_invited, member_joined, member_removed,
      invite_expired, invite_resent, subscription_member_lapsed,
      subscription_member_restored

**Frontend:**
- [ ] Device token generated on first app load (localStorage + cookie)
- [ ] X-Device-Token header added to API client interceptor (one place)
- [ ] 403 device limit screen — shows registered devices, deregister option
- [ ] Deregister device from blocked screen
- [ ] Subscription members management UI (owner view)
- [ ] Invite member flow (email input, send, pending state)
- [ ] Accept invite landing screen
- [ ] Member removed notification screen

---

## FEATURE 02 — Secondary School Lesson Flow
### Full lesson experience — navigation, content, tutor, unlock, quiz

**DB (YOU run these in Supabase SQL editor — not Claude Code):**
- [ ] curriculum_subjects table created
- [ ] curriculum_chapters table created
- [ ] curriculum_sections table created
- [ ] curriculum_subsections table created
- [ ] curriculum_problems table created
- [ ] student_knowledge_state table created
- [ ] secondary_sessions table created
- [ ] secondary_conversations table created
- [ ] section_learning_events table created
- [ ] secondary_quiz_attempts table created
- [ ] schools table created
- [ ] school_students table created
- [ ] school_admin_links table created
- [ ] parents table created
- [ ] parent_students table created

**Backend — Curriculum Seeding (Admin):**
- [ ] POST /admin/curriculum/seed — CSV import, transforms manim_prompts JSONB
- [ ] GET /admin/curriculum/visuals — list visuals by status, filterable by chapter
- [ ] POST /admin/curriculum/visuals/render — trigger Modal render for one prompt
- [ ] POST /admin/curriculum/visuals/approve — set approval_status = approved
- [ ] PUT /admin/curriculum/visuals/prompt — edit prompt before retry
- [ ] Admin route protection: role = admin check

**Backend — Student Lesson Flow:**
- [ ] GET /secondary/subjects — list subjects for student's class level
- [ ] GET /secondary/chapters/{subject_id} — chapters with completion state
- [ ] GET /secondary/sections/{chapter_id} — section + subsection TOC
- [ ] GET /secondary/subsections/{subsection_id} — full content + approved visuals only
- [ ] POST /secondary/sessions/start — create session, assemble system prompt,
      detect session_type (first_attempt vs review via DB read), return opening message
- [ ] POST /secondary/sessions/chat — stream tutor response (SSE),
      asyncio.create_task assessment call after each exchange,
      SSE event fires when unlock_ready = true
- [ ] POST /secondary/sessions/complete — close session, fire Haiku extraction
      (if first_attempt + exchange_count >= min_exchange_count),
      update student_knowledge_state, unlock next subsection
- [ ] GET /secondary/sessions/{session_id}/history — conversation history
- [ ] GET /secondary/progress/{student_id} — full student progress state
- [ ] GET /secondary/dashboard — all dashboard widgets (see Feature 04)

**Backend — System Prompt Assembly:**
- [ ] Subsection type instruction block injected per session
- [ ] Static content fields injected (analogy, intuition, context, definitions)
- [ ] Tutor directives injected (why_revelation, common_misconceptions)
- [ ] Chapter misconceptions injected (standing awareness)
- [ ] Section learning goal injected (last subsection of section only)
- [ ] Student global knowledge profile injected from student_knowledge_state
- [ ] OpenAI prefix caching: static block as cached prefix, conversation as suffix
- [ ] NERDC physical activity adaptation rule in system prompt
- [ ] Cold start opening question calibrated to subsection_type

**Backend — Assessment:**
- [ ] Assessment call: GPT-5.6 Luna medium reasoning, non-blocking asyncio task
- [ ] Input: conversation + subsection_type + why_revelation + thresholds
- [ ] Output: {comprehension_depth, unlock_ready}
- [ ] Updates secondary_sessions.comprehension_depth + unlock_ready
- [ ] SSE event fires to frontend when unlock_ready = true
- [ ] Review sessions: assessment still runs, knowledge_state updated upward only,
      section_learning_events insert skipped

**Backend — Haiku Extraction:**
- [ ] Fires on session complete (first_attempt only, exchange_count >= floor)
- [ ] Insufficient confidence: skip extraction, log data_confidence = insufficient
- [ ] Output stored on section_learning_events
- [ ] student_knowledge_state updated (completion_status, comprehension_depth,
      knowledge_carryover, engagement_pattern)
- [ ] Global knowledge profile updated on user_profiles.student_knowledge_profile

**Backend — Mini Quiz:**
- [ ] GET /secondary/quiz/{subsection_id} — fetch questions
- [ ] POST /secondary/quiz/submit — route by question_type:
      procedural/definition → string/numeric match (zero model cost)
      conceptual → GPT-5 Nano evaluation against working field as rubric
- [ ] POST /secondary/quiz/reveal — set seen_solution = true, return working + answer
- [ ] Unlock logic: all questions pass OR seen_solution → section unlocks
- [ ] Rate limiting: 10 submissions/minute per user

**Backend — End of Chapter Problems:**
- [ ] GET /secondary/problems/{chapter_id} — fetch problems
- [ ] POST /secondary/problems/submit — store attempt, return working + answer
- [ ] POST /secondary/problems/chat/start — start problem tutor session (GPT-5.6 Luna)
- [ ] POST /secondary/problems/chat — stream problem tutor (Socratic, never reveals answer)
- [ ] POST /secondary/problems/understood — self_assessed = true

**Backend — model_usage logging:**
- [ ] tutor_exchange (GPT-5.6 Luna)
- [ ] assessment_call (GPT-5.6 Luna)
- [ ] haiku_extraction (Haiku)
- [ ] nano_quiz_evaluation (GPT-5 Nano)
- [ ] problem_tutor_exchange (GPT-5.6 Luna)

**Backend — user_events logging:**
- [ ] subsection_started, subsection_completed, subsection_reviewed
- [ ] chapter_completed, subject_completed
- [ ] quiz_submitted, quiz_passed, quiz_failed
- [ ] mini_quiz_started, mini_quiz_question_submitted, mini_quiz_question_passed
- [ ] mini_quiz_question_failed, mini_quiz_solution_revealed, mini_quiz_completed
- [ ] end_of_chapter_started, end_of_chapter_submitted
- [ ] end_of_chapter_solution_viewed, end_of_chapter_understood
- [ ] end_of_chapter_tutor_started, end_of_chapter_tutor_exchange
- [ ] manim_visual_served, manim_visual_generated, session_abandoned

**Frontend — Navigation:**
- [ ] Subject list (flat, filtered by class level from user_profiles)
- [ ] Chapter grid (lock/progress/complete states, Ch00 distinct "Start here")
- [ ] Section accordion (expandable, subsection list with type badges + ticks)
- [ ] Subsection completion ticks propagate up to section → chapter → subject
- [ ] "Continue where you left off" deep link on dashboard

**Frontend — Subsection Page:**
- [ ] Breadcrumb navigation
- [ ] Progress indicator ("Section X of Y · Subsection X of Y")
- [ ] Static content zone: analogy callout, KaTeX prose, context block,
      definition cards, chat prompt bubble
- [ ] Manim visuals inline at authored positions (lazy load)
- [ ] GSAP transition: divider animates, "Chat with your tutor" fades in,
      tutor message types in (typewriter effect)
- [ ] Tutor chat zone with SSE streaming
- [ ] Dynamic Manim visuals inline in chat thread
- [ ] Next button — 3 states:
      hidden (not scrolled past static)
      disabled with tooltip (in tutor, threshold not met)
      unlocked — GSAP pulse into full colour, "I'm ready →"
- [ ] Context line above unlocked button: "Next up: [title]" or chapter complete text
- [ ] Chapter complete GSAP celebration animation

**Frontend — Mini Quiz:**
- [ ] Single question view with progress bar
- [ ] Pass / partial / fail result states with feedback
- [ ] "Try again" and "See solution" options on partial/fail
- [ ] Solution reveal display (working + answer)
- [ ] Question progress indicators (✓ passed / ● seen solution / ◐ partial / ○ not attempted)
- [ ] Section unlock animation on quiz completion

**Frontend — End of Chapter Problems:**
- [ ] Numbered tab navigation per problem
- [ ] Multiline text area for student working
- [ ] Solution reveal after submit
- [ ] "Mark as understood ✓" button
- [ ] "Ask tutor →" slide-up chat panel per problem
- [ ] Problem tutor chat with SSE streaming

---

## FEATURE 03 — Notes Quiz Theory Generation
### Uni side only. Upgrade to existing notes quiz system.

**DB (YOU run this in Supabase SQL editor — not Claude Code):**
- [ ] ALTER TABLE note_quizzes ADD COLUMN quiz_type text DEFAULT 'objective'
      CHECK (quiz_type IN ('objective','theory'))

**Backend:**
- [ ] POST /notes/{note_id}/quiz — add optional quiz_type param (default: objective)
      theory branch: structured textbook problem set generation
      quiz_type stored on note_quizzes row
- [ ] POST /notes/{note_id}/quiz/submit — theory branch:
      store submitted_answer, return working + answer immediately
      no model evaluation, no Haiku call
- [ ] Theory system prompt block added to existing quiz generation prompt
- [ ] user_events: quiz_generated_theory, quiz_submitted_theory

**Frontend:**
- [ ] Toggle above section selector: [● Objective  ○ Theory]
- [ ] Default: Objective (existing behaviour unchanged)
- [ ] Theory question display: text area for attempt
- [ ] After theory submit: reveal working steps + answer in full
- [ ] No feedback message, no pass/fail for theory

---

## FEATURE 04 — Dashboards
### Uni student, secondary student, parent, school admin

**DB (YOU run these in Supabase SQL editor — not Claude Code):**
- [ ] DROP FUNCTION IF EXISTS get_dashboard (YOU run this in Supabase SQL editor)
- [ ] school_admin_links table created
- [ ] pending_parent_links table created
- [ ] calculate_streak DB function created (YOU run this in Supabase SQL editor)
- [ ] get_usage_graph_uni(p_user_id, p_days) DB function created — queries user_events by user_id (YOU run this in Supabase SQL editor)
- [ ] get_usage_graph_secondary(p_user_id, p_days) DB function created — queries section_learning_events by student_id (YOU run this in Supabase SQL editor)

**Backend — Uni Dashboard (expanded):**
- [ ] GET /dashboard — multi-query assembly replacing RPC
- [ ] Streak: current + longest, grace day logic, qualifying event types
- [ ] Usage graph: 7 days, minutes, current vs previous 7 days %
- [ ] Session count this week vs last week
- [ ] Existing widgets preserved: continue_learning, recent_sessions,
      progress, next_recommended, recent_notes

**Backend — Secondary Dashboard:**
- [ ] GET /secondary/dashboard
- [ ] Continue learning: last incomplete subsection deep link
- [ ] Chapter progress rings (completed/total subsections per chapter)
- [ ] Streak: current + longest, grace day, GSAP on increment
- [ ] Usage graph: 7 days from section_learning_events.session_duration_seconds
- [ ] Strengths: highest avg comprehension_depth per chapter (past 3 months)
- [ ] Weaknesses: lowest scores + struggle_points frequency
- [ ] Most pressing: low score + prerequisite for upcoming chapters
- [ ] Session count this week vs last week
- [ ] Days since last session
- [ ] Recently completed chapters
- [ ] Next chapter preview

**Backend — Parent Dashboard:**
- [ ] GET /parent/dashboard — requires role = parent
- [ ] Per linked student: name, class, streak, study time, current chapter,
      chapter progress, top weaknesses, last active, sessions this week
- [ ] POST /profile/link-parent — student links parent email
      existing account → create parent_students immediately, send notification
      no account → create pending_parent_links, send parent_invite email
- [ ] Post-signup hook: check pending_parent_links for email, resolve link

**Backend — School Admin Dashboard:**
- [ ] GET /school/dashboard — requires role = school_admin
- [ ] School overview: total students, active this week, avg study time,
      avg streak, % completed at least one chapter
- [ ] Per-student table: name, class, sessions, current chapter,
      last active, status (active/inactive/at_risk)
- [ ] Weak topics: top 3 most common struggle_points across school (3 months)
- [ ] GET /school/report/monthly — aggregated monthly data
- [ ] At-risk logic: no session 14+ days OR surface comprehension 2+ weeks

**Backend — APScheduler additions:**
- [ ] Weekly parent WhatsApp nudge job (Termii) — add to existing scheduler
- [ ] Monthly school report job (Resend/Termii) — add to existing scheduler

**Backend — user_events:**
- [ ] parent_linked, parent_invite_sent, parent_invite_accepted
- [ ] school_report_viewed, dashboard_viewed (all types, with user_type tag)

**Frontend — Uni Dashboard (upgraded):**
- [ ] Streak counter with GSAP animation on increment
- [ ] 7-day usage graph (Y: minutes, X: day labels)
- [ ] Percentage highlights above graph (vs previous 7 days)
- [ ] Session count comparison
- [ ] Existing widgets styled to new design system

**Frontend — Secondary Dashboard:**
- [ ] All widgets from backend above
- [ ] Subject progress rings per chapter
- [ ] Strengths/weaknesses display (topic names only, no scores)
- [ ] Daily/weekly toggle on graph (current vs previous period)

**Frontend — Parent Dashboard:**
- [ ] Per-student summary cards
- [ ] Study time graph per student
- [ ] Weakness topics per student
- [ ] Empty state before any student links them

**Frontend — School Admin Dashboard:**
- [ ] School overview stats
- [ ] Student table with status badges (active/inactive/at_risk)
- [ ] Weak topics list
- [ ] Monthly report download or view

---

## FEATURE 05 — Keyword Highlighting in Note Chats
### Uni side. Frontend only. No backend changes.

**Frontend:**
- [ ] At note session start: extract key_definitions from lesson plan payload
      (check exact column structure before implementing — ask David if unclear)
- [ ] Build term → definition lookup Map
- [ ] After each AI stream completes: run highlighting pass
      (never during streaming)
- [ ] Word boundary matching, longer terms first
- [ ] Skip KaTeX nodes (class 'katex') and code blocks
- [ ] Wrap: <mark class="key-term" data-term="...">
- [ ] Desktop: hover tooltip (200ms fade-in, amber-50 background)
- [ ] Mobile: tap to expand inline or bottom sheet
- [ ] escapeRegex() applied to all term strings
- [ ] user_events: key_term_hovered, key_term_tapped

---

## FEATURE 06 — Onboarding
### Secondary school, university, parent. Promo code system.

**DB (YOU run these in Supabase SQL editor — not Claude Code):**
- [x] user_profiles ALTER TABLE (all new columns — see setup_checklist.md Part 2)
- [x] promo_codes table created
- [x] promo_redemptions table created

**Backend — Secondary School Onboarding:**
- [x] POST /onboarding/secondary — incremental save per screen
      Screen 1: full_name
      Screen 2: date_of_birth + age validation (block under-13)
      Screen 3: secondary_class_level
      Screen 4: school_name (fuzzy match against schools table)
      Screen 5: life_goals (JSONB array)
      Screen 6: education_sentiment
      Screen 7: notification_prefs + phone_number (encrypted via Vault)
      Screen 8: paywall / promo code / membership detection
- [x] onboarding_step incremented per screen (resume on re-login)
- [x] Under-13 hard stop: clear message, no data stored, account suspended
- [x] Invited member detection: check subscription_members before paywall
- [x] POST /onboarding/promo — validate code, redeem, create pilot subscription

**Backend — University Onboarding:**
- [x] POST /onboarding/university — incremental save per screen
      Screen 1: full_name
      Screen 2: date_of_birth
      Screen 3: institution_name + course_of_study
      Screen 4: initial_struggle_topics (JSONB array)
      Screen 5: education_sentiment
      Screen 6: notification_prefs + phone_number (encrypted)
      Screen 7: dashboard (no paywall — existing credit system)

**Backend — Parent Onboarding:**
- [x] POST /onboarding/parent — 2 screens: full_name, dashboard
- [x] role = parent set at signup
- [x] Empty parent dashboard state until student links them

**Backend — Email/Password Auth:**
- [x] Supabase email/password provider enabled (David does this in dashboard)
- [x] Email verification before onboarding starts
- [x] Password reset flow (Supabase native until custom domain)
- [x] Post-signup hook: check subscription_invites AND pending_parent_links
      for new user's email — resolve any pending links automatically

**Backend — Promo Code Admin:**
- [x] POST /admin/promo/create — generate code, set access_days, max_uses, expiry
- [x] GET /admin/promo/list — all codes with uses_count and status
- [x] PATCH /admin/promo/{id}/toggle — activate/deactivate

**Backend — user_events:**
- [x] onboarding_started, onboarding_screen_completed (with screen_number + user_type)
- [x] onboarding_completed, onboarding_dropped
- [x] promo_code_redeemed, promo_code_invalid, promo_code_expired
- [x] parent_link_initiated, parent_link_completed, parent_invite_sent

**Frontend — Secondary School Onboarding (8 screens):**
- [x] Full-viewport screens, GSAP page transitions
- [x] Single question per screen
- [x] Screen 1: name input
- [x] Screen 2: DOB picker + age range motivational response, under-13 block
- [x] Screen 3: SS1/SS2/SS3 large tap targets
- [x] Screen 4: school autocomplete input with fuzzy suggestions
- [x] Screen 5: goal multi-select (6 options + Other free text)
- [x] Screen 6: education sentiment (4 options + empathetic one-liner response)
- [x] Screen 7: notification preferences toggle + optional phone number
- [x] Screen 8: paywall (plan cards + promo code entry + "free chapter" skip)
      Invited member variant: membership confirmation screen instead
- [x] Each screen posts immediately (incremental save)
- [x] Resume from last completed screen on re-login

**Frontend — University Onboarding (7 screens):**
- [x] Screens 1-2: same as secondary
- [x] Screen 3: institution + course inputs
- [x] Screen 4: struggle topic multi-select
- [x] Screen 5: education sentiment (same as secondary)
- [x] Screen 6: notification preferences + phone number
- [x] Screen 7: lands on dashboard (no paywall screen)

**Frontend — Parent Onboarding (2 screens):**
- [x] Screen 1: name
- [x] Screen 2: parent dashboard with empty state instructions

**Frontend — Profile Settings:**
- [x] "Add a parent or guardian" section
- [x] Parent email input + link button
- [x] Pending/linked status display

---

## GLOBAL — Applies to Every Feature

- [ ] bleach sanitize_input() utility function applied to all text inputs
- [ ] Rate limiting on every new endpoint (see feature files for per-endpoint limits)
- [ ] IDOR guards on every user data query
- [ ] Parameterized queries only — no f-string SQL anywhere
- [ ] All new DB functions: SECURITY DEFINER + search_path + REVOKE + GRANT
- [ ] model_usage logged for every AI call
- [ ] user_events logged for every significant action
- [ ] RLS enabled on every new table
- [ ] Phone numbers encrypted via Supabase Vault (never plain text)
- [ ] X-Device-Token sent in API client interceptor (frontend, one place)
- [ ] KaTeX rendering for all LaTeX in student-facing content
- [ ] Fully responsive — every component tested at 375px mobile width

---

## NOT BUILDING THIS SPRINT (Phase 2 — do not implement)

- Uni student knowledge profile (uni_knowledge_events + Haiku extraction)
- Teacher dashboard
- Bulk parent linking via school admin
- Mobile app (web only)
- Custom domain email configuration
- Text-to-speech
- Social layer / group projects
- CoderRaven

