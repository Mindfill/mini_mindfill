# Techcess — Complete Supabase Schema Reference
## Claude Code reads this to know every table, function, and policy.
## Never guess column names — reference this file first.

---

## IMPORTANT — Existing Tables Not Fully Documented Here

The following tables existed before this sprint. Claude Code must ask David
for their full schema before writing any query against them:

```
notes
note_sections
note_lesson_plans
note_conversations
note_progress
note_sessions
notes_summaries
user_courses
visualizations
note_quizzes          — partial schema below (sprint added quiz_type column)
note_question_attempts
note_flashcards
lessons
conversations
lesson_blueprints
lesson_progress
chat_sessions
lesson_summaries
processed_payment_references
subscriptions         — partial schema below (sprint added plan_type column)
questions
question_attempts
suggestions
manim_scripts
user_events           — partial schema below (session_id and note_id are nullable)
model_usage
modules
courses
```

Ask David: "Can you paste the schema for [table_name]?" before writing
queries against any table in the list above.

---

## EXISTING TABLE — user_profiles (full schema)

```sql
create table public.user_profiles (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  full_name text null,
  date_of_birth date null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  streak_current integer null default 0,
  streak_longest integer null default 0,
  last_active_date date null,
  onboarding_completed boolean not null default false,
  study_level text null,
  -- Sprint additions:
  secondary_class_level text null
    check (secondary_class_level in ('SS1','SS2','SS3')),
  school_name text null,
  institution_name text null,
  course_of_study text null,
  life_goals jsonb null,
  education_sentiment text null,
  initial_struggle_topics jsonb null,
  onboarding_step int not null default 0,
  user_type text not null default 'university'
    check (user_type in ('university','secondary','parent')),
  role text not null default 'student'
    check (role in ('student','parent','school_admin','admin')),
  phone_number text null,
  notification_prefs jsonb null
    default '{"whatsapp": false, "email": true}'::jsonb,
  parent_email text null,
  student_knowledge_profile jsonb null,
  deregister_cooldown_until timestamptz null,
  -- Onboarding sprint addition (terms/NDPR-GDPR compliance):
  terms_accepted boolean not null default false,
  terms_accepted_at timestamptz null,
  constraint user_profiles_pkey primary key (id),
  constraint user_profiles_user_id_key unique (user_id),
  constraint user_profiles_user_id_fkey foreign key (user_id)
    references auth.users(id) on delete cascade
);

-- David runs (not yet applied as of the onboarding build):
-- ALTER TABLE user_profiles
-- ADD COLUMN IF NOT EXISTS terms_accepted boolean NOT NULL DEFAULT false,
-- ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
--
-- CRITICAL — run this in the SAME migration, immediately after the ALTER above:
-- app/core/onboarding_gate.py now 403s every protected endpoint for any user
-- where onboarding_completed or terms_accepted is false. terms_accepted is
-- brand new and defaults to false for EVERYONE, including existing live uni
-- users — without this backfill, deploying the gate locks out your entire
-- current user base the moment it ships.
-- UPDATE user_profiles SET terms_accepted = true, terms_accepted_at = now()
--   WHERE terms_accepted = false;
-- UPDATE user_profiles SET onboarding_completed = true
--   WHERE onboarding_completed = false;
-- (New signups going forward correctly default to false and must go through
--  onboarding + the terms screen — this backfill only touches rows that
--  exist at migration time.)

-- Trigger: updates updated_at on every row update
create trigger set_updated_at
  before update on user_profiles
  for each row execute function update_updated_at();
```

**Key notes:**
- FK is on `user_id` column, not `id` — always join on `user_id = auth.uid()`
- `full_name` is the name field — not `display_name`
- `phone_number` is encrypted at the application layer (not a DB function) —
  `encrypt_phone`/`decrypt_phone` in `app/utils/encryption.py`, keyed by the
  `PHONE_ENCRYPTION_KEY` env var. The column stays plain `text`; the value in
  it is ciphertext. Never store or log the raw number.
- `streak_current` and `streak_longest` already exist — do not duplicate streak logic
- `terms_accepted`/`terms_accepted_at` (onboarding sprint): set together by
  `POST /onboarding/accept-terms`. The `app/core/onboarding_gate.py` middleware
  returns 403 on any non-exempt endpoint while this is false (or while
  `onboarding_completed` is false).

---

## EXISTING TABLE — note_quizzes (partial — quiz_type added this sprint)

```sql
-- Original columns (ask David for full schema if needed)
-- Sprint addition:
ALTER TABLE note_quizzes
ADD COLUMN IF NOT EXISTS quiz_type text not null default 'objective'
  check (quiz_type in ('objective','theory'));
```

---

## EXISTING TABLE — subscriptions (partial — plan_type added this sprint)

```sql
-- Original columns (ask David for full schema if needed)
-- Sprint addition:
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS plan_type text
  check (plan_type in (
    'uni_monthly','uni_yearly',
    'secondary_individual_monthly','secondary_individual_yearly',
    'secondary_family_monthly','secondary_family_yearly',
    'pilot'
  ));
```

---

## EXISTING TABLE — user_events (partial)

```sql
-- session_id and note_id are nullable:
ALTER TABLE user_events ALTER COLUMN session_id DROP NOT NULL;
ALTER TABLE user_events ALTER COLUMN note_id DROP NOT NULL;
-- Ask David for full schema before querying other columns
```

---

## NEW TABLE — subscription_members

```sql
create table public.subscription_members (
  id uuid not null default gen_random_uuid(),
  subscription_id uuid not null references subscriptions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','member')),
  invited_by uuid references auth.users(id),
  invited_at timestamptz default now(),
  joined_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending','active','inactive','removed')),
  constraint subscription_members_pkey primary key (id),
  constraint subscription_members_subscription_user_key
    unique (subscription_id, user_id)
);
create index idx_subscription_members_subscription
  on subscription_members(subscription_id);
create index idx_subscription_members_user
  on subscription_members(user_id);
```

---

## NEW TABLE — subscription_invites

```sql
create table public.subscription_invites (
  id uuid not null default gen_random_uuid(),
  subscription_id uuid not null references subscriptions(id) on delete cascade,
  invited_email text not null,
  token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint subscription_invites_pkey primary key (id),
  constraint subscription_invites_subscription_email_key
    unique (subscription_id, invited_email)
);
create index idx_subscription_invites_email on subscription_invites(invited_email);
create index idx_subscription_invites_token on subscription_invites(token_hash);
```

---

## NEW TABLE — user_devices

```sql
create table public.user_devices (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_token text not null unique,
  fingerprint_hash text null,
  device_name text null,
  last_seen_at timestamptz not null default now(),
  registered_at timestamptz not null default now(),
  is_active boolean not null default true,
  constraint user_devices_pkey primary key (id)
);
create index idx_user_devices_user_id on user_devices(user_id);
create index idx_user_devices_token on user_devices(device_token);
create index idx_user_devices_user_active on user_devices(user_id, is_active);
```

---

## NEW TABLE — curriculum_subjects

```sql
create table public.curriculum_subjects (
  id uuid not null default gen_random_uuid(),
  subject_slug text not null unique,
  title text not null,
  class_level text not null check (class_level in ('SS1','SS2','SS3','university')),
  description text null,
  display_order int not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint curriculum_subjects_pkey primary key (id)
);
```

---

## NEW TABLE — curriculum_chapters

```sql
create table public.curriculum_chapters (
  id uuid not null default gen_random_uuid(),
  subject_id uuid not null references curriculum_subjects(id),
  chapter_id_slug text not null unique,
  chapter_number int not null,
  chapter_title text not null,
  learning_objectives text null,
  nerdc_performance_objective text null,
  chapter_misconceptions text null,
  is_free boolean not null default false,
  display_order int not null,
  status text not null default 'draft'
    check (status in ('draft','active','archived')),
  notes text null,
  created_at timestamptz not null default now(),
  constraint curriculum_chapters_pkey primary key (id)
);
create index idx_curriculum_chapters_subject on curriculum_chapters(subject_id);
```

---

## NEW TABLE — curriculum_sections

```sql
create table public.curriculum_sections (
  id uuid not null default gen_random_uuid(),
  chapter_id uuid not null references curriculum_chapters(id),
  section_label text not null,
  section_number int not null,
  display_order int not null,
  created_at timestamptz not null default now(),
  constraint curriculum_sections_pkey primary key (id)
);
create index idx_curriculum_sections_chapter on curriculum_sections(chapter_id);
```

---

## NEW TABLE — curriculum_subsections

```sql
create table public.curriculum_subsections (
  id uuid not null default gen_random_uuid(),
  subsection_id_slug text not null unique,
  section_id uuid not null references curriculum_sections(id),
  chapter_id uuid not null references curriculum_chapters(id),
  subsection_title text not null,
  subsection_type text not null check (subsection_type in (
    'definition_analogy','conceptual_illustration','worked_example',
    'misconception_address','mini_quiz','translation_to_math',
    'translation_to_english','end_of_chapter'
  )),
  display_order int not null,
  analogy_text text null,
  intuition_explanation text null,
  nigerian_real_world_context text null,
  key_definitions text null,
  chat_prompt_text text null,
  manim_prompts jsonb null,
  why_revelation text null,
  common_misconceptions text null,
  nerdc_content_knowledge text null,
  section_learning_goal text null,
  prerequisite_subsection_ids text null,
  min_exchange_count int not null default 1,
  unlock_depth_threshold text not null default 'procedural'
    check (unlock_depth_threshold in (
      'surface','procedural','conceptual','transferable'
    )),
  status text not null default 'draft'
    check (status in ('draft','active','archived')),
  notes text null,
  created_at timestamptz not null default now(),
  constraint curriculum_subsections_pkey primary key (id)
);
create index idx_curriculum_subsections_section
  on curriculum_subsections(section_id);
create index idx_curriculum_subsections_chapter
  on curriculum_subsections(chapter_id);
create index idx_curriculum_subsections_slug
  on curriculum_subsections(subsection_id_slug);
```

**manim_prompts JSONB format:**
```json
[{
  "index": 1,
  "prompt": "...",
  "position": "after_analogy",
  "approval_status": "pending",
  "storage_url": null,
  "render_attempts": 0,
  "last_rendered_at": null
}]
```
Position values: `after_analogy`, `after_intuition`, `after_context`, `after_definitions`
Approval values: `pending`, `rendered`, `approved`
Only serve visuals where `approval_status = 'approved'` to students.

---

## NEW TABLE — curriculum_problems

```sql
create table public.curriculum_problems (
  id uuid not null default gen_random_uuid(),
  question_id_slug text not null unique,
  chapter_id uuid not null references curriculum_chapters(id),
  subsection_id uuid null references curriculum_subsections(id),
  question_placement text not null check (question_placement in (
    'mini_quiz','end_of_chapter_problem',
    'translation_to_math','translation_to_english'
  )),
  question_type text not null check (question_type in (
    'conceptual','procedural','real_world'
  )),
  tutor_access boolean not null default false,
  difficulty text not null check (difficulty in (
    'foundational','standard','extended'
  )),
  question_text text not null,
  answer text not null,
  working text not null,
  marks int null,
  pattern_source text null,
  nigerian_context boolean not null default false,
  status text not null default 'draft'
    check (status in ('draft','active','archived')),
  notes text null,
  created_at timestamptz not null default now(),
  constraint curriculum_problems_pkey primary key (id)
);
create index idx_curriculum_problems_chapter on curriculum_problems(chapter_id);
create index idx_curriculum_problems_subsection
  on curriculum_problems(subsection_id);
```

---

## NEW TABLE — student_knowledge_state

```sql
create table public.student_knowledge_state (
  id uuid not null default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  subsection_id uuid not null references curriculum_subsections(id),
  completion_status text not null default 'locked'
    check (completion_status in ('locked','unlocked','in_progress','completed')),
  comprehension_depth text null
    check (comprehension_depth in (
      'surface','procedural','conceptual','transferable'
    )),
  attempt_count int not null default 0,
  last_session_at timestamptz null,
  knowledge_carryover jsonb null,
  engagement_pattern text null
    check (engagement_pattern in ('active','passive','reluctant')),
  expressed_interest text null,
  curiosity_signal int null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_knowledge_state_pkey primary key (id),
  constraint student_knowledge_state_student_subsection_key
    unique (student_id, subsection_id)
);
create index idx_student_knowledge_student on student_knowledge_state(student_id);
create index idx_student_knowledge_subsection
  on student_knowledge_state(subsection_id);
create index idx_student_knowledge_status
  on student_knowledge_state(student_id, completion_status);
```

---

## NEW TABLE — secondary_sessions

```sql
create table public.secondary_sessions (
  id uuid not null default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  subsection_id uuid not null references curriculum_subsections(id),
  session_type text not null default 'first_attempt'
    check (session_type in ('first_attempt','review')),
  status text not null default 'active'
    check (status in ('active','completed','abandoned')),
  exchange_count int not null default 0,
  comprehension_depth text null
    check (comprehension_depth in (
      'surface','procedural','conceptual','transferable'
    )),
  unlock_ready boolean not null default false,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  session_duration_seconds int null,
  created_at timestamptz not null default now(),
  constraint secondary_sessions_pkey primary key (id)
);
create index idx_secondary_sessions_student on secondary_sessions(student_id);
create index idx_secondary_sessions_subsection
  on secondary_sessions(subsection_id);
```

---

## NEW TABLE — secondary_conversations

```sql
create table public.secondary_conversations (
  id uuid not null default gen_random_uuid(),
  session_id uuid not null references secondary_sessions(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now(),
  constraint secondary_conversations_pkey primary key (id)
);
create index idx_secondary_conversations_session
  on secondary_conversations(session_id);
```

---

## NEW TABLE — section_learning_events

```sql
create table public.section_learning_events (
  id uuid not null default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references secondary_sessions(id),
  subsection_id uuid not null references curriculum_subsections(id),
  session_type text not null check (session_type in ('first_attempt','review')),
  exchange_count int not null,
  session_duration_seconds int null,
  comprehension_depth text null
    check (comprehension_depth in (
      'surface','procedural','conceptual','transferable'
    )),
  data_confidence text not null
    check (data_confidence in ('high','low','insufficient')),
  misconceptions_surfaced jsonb null,
  misconceptions_resolved jsonb null,
  breakthrough_moment boolean null,
  struggle_points jsonb null,
  prior_knowledge_gaps jsonb null,
  confidence_signal text null
    check (confidence_signal in ('high','medium','low')),
  engagement_pattern text null
    check (engagement_pattern in ('active','passive','reluctant')),
  readiness_for_next boolean null,
  created_at timestamptz not null default now(),
  constraint section_learning_events_pkey primary key (id)
);
create index idx_section_learning_events_student
  on section_learning_events(student_id);
create index idx_section_learning_events_subsection
  on section_learning_events(subsection_id);
create index idx_section_learning_events_created
  on section_learning_events(created_at);
```

---

## NEW TABLE — secondary_quiz_attempts

```sql
create table public.secondary_quiz_attempts (
  id uuid not null default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  problem_id uuid not null references curriculum_problems(id),
  session_id uuid null references secondary_sessions(id),
  attempt_number int not null default 1,
  submitted_answer text not null,
  result text null
    check (result in ('pass','partial','fail','seen_solution')),
  nano_feedback text null,
  seen_solution boolean not null default false,
  self_assessed boolean null,
  created_at timestamptz not null default now(),
  constraint secondary_quiz_attempts_pkey primary key (id)
);
create index idx_secondary_quiz_student on secondary_quiz_attempts(student_id);
create index idx_secondary_quiz_problem on secondary_quiz_attempts(problem_id);
create index idx_secondary_quiz_session on secondary_quiz_attempts(session_id);
```

---

## NEW TABLE — schools

```sql
create table public.schools (
  id uuid not null default gen_random_uuid(),
  school_name text not null,
  city text null,
  state text null,
  contact_name text null,
  contact_email text null,
  contact_phone text null,
  whatsapp_number text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint schools_pkey primary key (id)
);
```

---

## NEW TABLE — school_students

```sql
create table public.school_students (
  id uuid not null default gen_random_uuid(),
  school_id uuid not null references schools(id),
  student_id uuid not null references auth.users(id) on delete cascade,
  class_level text not null check (class_level in ('SS1','SS2','SS3')),
  enrolled_at timestamptz not null default now(),
  is_active boolean not null default true,
  constraint school_students_pkey primary key (id),
  constraint school_students_school_student_key unique (school_id, student_id)
);
create index idx_school_students_school on school_students(school_id);
create index idx_school_students_student on school_students(student_id);
```

---

## NEW TABLE — school_admin_links

```sql
create table public.school_admin_links (
  id uuid not null default gen_random_uuid(),
  school_id uuid not null references schools(id),
  admin_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint school_admin_links_pkey primary key (id),
  constraint school_admin_links_school_admin_key unique (school_id, admin_id)
);
create index idx_school_admin_links_admin on school_admin_links(admin_id);
```

---

## NEW TABLE — parents

```sql
create table public.parents (
  id uuid not null default gen_random_uuid(),
  full_name text not null,
  email text null,
  whatsapp_number text null,
  created_at timestamptz not null default now(),
  -- Onboarding sprint addition — links this row to the parent's own login,
  -- so the backend can upsert/find it by user_id instead of by email:
  user_id uuid null,
  constraint parents_pkey primary key (id)
);

-- David runs (not yet applied as of the onboarding build):
-- ALTER TABLE parents
-- ADD COLUMN IF NOT EXISTS user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;
```

**Key notes:**
- `whatsapp_number` should be encrypted the same way as `user_profiles.phone_number`
  (see above) — same `encrypt_phone`/`decrypt_phone` utility, same
  `PHONE_ENCRYPTION_KEY`. `schools.contact_phone`/`whatsapp_number` are the
  exception and stay plaintext (business contact info, not a person's PII).
- `email` is populated by the backend during parent onboarding (fetched via
  `supabase.auth.admin.get_user_by_id`), so `POST /profile/link-parent` can
  match a parent by email using a plain query against this table — no
  auth-admin get-by-email lookup needed.

---

## NEW TABLE — parent_students

```sql
create table public.parent_students (
  id uuid not null default gen_random_uuid(),
  parent_id uuid not null references parents(id),
  student_id uuid not null references auth.users(id) on delete cascade,
  consent_given boolean not null default false,
  linked_at timestamptz not null default now(),
  constraint parent_students_pkey primary key (id),
  constraint parent_students_parent_student_key unique (parent_id, student_id)
);
create index idx_parent_students_parent on parent_students(parent_id);
create index idx_parent_students_student on parent_students(student_id);
```

---

## NEW TABLE — pending_parent_links

```sql
create table public.pending_parent_links (
  id uuid not null default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  parent_email text not null,
  created_at timestamptz not null default now(),
  constraint pending_parent_links_pkey primary key (id),
  constraint pending_parent_links_student_email_key
    unique (student_id, parent_email)
);
```

---

## NEW TABLE — promo_codes

```sql
create table public.promo_codes (
  id uuid not null default gen_random_uuid(),
  code text not null unique,
  description text null,
  plan_type text not null default 'secondary_individual_monthly',
  access_days int not null,
  max_uses int null,
  uses_count int not null default 0,
  created_by uuid null references auth.users(id),
  expires_at timestamptz null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint promo_codes_pkey primary key (id)
);
create index idx_promo_codes_code on promo_codes(code);
```

---

## NEW TABLE — promo_redemptions

```sql
create table public.promo_redemptions (
  id uuid not null default gen_random_uuid(),
  code_id uuid not null references promo_codes(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  access_until timestamptz not null,
  constraint promo_redemptions_pkey primary key (id),
  constraint promo_redemptions_code_user_key unique (code_id, user_id)
);
create index idx_promo_redemptions_user on promo_redemptions(user_id);
```

---

## DB FUNCTIONS

### calculate_streak
```sql
CREATE OR REPLACE FUNCTION calculate_streak(
  p_user_id uuid,
  p_event_types text[],
  p_grace_days int DEFAULT 1
)
RETURNS TABLE(current_streak int, longest_streak int, last_active_date date)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  WITH activity_days AS (
    SELECT DISTINCT DATE(created_at) AS day
    FROM user_events
    WHERE user_id = p_user_id
      AND event_type = ANY(p_event_types)
  ),
  gaps AS (
    SELECT
      day,
      day - LAG(day) OVER (ORDER BY day DESC) AS gap
    FROM activity_days
  ),
  streaks AS (
    SELECT
      day,
      SUM(CASE WHEN gap > (1 + p_grace_days) THEN 1 ELSE 0 END)
        OVER (ORDER BY day DESC) AS streak_group
    FROM gaps
  )
  SELECT
    COUNT(*) FILTER (WHERE streak_group = 0)::int AS current_streak,
    MAX(COUNT(*)) OVER ()::int AS longest_streak,
    MAX(day) AS last_active_date
  FROM streaks
  GROUP BY streak_group
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION calculate_streak FROM PUBLIC;
GRANT EXECUTE ON FUNCTION calculate_streak TO authenticated;
```

**Call from Python:**
```python
await supabase.rpc("calculate_streak", {
    "p_user_id": user_id,
    "p_event_types": ["lesson_exchange", "note_chat_exchange"],
    "p_grace_days": 1
}).execute()
```

---

### get_usage_graph_secondary
```sql
CREATE OR REPLACE FUNCTION get_usage_graph_secondary(
  p_user_id uuid,
  p_days int DEFAULT 7
)
RETURNS TABLE(day date, minutes int)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    DATE(created_at) AS day,
    COALESCE(SUM(session_duration_seconds) / 60, 0)::int AS minutes
  FROM section_learning_events
  WHERE student_id = p_user_id
    AND created_at >= CURRENT_DATE - p_days
  GROUP BY DATE(created_at)
  ORDER BY day ASC;
$$;
REVOKE ALL ON FUNCTION get_usage_graph_secondary FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_usage_graph_secondary TO authenticated;
```

**Call from Python:**
```python
await supabase.rpc("get_usage_graph_secondary", {
    "p_user_id": user_id,
    "p_days": 7
}).execute()
```

---

### get_usage_graph_uni
```sql
CREATE OR REPLACE FUNCTION get_usage_graph_uni(
  p_user_id uuid,
  p_days int DEFAULT 7
)
RETURNS TABLE(day date, minutes int)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    DATE(created_at) AS day,
    COUNT(*)::int * 2 AS minutes
  FROM user_events
  WHERE user_id = p_user_id
    AND event_type IN ('lesson_exchange', 'note_chat_exchange')
    AND created_at >= CURRENT_DATE - p_days
  GROUP BY DATE(created_at)
  ORDER BY day ASC;
$$;
REVOKE ALL ON FUNCTION get_usage_graph_uni FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_usage_graph_uni TO authenticated;
```

**Call from Python:**
```python
await supabase.rpc("get_usage_graph_uni", {
    "p_user_id": user_id,
    "p_days": 7
}).execute()
```

**Usage graph routing rule:**
```python
if user_profile["user_type"] == "secondary":
    result = await supabase.rpc("get_usage_graph_secondary", {...})
else:
    result = await supabase.rpc("get_usage_graph_uni", {...})
```

---

### can_register_device
```sql
CREATE OR REPLACE FUNCTION can_register_device(p_user_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*) < 2
  FROM user_devices
  WHERE user_id = p_user_id AND is_active = true;
$$;
REVOKE ALL ON FUNCTION can_register_device FROM PUBLIC;
GRANT EXECUTE ON FUNCTION can_register_device TO authenticated;
```

---

### can_add_member
```sql
CREATE OR REPLACE FUNCTION can_add_member(p_subscription_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*) < 3
  FROM subscription_members
  WHERE subscription_id = p_subscription_id
    AND status IN ('active','pending');
$$;
REVOKE ALL ON FUNCTION can_add_member FROM PUBLIC;
GRANT EXECUTE ON FUNCTION can_add_member TO authenticated;
```

---

## RLS POLICIES

### user_devices
```sql
CREATE POLICY "users can read own devices"
  ON user_devices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users can insert own devices"
  ON user_devices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users can update own devices"
  ON user_devices FOR UPDATE USING (auth.uid() = user_id);
```

### subscription_members
```sql
CREATE POLICY "users can read own membership"
  ON subscription_members FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = invited_by);
CREATE POLICY "users can insert own membership"
  ON subscription_members FOR INSERT
  WITH CHECK (auth.uid() = invited_by);
CREATE POLICY "users can update own membership"
  ON subscription_members FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = invited_by);
```

### subscription_invites
```sql
CREATE POLICY "users can read own invites"
  ON subscription_invites FOR SELECT
  USING (auth.uid() = (
    SELECT invited_by FROM subscription_members
    WHERE subscription_id = subscription_invites.subscription_id
      AND role = 'owner' LIMIT 1
  ));
CREATE POLICY "users can insert own invites"
  ON subscription_invites FOR INSERT
  WITH CHECK (auth.uid() = (
    SELECT invited_by FROM subscription_members
    WHERE subscription_id = subscription_invites.subscription_id
      AND role = 'owner' LIMIT 1
  ));
CREATE POLICY "users can delete own invites"
  ON subscription_invites FOR DELETE
  USING (auth.uid() = (
    SELECT invited_by FROM subscription_members
    WHERE subscription_id = subscription_invites.subscription_id
      AND role = 'owner' LIMIT 1
  ));
```

### student_knowledge_state
```sql
CREATE POLICY "students can read own knowledge state"
  ON student_knowledge_state FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "students can insert own knowledge state"
  ON student_knowledge_state FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "students can update own knowledge state"
  ON student_knowledge_state FOR UPDATE USING (auth.uid() = student_id);
```

### secondary_sessions
```sql
CREATE POLICY "students can read own sessions"
  ON secondary_sessions FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "students can insert own sessions"
  ON secondary_sessions FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "students can update own sessions"
  ON secondary_sessions FOR UPDATE USING (auth.uid() = student_id);
```

### secondary_conversations
```sql
CREATE POLICY "students can read own conversations"
  ON secondary_conversations FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "students can insert own conversations"
  ON secondary_conversations FOR INSERT WITH CHECK (auth.uid() = student_id);
```

### section_learning_events
```sql
-- Read only for students. Backend writes via service role.
CREATE POLICY "students can read own learning events"
  ON section_learning_events FOR SELECT USING (auth.uid() = student_id);
```

### secondary_quiz_attempts
```sql
CREATE POLICY "students can read own quiz attempts"
  ON secondary_quiz_attempts FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "students can insert own quiz attempts"
  ON secondary_quiz_attempts FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "students can update own quiz attempts"
  ON secondary_quiz_attempts FOR UPDATE USING (auth.uid() = student_id);
```

### pending_parent_links
```sql
CREATE POLICY "students can read own pending links"
  ON pending_parent_links FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "students can insert own pending links"
  ON pending_parent_links FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "students can delete own pending links"
  ON pending_parent_links FOR DELETE USING (auth.uid() = student_id);
```

### promo_redemptions
```sql
-- Read only for users. Backend writes via service role.
CREATE POLICY "users can read own redemptions"
  ON promo_redemptions FOR SELECT USING (auth.uid() = user_id);
```

### curriculum tables (read-only for all authenticated users)
```sql
CREATE POLICY "authenticated users can read curriculum"
  ON curriculum_subjects FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated users can read chapters"
  ON curriculum_chapters FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated users can read sections"
  ON curriculum_sections FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated users can read subsections"
  ON curriculum_subsections FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated users can read problems"
  ON curriculum_problems FOR SELECT USING (auth.role() = 'authenticated');
```

---

## PAYMENT TIERS

```
Secondary Individual Monthly:  ₦5,000   plan_type = secondary_individual_monthly
Secondary Individual Yearly:   ₦40,000  plan_type = secondary_individual_yearly
Secondary Family Monthly:      ₦10,000  plan_type = secondary_family_monthly
Secondary Family Yearly:       ₦80,000  plan_type = secondary_family_yearly
University Monthly:            ₦15,000  plan_type = uni_monthly
University Yearly:             ₦120,000 plan_type = uni_yearly
Pilot (promo code):            Free     plan_type = pilot
```

Family plan = 1 owner + 2 members via subscription_members.
Secondary school only — uni side is 1 user per subscription.
Device limit: 2 devices per user regardless of plan.

---

## CONTENT ACCESS RULES

```
curriculum_chapters.is_free = true  → accessible to all authenticated users
curriculum_chapters.is_free = false → requires active subscription
                                      (owner OR active member)

Ch00 Mental Models: is_free = true (the only free chapter)
Ch01–Ch12: is_free = false
```

Check at endpoint level — never trust frontend routing alone.

---

## KEY RELATIONSHIPS TO REMEMBER

```
auth.users (Supabase managed)
  └── user_profiles (via user_id FK — always join on user_id = auth.uid())
  └── user_devices (via user_id)
  └── subscription_members (via user_id)
  └── student_knowledge_state (via student_id)
  └── secondary_sessions (via student_id)
  └── secondary_conversations (via student_id)
  └── section_learning_events (via student_id)
  └── secondary_quiz_attempts (via student_id)

subscriptions
  └── subscription_members (via subscription_id)
  └── subscription_invites (via subscription_id)

curriculum_subjects
  └── curriculum_chapters
      └── curriculum_sections
          └── curriculum_subsections
              └── curriculum_problems
              └── student_knowledge_state
              └── secondary_sessions
                  └── secondary_conversations
                  └── section_learning_events

schools
  └── school_students
  └── school_admin_links

parents
  └── parent_students
```

