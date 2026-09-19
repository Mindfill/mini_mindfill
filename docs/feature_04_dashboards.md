# Feature 04 — Dashboards
## Techcess Secondary School Sprint — September 2026

---

## Scope
Four dashboard types: uni student, secondary student, parent, school admin.
All built with multiple targeted DB queries assembled in Python — no monolithic RPCs.
Existing get_dashboard RPC and endpoint replaced with expanded multi-query version.

---

## user_profiles additions

```sql
-- Expand role field to cover all user types
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'student'
  CHECK (role IN ('student', 'parent', 'school_admin', 'admin'));

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS secondary_class_level text
  CHECK (secondary_class_level IN ('SS1', 'SS2', 'SS3'));

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS user_type text NOT NULL DEFAULT 'university'
  CHECK (user_type IN ('university', 'secondary'));

-- Parent linking: student adds parent email in profile settings
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS parent_email text;
```

Parent linking flow:
- Student adds parent email in their profile settings
- POST /profile/link-parent {parent_email}
- Backend checks if parent_email matches an existing user_profiles row
  with role = 'parent'
- If yes: create parent_students row immediately
- If no: create pending_parent_links row, send invite email via Resend
  (parent_invite template) — parent creates account, role = 'parent',
  link resolves on account creation

---

## Data Time Ranges

Graph display: past 7 days (daily data points)
Highlights/comparisons: current 7 days vs previous 7 days (percentage change)
Streak calculations: full history
Weakness identification: past 3 months
All queries parameterized — never hardcoded date strings

---

## Usage Graph Pattern (all dashboard types)

Highlight numbers above graph:
```
↑ 23% more study time than last week    ↓ 2 sessions fewer than last week
[7-day bar graph — Y axis: minutes, X axis: day labels]
```

- Absolute data in graph
- Percentage comparison as scannable highlights above
- No toggle needed — comparison always present as context
- Same pattern applied to all four dashboard types
- Data source differs per dashboard type (see below)

---

## Dashboard 1 — University Student

### Endpoint
GET /dashboard
Replaces existing endpoint. Same route, expanded response.
Multi-query assembly in Python.

### Queries (assembled in parallel where possible)

**Continue learning:**
- Last active lesson session from chat_sessions
- Returns: session_id, lesson_slug, lesson_title, last_activity_at
- Unchanged from existing

**Recent sessions:**
- Last 5 lesson sessions from chat_sessions
- Unchanged from existing

**Recent notes:**
- Last 5 notes from notes ordered by updated_at
- Unchanged from existing

**Progress summary:**
- lessons_completed, lessons_in_progress from lesson_progress
- Unchanged from existing

**Next recommended:**
- First lesson not yet started, ordered by lesson sequence
- Unchanged from existing

**Streak (upgraded):**
- Query user_events for days with qualifying activity
  (lesson_exchange, note_chat_exchange, quiz_submitted)
- Calculate current streak and longest streak
- Grace day: one missed day does not break streak
- Return: current_streak (int), longest_streak (int), last_active_date

**Usage graph:**
- Query user_events grouped by date, past 7 days
  Event types counted: lesson_exchange, note_chat_exchange
  Approximation: each exchange = average session duration estimate
- Alternatively query session duration if stored — use whichever is available
- Return: [{date, minutes}] × 7 days
- Highlights: sum current 7 days vs previous 7 days → percentage change

**Recent notes activity:**
- Last 5 notes with last chat activity timestamp
- Existing recent_notes field expanded with last_chat_at

**Keyword highlighting (frontend only — no backend endpoint):**
- Notes chat UI scans AI response text for terms matching
  key_definitions from the relevant note_sections rows
- Wraps matched terms in highlight component
- Shows definition on hover
- Purely client-side — no backend call
- Implementation: after receiving SSE stream completion,
  fetch note section key_definitions once per note session,
  cache client-side for that session, apply highlighting pass

### Response model (expanded)
```python
class StreakData(BaseModel):
    current_streak: int
    longest_streak: int
    last_active_date: Optional[str]

class UsageDay(BaseModel):
    date: str
    minutes: int

class UsageGraph(BaseModel):
    days: List[UsageDay]
    change_percent: float      # vs previous 7 days
    change_direction: str      # 'up' | 'down' | 'same'
    sessions_this_week: int
    sessions_change_percent: float

class DashboardResponse(BaseModel):
    continue_learning: Optional[ContinueLearning]
    recent_sessions: List[RecentSession]
    progress: ProgressSummary
    next_recommended: Optional[NextRecommended]
    recent_notes: List[RecentNote]
    streak: StreakData
    usage_graph: UsageGraph
```

### Knowledge profile (Phase 2 — not built in this sprint)
Infrastructure design documented for future implementation:
- uni_knowledge_events table: one row per completed session
- Populated by lightweight Haiku background call on session completion
- Fields: topic, comprehension_signal (understood/struggled), key_gap
- Dashboard reads from table — no model call at load time
- Cost: ~$0.0005 per session completion, zero at dashboard load
- Not built now. Flag in CLAUDE.md as planned future feature.

---

## Dashboard 2 — Secondary Student

### Endpoint
GET /secondary/dashboard
New endpoint. Multi-query assembly.

### Queries

**Continue learning:**
- Last incomplete subsection from student_knowledge_state
  WHERE completion_status IN ('unlocked', 'in_progress')
  ORDER BY updated_at DESC
- Returns: subsection_id, subsection_title, chapter_title, section_label

**Chapter progress:**
- Per chapter: count completed subsections / total subsections
- Returns progress percentage per chapter for subject overview rings

**Streak:**
- Same logic as uni — query section_learning_events by date
- current_streak, longest_streak, grace day applied
- GSAP animation on streak increment (frontend)

**Usage graph:**
- Query section_learning_events.session_duration_seconds grouped by date
- Past 7 days, summed to minutes per day
- Highlights: current 7 days vs previous 7 days percentage change

**Strengths and weaknesses:**
- Query section_learning_events grouped by chapter_id
  past 3 months, WHERE data_confidence != 'insufficient'
- Strengths: chapters with highest average comprehension_depth score
  (surface=1, procedural=2, conceptual=3, transferable=4)
- Weaknesses: chapters with lowest scores +
  highest frequency of struggle_points entries
- Most pressing: low score chapters that are prerequisites
  for student's current/next chapter
- Return: top 2 strengths, top 3 weaknesses with topic names only
  (no scores shown to student — just names)

**Session count highlights:**
- Sessions this week vs last week
- Subsections completed this week vs last week

**Where they left off:**
- Exact subsection, deep link
- Progress within current chapter (X of Y subsections)

**Additional highlights:**
- Time since last session (if > 2 days: show as nudge)
- Estimated subsections remaining in current chapter
- Recently completed chapters (last 2)
- Next chapter preview (title + first subsection title)

### Response model
```python
class SubsectionProgress(BaseModel):
    subsection_id: str
    subsection_title: str
    chapter_title: str
    section_label: str

class ChapterRing(BaseModel):
    chapter_id: str
    chapter_title: str
    percent_complete: float
    is_complete: bool

class StrengthWeakness(BaseModel):
    chapter_title: str
    signal: str  # 'strength' | 'weakness'

class SecondaryDashboardResponse(BaseModel):
    continue_learning: Optional[SubsectionProgress]
    chapter_rings: List[ChapterRing]
    streak: StreakData
    usage_graph: UsageGraph
    strengths: List[StrengthWeakness]
    weaknesses: List[StrengthWeakness]
    sessions_this_week: int
    sessions_change_percent: float
    days_since_last_session: Optional[int]
    recently_completed_chapters: List[str]
    next_chapter_preview: Optional[str]
```

---

## Dashboard 3 — Parent

### Parent account setup
- Parent creates Techcess account — email/password auth
- role = 'parent' set on user_profiles at signup
  (onboarding asks: "Are you a student or a parent?")
- Student adds parent email in profile settings
- Link resolves immediately if parent account exists,
  or via invite email if not

### Endpoint
GET /parent/dashboard
Protected — requires auth + role = 'parent'
Returns data for ALL linked students (parent may have multiple children)

### What parents see per student
- Student name and class level
- Current streak
- Study time this week (minutes) vs last week (% change)
- Current chapter and progress through it
- Top 2 weaknesses by topic name
- Last active date
- Sessions this week

### Response model
```python
class StudentSummary(BaseModel):
    student_id: str
    student_name: str
    class_level: str
    current_streak: int
    study_minutes_this_week: int
    study_minutes_change_percent: float
    current_chapter: str
    chapter_progress_percent: float
    top_weaknesses: List[str]
    last_active_date: Optional[str]
    sessions_this_week: int

class ParentDashboardResponse(BaseModel):
    students: List[StudentSummary]
    generated_at: str
```

### WhatsApp nudge (Termii)
- Weekly cron job (APScheduler — already running)
- Queries parent_students → section_learning_events per student
- Fills Termii WhatsApp template
- Fires one message per parent with summary of all linked students
- Message links parent to /parent/dashboard to see full detail
- For pilot (1-2 schools): WhatsApp Business app manually with broadcast lists
- Automate via Termii API when approaching 3+ schools

### Resend template
- weekly_parent_report — summary of student activity
- parent_invite — invite to create account when student links them

---

## Dashboard 4 — School Admin

### School admin account setup
- School admin created manually by Techcess team (not self-signup)
- role = 'school_admin' set on user_profiles
- Linked to schools table via school_admin_links (new table below)
- Can see data for all students in their school only

### New table: school_admin_links
```sql
CREATE TABLE school_admin_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid NOT NULL REFERENCES schools(id),
  admin_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(school_id, admin_id)
);
CREATE INDEX idx_school_admin_links_admin ON school_admin_links(admin_id);
```

### New table: pending_parent_links
```sql
CREATE TABLE pending_parent_links (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_email   text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, parent_email)
);
```

### Endpoint
GET /school/dashboard
Protected — requires auth + role = 'school_admin'
Only returns data for students in admin's linked school

### What school admin sees

**School overview:**
- Total enrolled students
- Active students this week (at least one session)
- Average study time per student this week
- School-wide streak average
- % students who completed at least one chapter

**Per student summary (table view):**
- Student name, class level
- Sessions this week
- Current chapter
- Last active date
- Simple status: Active / Inactive (no session in 7+ days) / At Risk
  (no session in 14+ days OR stuck at surface comprehension 2+ weeks)

**Weak topics across school:**
- Aggregate struggle_points from section_learning_events
  across all school students past 3 months
- Top 3 most common weak topics school-wide
- Useful for school admin to flag to teachers

**Monthly summary report:**
- GET /school/report/monthly
- Aggregated data for the past month
- Sent via WhatsApp/email to school contact monthly (Termii/Resend)
- Same data as dashboard but formatted as a report

### Response model
```python
class SchoolOverview(BaseModel):
    total_students: int
    active_this_week: int
    avg_study_minutes_this_week: float
    avg_streak: float
    chapters_completed_percent: float

class StudentRow(BaseModel):
    student_id: str
    student_name: str
    class_level: str
    sessions_this_week: int
    current_chapter: str
    last_active_date: Optional[str]
    status: str  # 'active' | 'inactive' | 'at_risk'

class WeakTopic(BaseModel):
    chapter_title: str
    struggle_count: int

class SchoolDashboardResponse(BaseModel):
    school_name: str
    overview: SchoolOverview
    students: List[StudentRow]
    weak_topics: List[WeakTopic]
    generated_at: str
```

---

## New Endpoints (this feature)

```
GET  /dashboard                    — uni student (expanded, replaces existing)
GET  /secondary/dashboard          — secondary student (new)
GET  /parent/dashboard             — parent (new, requires role=parent)
POST /profile/link-parent          — student links parent email
GET  /school/dashboard             — school admin (new, requires role=school_admin)
GET  /school/report/monthly        — monthly school report
```

---

## DB Functions (parameterized — no hardcoded dates)

All dashboard queries wrapped in DB functions or executed as
parameterized queries in Python. Examples:

```sql
-- Streak calculation
CREATE OR REPLACE FUNCTION calculate_streak(
  p_user_id uuid,
  p_event_types text[],
  p_grace_days int DEFAULT 1
)
RETURNS TABLE(current_streak int, longest_streak int, last_active_date date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$...$$;

REVOKE ALL ON FUNCTION calculate_streak FROM PUBLIC;
GRANT EXECUTE ON FUNCTION calculate_streak TO authenticated;

-- Usage graph
CREATE OR REPLACE FUNCTION get_usage_graph(
  p_user_id uuid,
  p_days int DEFAULT 7,
  p_event_table text DEFAULT 'user_events'
)
RETURNS TABLE(day date, minutes int)
...
```

All RPCs follow SECURITY DEFINER + search_path + REVOKE/GRANT pattern
to keep Supabase security advisor clean.

---

## Rate Limiting

```
GET /dashboard:              60 requests/minute per user
GET /secondary/dashboard:    60 requests/minute per user
GET /parent/dashboard:       30 requests/minute per user
GET /school/dashboard:       30 requests/minute per user
GET /school/report/monthly:  10 requests/minute per user
POST /profile/link-parent:   5 requests/minute per user
```

---

## user_events Logging (this feature)

```
parent_linked
parent_invite_sent
parent_invite_accepted
school_report_viewed
dashboard_viewed        -- all dashboard types, with user_type tag
```

---

## model_usage Logging

No model calls in dashboard endpoints.
Knowledge profile (Phase 2) will add haiku_knowledge_extraction entries
when implemented.

---

## Resend Templates (this feature)

```
parent_invite              — invite parent to create account
weekly_parent_report       — weekly student summary to parent
monthly_school_report      — monthly summary to school admin contact
```

---

## Open Questions — Resolved

| Question | Decision |
|----------|----------|
| Dashboard query pattern | Multiple targeted queries in Python, not RPC |
| Existing get_dashboard RPC | Replaced by multi-query endpoint |
| Usage graph display | 7-day absolute + percentage highlights vs previous 7 days |
| How far back | 7 days graph, 3 months for weakness/strength analysis |
| Parent auth | Own Techcess account, role = parent |
| Parent linking | Student adds parent email in profile settings |
| Parent signed token | Rejected — account is more personal and secure |
| School admin creation | Manual by Techcess team, not self-signup |
| User type field | user_type on user_profiles (university / secondary) |
| Role field | role on user_profiles (student/parent/school_admin/admin) |
| Knowledge profile (uni) | Phase 2 — infrastructure documented, not built this sprint |
| Keyword highlighting | Frontend only — no backend endpoint |

