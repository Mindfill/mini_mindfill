# Feature 02 — Secondary School Lesson Flow
## Techcess Secondary School Sprint — September 2026

---

## Scope
Full secondary school lesson experience: navigation hierarchy, subsection display,
static content zone, tutor zone, unlock logic, assessment integration, Manim display,
admin authoring tool, and all supporting DB tables.

---

## Navigation Hierarchy

```
Dashboard
└── Subjects (filtered by student's class level — SS1/SS2/SS3)
    └── Chapter (table of contents with expandable sections)
        └── Section (expandable — reveals subsection list)
            └── Subsection (atomic learning unit)
```

### Class level
- Set during onboarding: student picks SS1 / SS2 / SS3
- Stored on user_profiles (add field: secondary_class_level)
- Filters curriculum_subjects served to student
- Dashboard shows flat ungrouped subject list — no segmentation UI
- curriculum_subjects has class_level field:
  CHECK (class_level IN ('SS1', 'SS2', 'SS3', 'university'))

---

## Payment Tiers (Secondary School)

```
Individual monthly:  ₦5,000/month
Individual yearly:   ₦40,000/year
Family monthly:      ₦10,000/month  (1 owner + 2 members — secondary only)
Family yearly:       ₦80,000/year
```

Free access: Ch00 Mental Models only. No credits, no time limit on Ch00.
Ch01–Ch12: paid access required.

Add plan_type field to subscriptions table:
```sql
plan_type text CHECK (plan_type IN (
  'uni_monthly', 'uni_yearly',
  'secondary_individual_monthly', 'secondary_individual_yearly',
  'secondary_family_monthly', 'secondary_family_yearly'
))
```

---

## Content Access Rules

```
Ch00 Mental Models → FREE (all authenticated users, no subscription check)
Ch01–Ch12          → PAID (active subscription required, any secondary plan)
```

Enforced at backend endpoint level. Frontend locks are UI only — never trusted.
Backend checks chapter against free-access list before subscription middleware.

---

## DB Schema — Curriculum (static, seeded from spreadsheet)

### curriculum_subjects
```sql
CREATE TABLE curriculum_subjects (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_slug  text NOT NULL UNIQUE,
  title         text NOT NULL,
  class_level   text NOT NULL CHECK (class_level IN ('SS1','SS2','SS3','university')),
  description   text,
  display_order int NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

### curriculum_chapters
```sql
CREATE TABLE curriculum_chapters (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id                uuid NOT NULL REFERENCES curriculum_subjects(id),
  chapter_id_slug           text NOT NULL UNIQUE,  -- e.g. ss1-math-ch01
  chapter_number            int NOT NULL,
  chapter_title             text NOT NULL,
  learning_objectives       text,   -- pipe-separated, shown to student
  nerdc_performance_objective text, -- AI context only
  chapter_misconceptions    text,   -- AI context only, injected at session start
  is_free                   boolean NOT NULL DEFAULT false,  -- true for Ch00 only
  display_order             int NOT NULL,
  status                    text NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft','active','archived')),
  notes                     text,
  created_at                timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_curriculum_chapters_subject ON curriculum_chapters(subject_id);
```

### curriculum_sections
```sql
CREATE TABLE curriculum_sections (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id     uuid NOT NULL REFERENCES curriculum_chapters(id),
  section_label  text NOT NULL,   -- e.g. "1.1 What is a Number Base?"
  section_number int NOT NULL,
  display_order  int NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_curriculum_sections_chapter ON curriculum_sections(chapter_id);
```

### curriculum_subsections
```sql
CREATE TABLE curriculum_subsections (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subsection_id_slug      text NOT NULL UNIQUE,  -- e.g. ss1-math-ch01-s1-01
  section_id              uuid NOT NULL REFERENCES curriculum_sections(id),
  chapter_id              uuid NOT NULL REFERENCES curriculum_chapters(id),
  subsection_title        text NOT NULL,
  subsection_type         text NOT NULL CHECK (subsection_type IN (
                            'definition_analogy','conceptual_illustration',
                            'worked_example','misconception_address',
                            'mini_quiz','translation_to_math',
                            'translation_to_english','end_of_chapter')),
  display_order           int NOT NULL,

  -- Student-facing fields (conversational tone + LaTeX)
  analogy_text            text,
  intuition_explanation   text,
  nigerian_real_world_context text,
  key_definitions         text,   -- pipe-separated
  chat_prompt_text        text,

  -- Manim prompts (JSONB array with tracking state)
  -- Format: [{"index":1,"prompt":"...","position":"after_analogy",
  --           "approval_status":"pending","storage_url":null,
  --           "render_attempts":0,"last_rendered_at":null}]
  manim_prompts           jsonb,

  -- Tutor-only fields (never shown to student)
  why_revelation          text,
  common_misconceptions   text,
  nerdc_content_knowledge text,
  section_learning_goal   text,   -- only on last subsection of each section

  -- Prerequisite and unlock
  prerequisite_subsection_ids text,  -- pipe-separated slugs

  -- Minimum exchange floor per type
  min_exchange_count      int NOT NULL DEFAULT 1,

  -- Comprehension depth threshold for unlock
  unlock_depth_threshold  text NOT NULL DEFAULT 'procedural'
                            CHECK (unlock_depth_threshold IN (
                              'surface','procedural','conceptual','transferable')),

  status                  text NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','active','archived')),
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_curriculum_subsections_section ON curriculum_subsections(section_id);
CREATE INDEX idx_curriculum_subsections_chapter ON curriculum_subsections(chapter_id);
CREATE INDEX idx_curriculum_subsections_slug ON curriculum_subsections(subsection_id_slug);
```

### curriculum_problems (question bank)
```sql
CREATE TABLE curriculum_problems (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id_slug    text NOT NULL UNIQUE,
  chapter_id          uuid NOT NULL REFERENCES curriculum_chapters(id),
  subsection_id       uuid REFERENCES curriculum_subsections(id),
  question_placement  text NOT NULL CHECK (question_placement IN (
                        'mini_quiz','end_of_chapter_problem',
                        'translation_to_math','translation_to_english')),
  question_type       text NOT NULL CHECK (question_type IN (
                        'conceptual','procedural','real_world')),
  tutor_access        boolean NOT NULL DEFAULT false,
  difficulty          text NOT NULL CHECK (difficulty IN (
                        'foundational','standard','extended')),
  question_text       text NOT NULL,
  answer              text NOT NULL,
  working             text NOT NULL,  -- mandatory, doubles as grading rubric
  marks               int,
  pattern_source      text,           -- IP shield — textbook ref not verbatim
  nigerian_context    boolean NOT NULL DEFAULT false,
  status              text NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','active','archived')),
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_curriculum_problems_chapter ON curriculum_problems(chapter_id);
CREATE INDEX idx_curriculum_problems_subsection ON curriculum_problems(subsection_id);
```

---

## DB Schema — Student State

### student_knowledge_state
```sql
CREATE TABLE student_knowledge_state (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subsection_id         uuid NOT NULL REFERENCES curriculum_subsections(id),
  completion_status     text NOT NULL DEFAULT 'locked'
                          CHECK (completion_status IN (
                            'locked','unlocked','in_progress','completed')),
  comprehension_depth   text CHECK (comprehension_depth IN (
                          'surface','procedural','conceptual','transferable')),
  attempt_count         int NOT NULL DEFAULT 0,
  last_session_at       timestamptz,

  -- Compact carryover JSON injected into tutor context next session
  -- ~200-300 tokens: misconceptions surfaced, breakthrough boolean,
  --   struggle points, prior gaps, confidence signal
  knowledge_carryover   jsonb,

  -- Behavioral signals
  engagement_pattern    text CHECK (engagement_pattern IN (
                          'active','passive','reluctant')),
  expressed_interest    text,
  curiosity_signal      int DEFAULT 0,  -- count of unprompted why questions

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, subsection_id)
);
CREATE INDEX idx_student_knowledge_student ON student_knowledge_state(student_id);
CREATE INDEX idx_student_knowledge_subsection ON student_knowledge_state(subsection_id);
CREATE INDEX idx_student_knowledge_status ON student_knowledge_state(student_id, completion_status);
```

### secondary_sessions (active + completed tutor sessions)
```sql
CREATE TABLE secondary_sessions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subsection_id         uuid NOT NULL REFERENCES curriculum_subsections(id),
  session_type          text NOT NULL DEFAULT 'first_attempt'
                          CHECK (session_type IN ('first_attempt','review')),
  status                text NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','completed','abandoned')),
  exchange_count        int NOT NULL DEFAULT 0,
  comprehension_depth   text CHECK (comprehension_depth IN (
                          'surface','procedural','conceptual','transferable')),
  unlock_ready          boolean NOT NULL DEFAULT false,
  started_at            timestamptz NOT NULL DEFAULT now(),
  completed_at          timestamptz,
  session_duration_seconds int,  -- completed_at - started_at, for dashboard time metric
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_secondary_sessions_student ON secondary_sessions(student_id);
CREATE INDEX idx_secondary_sessions_subsection ON secondary_sessions(subsection_id);
```

### secondary_conversations (message history per session)
```sql
CREATE TABLE secondary_conversations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid NOT NULL REFERENCES secondary_sessions(id) ON DELETE CASCADE,
  student_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         text NOT NULL CHECK (role IN ('user','assistant')),
  content      text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_secondary_conversations_session ON secondary_conversations(session_id);
```

### section_learning_events (Haiku extraction output — one row per completed session)
```sql
CREATE TABLE section_learning_events (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id              uuid NOT NULL REFERENCES secondary_sessions(id),
  subsection_id           uuid NOT NULL REFERENCES curriculum_subsections(id),
  session_type            text NOT NULL CHECK (session_type IN ('first_attempt','review')),
  exchange_count          int NOT NULL,
  session_duration_seconds int,
  comprehension_depth     text CHECK (comprehension_depth IN (
                            'surface','procedural','conceptual','transferable')),
  data_confidence         text NOT NULL CHECK (data_confidence IN (
                            'high','low','insufficient')),
  misconceptions_surfaced jsonb,   -- array of strings
  misconceptions_resolved jsonb,   -- array of strings
  breakthrough_moment     boolean,
  struggle_points         jsonb,   -- array of strings
  prior_knowledge_gaps    jsonb,   -- array of strings
  confidence_signal       text CHECK (confidence_signal IN ('high','medium','low')),
  engagement_pattern      text CHECK (engagement_pattern IN (
                            'active','passive','reluctant')),
  readiness_for_next      boolean,
  created_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_section_learning_events_student ON section_learning_events(student_id);
CREATE INDEX idx_section_learning_events_subsection ON section_learning_events(subsection_id);
CREATE INDEX idx_section_learning_events_created ON section_learning_events(created_at);
```

### student_progress_history (append-only, assume already created)
```sql
-- Table already exists — do not CREATE it, just write to it.
CREATE TABLE student_progress_history (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subsection_id         uuid NOT NULL REFERENCES curriculum_subsections(id),
  chapter_id            uuid NOT NULL REFERENCES curriculum_chapters(id),  -- on the live table; missing from the original spec (found 2026-09-15)
  event_type            text NOT NULL CHECK (event_type IN (
                          'first_completion','review','regression','recovery')),
  comprehension_depth   text NOT NULL CHECK (comprehension_depth IN (
                          'surface','procedural','conceptual','transferable')),
  depth_score           int NOT NULL CHECK (depth_score BETWEEN 1 AND 4),
  previous_depth        text CHECK (previous_depth IN (
                          'surface','procedural','conceptual','transferable')),
  previous_depth_score  int CHECK (previous_depth_score BETWEEN 1 AND 4),
  struggle_points       jsonb,   -- from Haiku extraction output
  created_at            timestamptz NOT NULL DEFAULT now()
);
-- RLS: students SELECT their own rows only. No INSERT policy for
-- authenticated — backend writes via service role.
```

**Append-only. Never UPDATE or DELETE rows in this table** — it's the full
timeline of a student's comprehension depth per subsection, used by the
dashboard to show weakness resolution over time.

**Depth score mapping (use this everywhere depth_score is derived):**
```
surface      = 1
procedural   = 2
conceptual   = 3
transferable = 4
```

**event_type derivation** (compare new depth_score to the subsection's
previous depth_score from student_knowledge_state before overwriting it):
```
first_completion — no previous student_knowledge_state row for this subsection
review            — revisit, depth_score unchanged
regression        — revisit, new depth_score LOWER than previous
recovery          — revisit, new depth_score HIGHER than previous
```

**Write path — on every /secondary/sessions/complete (first_attempt with
extraction, per the Session Lifecycle section above):**
```
1. Before overwriting student_knowledge_state, read the existing row for
   this (student_id, subsection_id) to get previous_depth + previous_depth_score
2. Update student_knowledge_state as normal
3. Insert into student_progress_history:
   - event_type derived from the comparison above
   - comprehension_depth + depth_score = new values
   - previous_depth + previous_depth_score = old values (null if first_completion)
   - struggle_points = Haiku extraction output's struggle_points
```

**Dashboard queries this table feeds (Feature 04):**
```sql
-- Weakness resolution: "used to struggle here, now mastered"
SELECT subsection_id
FROM student_progress_history
WHERE student_id = :current_user
GROUP BY subsection_id
HAVING MIN(depth_score) = 1 AND MAX(depth_score) >= 3;

-- Current weaknesses (from student_knowledge_state, not this table):
SELECT * FROM student_knowledge_state
WHERE student_id = :current_user
  AND comprehension_depth IN ('surface','procedural')
  AND completion_status = 'completed';
```

---

## DB Schema — School + Parent Structure

### schools
```sql
CREATE TABLE schools (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name   text NOT NULL,
  city          text,
  state         text,
  contact_name  text,
  contact_email text,
  contact_phone text,
  whatsapp_number text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

### school_students
```sql
CREATE TABLE school_students (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid NOT NULL REFERENCES schools(id),
  student_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_level text NOT NULL CHECK (class_level IN ('SS1','SS2','SS3')),
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  is_active   boolean NOT NULL DEFAULT true,
  UNIQUE(school_id, student_id)
);
CREATE INDEX idx_school_students_school ON school_students(school_id);
CREATE INDEX idx_school_students_student ON school_students(student_id);
```

### parents
```sql
CREATE TABLE parents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name       text NOT NULL,
  email           text,
  whatsapp_number text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

### parent_students
```sql
CREATE TABLE parent_students (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   uuid NOT NULL REFERENCES parents(id),
  student_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_given boolean NOT NULL DEFAULT false,
  linked_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(parent_id, student_id)
);
CREATE INDEX idx_parent_students_parent ON parent_students(parent_id);
CREATE INDEX idx_parent_students_student ON parent_students(student_id);
```

---

## Subsection Page Layout (single scrollable column)

```
1. Breadcrumb: Subject → Chapter → Section → Subsection title
2. Progress indicator: "Section 2 of 6 · Subsection 3 of 4"

── STATIC CONTENT ZONE ──
3a. Analogy block (distinct callout styling)
3b. Manim visual (if position = after_analogy) — pre-generated, inline full-width
3c. Intuition explanation (prose + KaTeX)
3d. Manim visual (if position = after_intuition)
3e. Nigerian real-world context block (distinct styling)
3f. Manim visual (if position = after_context)
3g. Key definitions (definition card components)
3h. Manim visual (if position = after_definitions)
3i. Chat prompt text (question bubble — pulls toward tutor)

── TRANSITION ANIMATION ──
   GSAP: divider line animates across page width
   "Chat with your tutor" fades in with slide-up
   Tutor opening message types in (typewriter effect)

── TUTOR ZONE ──
4a. Tutor opening message (cold start — calibrated to subsection_type)
4b. Chat interface
4c. Dynamic Manim visuals inline in chat thread when triggered
4d. Next button (state-driven — see unlock logic below)

── UNLOCK ZONE (state 3 only) ──
5a. Context line above button: "Next up: [next subsection title]"
    or "Chapter complete: [chapter title]" if last subsection
5b. Button: "I'm ready →" (GSAP pulse animation into full colour)
```

Mini quiz subsections: no tutor zone. Questions displayed, Haiku evaluator on submit.
Pass/partial/fail + one sentence feedback. Retry allowed before unlock.

End of chapter subsections: reflection text + open question. No tutor.
"Chapter Complete" GSAP animation fires. Next chapter unlocks.

---

## Next Button — Three States

```
State 1 — HIDDEN
  Condition: student has not scrolled to bottom of static content
  Display: nothing

State 2 — VISIBLE BUT DISABLED
  Condition: scrolled past static content, in tutor conversation,
             threshold not yet met
  Display: greyed-out button, tooltip "Keep going — your tutor will
           let you know when you're ready"

State 3 — UNLOCKED
  Condition: exchange_count >= min_exchange_count
             AND comprehension_depth >= unlock_depth_threshold
  Display: GSAP transition — button pulses into full colour
  Text: "I'm ready →"
  Above button: "Next up: [subsection title]" or chapter completion text
```

---

## Session Lifecycle + Assessment Integration

```
Student reaches tutor zone (scroll trigger)
→ POST /secondary/sessions/start {subsection_id}
  - Check student_knowledge_state for completion_status
  - If completed: session_type = 'review'
  - If not: session_type = 'first_attempt'
  - Insert secondary_sessions row
  - Assemble system prompt (see below)
  - Return session_id + tutor opening message

Each exchange:
→ POST /secondary/sessions/chat {session_id, message}
  - Append to secondary_conversations
  - Increment exchange_count on session row
  - Stream tutor response (SSE)
  - asyncio.create_task → assessment call (non-blocking)
    Input: conversation so far + subsection_type +
           why_revelation + thresholds
    Model: GPT 5.6 Luna medium reasoning
    Output: {comprehension_depth, unlock_ready}
  - Update secondary_sessions.comprehension_depth + unlock_ready
  - If unlock_ready = true → SSE event fires to frontend
    → Button transitions to State 3

Student presses "I'm ready →":
→ POST /secondary/sessions/complete {session_id}
  - Set secondary_sessions.status = completed
  - Set completed_at, calculate session_duration_seconds
  - If session_type = first_attempt:
    - If exchange_count >= min_exchange_count:
      asyncio.create_task → Haiku extraction call
      Insert section_learning_events row
      Update student_knowledge_state (completion_status, comprehension_depth,
        engagement_pattern, knowledge_carryover)
    - Else: log data_confidence = insufficient, skip extraction
    - Unlock next subsection (set completion_status = unlocked)
  - If session_type = review:
    - Skip section_learning_events insert
    - If comprehension_depth > original: update upward only
    - Never unlock or re-lock anything
  - Log user_events: subsection_completed or subsection_reviewed

Rolling summarization:
  Same pattern as existing endpoints — Haiku summarization every 20 exchanges,
  asyncio.create_task, structured JSON summary stored on session row.
```

---

## System Prompt Assembly (per session start)

```
[CACHED PREFIX — same for all students on same subsection]
1. Subsection type instruction block (drives tutor behaviour)
2. Static content: analogy, intuition, context, definitions, chat_prompt_text
3. Tutor directives: why_revelation, common_misconceptions
4. Chapter-level: chapter_misconceptions (standing awareness)
5. Section learning goal (if last subsection in section)

[DYNAMIC SUFFIX — per student]
6. Student knowledge carryover JSON (~200-300 tokens from previous sessions)
7. Conversation history (current session only)
```

Prompt caching: OpenAI prefix caching on the cached prefix block.
Cache hits high because prefix is identical for every student on same subsection.

NERDC learning objectives injected from chapter.learning_objectives into
the session context so tutor knows the curriculum anchor for this chapter.

NERDC physical/digital activity references: tutor prompt instructs model to
extract the learning objective and adapt it into explanation, worked examples,
or interactive questioning — never attempt to replicate physical activities.

---

## Manim Display Architecture

### Static content visuals (pre-generated)
- Authored in spreadsheet as manim_prompts JSONB array
- Seeded with approval_status: pending
- Admin renders, reviews, approves before going live
- Served as simple DB query — zero render cost at runtime
- Only approved visuals served to students
- Inline within static content zone at authored position

### Chat/tutor visuals (dynamic)
- Triggered during tutor conversation when concept needs visual support
- Simpler abstract scenes only (number lines, formula breakdowns, shape diagrams)
- pgvector cached at 0.88 cosine threshold (existing infrastructure)
- Cross-user cache hits compound over time — costs flatten at scale
- Rendered inline in chat thread at point of generation

---

## Admin Authoring Tool

Protected route: /admin/curriculum
Access: user_profiles.role = 'admin' only

### Seeding pipeline
```
1. Author subsections in spreadsheet (manim_prompts as JSON array)
2. Export spreadsheet as CSV
3. POST /admin/curriculum/seed {csv}
   - Parse and validate all fields
   - Transform manim_prompts: add tracking fields per prompt object
     (approval_status: pending, storage_url: null, render_attempts: 0)
   - Insert curriculum_subsections rows
4. Admin tool shows all pending visuals
5. Render → review → iterate prompt → approve
6. Approved visuals stored, instantly live for students
```

### Admin endpoints
```
POST /admin/curriculum/seed              — CSV import and transform
GET  /admin/curriculum/visuals           — list visuals by status (filterable by chapter)
POST /admin/curriculum/visuals/render    — trigger Modal render for one prompt
POST /admin/curriculum/visuals/approve   — set approval_status = approved
PUT  /admin/curriculum/visuals/prompt    — edit prompt text before retry
```

### Admin panel table view
```
Chapter | Section | Subsection | Visual # | Prompt (editable) | Status | Preview | Actions
```
Filters: by chapter, by status (pending/rendered/approved)
Bulk render: trigger all pending visuals in a chapter simultaneously

---

## Student Dashboard

### Streak
- Existing streak table extended if needed
- Grace day: one missed day does not break streak
- GSAP animation on streak increment
- Display: current streak count + longest streak

### Progress graph
- Y axis: time in minutes (source: section_learning_events.session_duration_seconds)
- X axis: days (daily view) or weeks (weekly view)
- Toggle: current period vs previous period overlaid
- DB function per widget for efficient aggregation

### Strengths and weaknesses
- Source: section_learning_events.comprehension_depth aggregated per chapter
- Strongest: highest average comprehension_depth
- Weakest: lowest scores + highest struggle_points frequency
- Most pressing: low comprehension + prerequisite for upcoming chapters
- Display: topic names only ("Strong in Number Bases. Logarithms needs work.")

### Additional dashboard elements
- "Continue where you left off" — deep link to last incomplete subsection
- Time since last session ("You haven't studied in 3 days")
- Session count this week vs last week
- Knowledge depth distribution across completed subsections
- Estimated time to complete current chapter
- Recently unlocked chapters (progress celebration)
- Upcoming chapter preview (forward pull)

### Daily/weekly toggle
- Applies to: progress graph, session count, study time total
- Shows current period data vs previous period for comparison
- Same dashboard design for uni and secondary school students
- Parent and school admin dashboards: aggregates of same data (designed separately)

---

## UI/UX Notes

- Fully responsive: desktop and mobile
- Font stack: Inter (UI), JetBrains Mono (code/math expressions) — existing
- GSAP for: streak animations, button state transitions, chapter complete celebration,
  static-to-tutor zone transition, subsection unlock pulse
- KaTeX for all LaTeX rendering in static content and chat
- Completion ticks: per subsection, propagate up — section complete when all
  subsections done, chapter complete when all sections done
- Hover effects and animations: modern design system components
- Chapter cards: lock icon (locked), progress bar (in progress), tick (complete)
- Ch00 Mental Models: visually distinct — "Start here" treatment, always unlocked

### UI component sources for Claude Code
- shadcn/ui — base components (already available in React artifacts)
- Framer Motion — alternative to GSAP for React-native animation if preferred
- GSAP — for complex timeline animations (chapter complete, streak)
- Tailwind CSS — utility styling (existing)
- Radix UI — accessible primitives underlying shadcn

---

## model_usage Logging (this feature)

Log every AI call to existing model_usage table:
```
tutor_exchange        — GPT 5.6 Luna, per message
assessment_call       — GPT 5.6 Luna, per exchange (background)
haiku_extraction      — Haiku, per completed first_attempt session
rolling_summarization — Haiku, every 20 exchanges
quiz_evaluation       — Haiku, per mini quiz submission
```

## user_events Logging (this feature)
```
subsection_started
subsection_completed
subsection_reviewed
chapter_completed
subject_completed
quiz_submitted
quiz_passed
quiz_failed
manim_visual_served     — static
manim_visual_generated  — dynamic chat
session_abandoned       — session started but never completed
```

---

## API Endpoints (Secondary School Lesson Flow)

```
GET  /secondary/subjects                         — list subjects for student's class level
GET  /secondary/chapters/{subject_id}            — chapter list with completion state
GET  /secondary/sections/{chapter_id}            — section + subsection TOC
GET  /secondary/subsections/{subsection_id}      — full subsection content + visuals
POST /secondary/sessions/start                   — start tutor session
POST /secondary/sessions/chat                    — send message, stream response
POST /secondary/sessions/complete                — complete session, trigger extraction
GET  /secondary/sessions/{session_id}/history    — conversation history
POST /secondary/quiz/submit                      — submit mini quiz answers
GET  /secondary/progress/{student_id}            — full student progress state
GET  /secondary/dashboard                        — dashboard data (all widgets)
```

---

## Open Questions — Resolved

| Question | Decision |
|----------|----------|
| Manim static content | Pre-generated, admin-approved, zero runtime render cost |
| Manim chat visuals | Dynamic, pgvector cached, simple abstract scenes only |
| Admin retry tool | Internal admin panel, not student-facing |
| Class level UI | Flat ungrouped subject list, class level filters content only |
| Chapter unlock order | Sequential — cannot skip chapters |
| Teacher chapter override | Not built — sequential lock is absolute |
| Review session detection | DB read only — checks completion_status, no model call |
| Review session extraction | Skipped — knowledge_state updated upward only |
| Revisit conversation | Original conversation shown, no fresh start option |
| Assessment model | GPT 5.6 Luna medium reasoning |
| Tutor model | GPT 5.6 Luna medium reasoning |
| Extraction model | Haiku |
| Prompt caching | OpenAI prefix caching on system prompt static block |
| Next button text | "I'm ready →" |
| Next button context | Subsection title or chapter completion text above button |
| Streak grace day | Yes — one missed day does not break streak |
| Dashboard Y axis | Time in minutes |

