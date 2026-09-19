# Feature 06 — Onboarding
## Techcess Secondary School Sprint — September 2026

---

## Scope
Full onboarding flows for secondary school students and university students.
Parent account onboarding. Invited member onboarding. Promo code system for
pilot schools. Incremental save — dropout recovery on re-login.

---

## Design Principle
Not a form. A conversation. Each screen is full viewport, single question,
cinematic GSAP transitions. The student should feel seen, not processed.
Copy is everything here — each screen's text is as important as its function.

---

## Secondary School Onboarding — 7 Screens

### Screen 1 — Name
```
"Before we start — what do you go by?"
[First name input]
```
Their name used on every subsequent screen.
Simple. Human. Sets the tone.

### Screen 2 — Date of Birth
```
"How old are you, [Name]?"
[DOB picker — minimal, clean]
```
Age calculated immediately. Motivational response fades in:
- 13–15: "You're starting earlier than most people ever do. That's rare."
- 16–17: "Right in the thick of it. This is exactly the right time."
- 18+:   "You came back to get it right. Respect."

### Screen 3 — Class Level
```
"What class are you in?"
[SS1]  [SS2]  [SS3]  — large tap targets, not dropdowns
```
Selecting triggers confirmation animation.
Sets user_profiles.secondary_class_level.

### Screen 4 — School
```
"Where do you go to school?"
[School name input — autocomplete from schools table]
"Don't worry if your school isn't listed — just type it in."
```
Fuzzy match suggestions appear as they type.
Unverified schools stored as free text.
When school later joins formally, retroactive matching done manually.

### Screen 5 — Life Goals
```
"What are you trying to do with your life, [Name]?"

[Engineer something that changes Nigeria]
[Become a doctor]
[Understand how the world actually works]
[Get into a great university]
[Make my family proud]
[Build something of my own]
[Other — I'll tell you myself]  →  free text field expands
```
Multi-select. Copy must sound like real aspirations, not survey options.
Stored as life_goals JSONB array on user_profiles.

### Screen 6 — Education Sentiment
```
"Real talk — is school actually worth it?"

[Yes, school prepares you for life]
[It depends on what you do with it]
[Honestly? It's mostly a waste of time]
[I don't know yet]
```
Below options: "Your answer is completely anonymous. We genuinely want to know."

After selection — one line response validates their choice:
- "Yes"     → "We agree — when it's done right."
- "Depends" → "That's the most honest answer."
- "Waste"   → "We built this because we think you're right about most of it."
- "Don't know" → "That's exactly why you're here."

This signals Techcess is on the student's side.
Stored as education_sentiment on user_profiles.

### Screen 7 — Paywall
```
"[Name], you're ready. Let's get you in."

[Individual  ₦5,000/month]    [Individual  ₦40,000/year  Save 33%]
[Family      ₦10,000/month]   [Family      ₦80,000/year  Save 33%]

"Have a school code?" → [Enter code]
  Valid code → screen transforms: "You're covered. Let's go." → dashboard

"Start with the free chapter first →"
  → Bypasses payment → Ch00 Mental Models
  → Paywall shown again when student attempts to access Ch01
```

Invited member handling:
Backend checks subscription_members.status before rendering paywall.
If active member: paywall replaced with:
"You're all set — [Owner name] has got you covered." [Let's go →]

---

## University Student Onboarding — 6 Screens

### Screen 1 — Name
Same as secondary.

### Screen 2 — Date of Birth
Same DOB picker + age range response:
- 18–20: "Right at the beginning. Everything is still possible."
- 21–23: "Deep in it now. This is where it gets real."
- 24–27: "You're doing this alongside everything else. Respect."
- 28+:   "You came back for it. That takes something most people don't have."

### Screen 3 — Institution + Course
```
"Where are you studying and what are you reading?"
[University/Institution — autocomplete]
[Course of study — free text or STEM dropdown]
```
Stored on user_profiles: institution_name, course_of_study.

### Screen 4 — Current Struggle
```
"What's giving you the most trouble right now?"

[Calculus]  [Linear Algebra]  [Physics]  [Statistics]
[Programming]  [Thermodynamics]  [Something else]
```
Multi-select. Primes note tutor and course recommendations.
Stored as initial_struggle_topics JSONB array on user_profiles.

### Screen 5 — Education Sentiment
Identical to secondary school Screen 6.
Same copy, same response logic.

### Screen 6 — Dashboard
No paywall. Uni students land on dashboard with 10 free credits.
Upgrade prompt appears when credits run low (existing flow).

---

## Parent Onboarding

Parent creates account — email/password, role = 'parent' set at signup.
Onboarding for parents is minimal — 2 screens:

### Screen 1 — Name
"What should we call you?"
[Full name]

### Screen 2 — Dashboard
"You're set up. Once your child links you, you'll see their progress here."
[Go to dashboard]

Parent dashboard shows empty state with instructions until a student links them.
No class level, no goals, no paywall.

---

## Student → Parent Linking (post-onboarding)

Student goes to profile settings → "Add a parent or guardian":
```
POST /profile/link-parent {parent_email}

Backend:
  Does user_profiles row exist with this email AND role = parent?
  YES → create parent_students row immediately
        send notification email (Resend: parent_linked template):
        "[Child name] has linked you as their parent on Techcess"
  NO  → create pending_parent_links row
        send invite email (Resend: parent_invite template):
        "[Child name] wants to share their progress with you.
         Create your free parent account to view their dashboard."
        → Parent clicks → creates account → role = parent set at signup
        → Post-signup: check pending_parent_links for email match
        → Resolve: create parent_students row, delete pending row
```

Parent account is free. Role = parent locks them out of student
features and routes them to parent dashboard only.

For pilot schools: student-initiated linking is default.
Bulk school-admin linking is a future feature.

---

## School Name Handling

Student types school name during onboarding (Screen 4).
Backend fuzzy-matches against schools table.
Suggestions appear as autocomplete.
If no match: stored as free text on user_profiles.school_name.
No schools row created automatically — unverified entries stay on user_profiles.
When school formally joins: manual match by Techcess team,
school_students rows created, schools table populated.

---

## Promo Code System

Designed for pilot schools. Reusable for any future free-access grant.

### How it works
```
You generate code in admin panel → give to school contact
School shares with students via WhatsApp/notice board
Student hits paywall (Screen 7) → "Have a school code?" → enters code
POST /onboarding/promo {code}
  → validate: code exists, is_active, not expired, uses_count < max_uses
  → create promo_redemptions row
  → increment promo_codes.uses_count
  → create subscription with plan_type = 'pilot',
    access_until = now() + access_days
  → Paywall screen transforms: "You're covered. Let's go."
  → Student proceeds to dashboard as paid user
When pilot ends:
  → access_until reached → student hits normal paywall on next login
  → Standard conversion moment
```

### promo_codes table
```sql
CREATE TABLE promo_codes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text NOT NULL UNIQUE,
  description  text,
  plan_type    text NOT NULL DEFAULT 'secondary_individual_monthly',
  access_days  int NOT NULL,
  max_uses     int,                    -- null = unlimited
  uses_count   int NOT NULL DEFAULT 0,
  created_by   uuid REFERENCES auth.users(id),
  expires_at   timestamptz,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_promo_codes_code ON promo_codes(code);
```

### promo_redemptions table
```sql
CREATE TABLE promo_redemptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id      uuid NOT NULL REFERENCES promo_codes(id),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_at  timestamptz NOT NULL DEFAULT now(),
  access_until timestamptz NOT NULL,
  UNIQUE(code_id, user_id)
);
CREATE INDEX idx_promo_redemptions_user ON promo_redemptions(user_id);
```

---

## DB Additions (user_profiles)

```sql
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS display_name text,
ADD COLUMN IF NOT EXISTS date_of_birth date,
ADD COLUMN IF NOT EXISTS secondary_class_level text
  CHECK (secondary_class_level IN ('SS1','SS2','SS3')),
ADD COLUMN IF NOT EXISTS school_name text,
ADD COLUMN IF NOT EXISTS institution_name text,
ADD COLUMN IF NOT EXISTS course_of_study text,
ADD COLUMN IF NOT EXISTS life_goals jsonb,
ADD COLUMN IF NOT EXISTS education_sentiment text,
ADD COLUMN IF NOT EXISTS initial_struggle_topics jsonb,
ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_step int NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS user_type text NOT NULL DEFAULT 'university'
  CHECK (user_type IN ('university','secondary','parent')),
ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'student'
  CHECK (role IN ('student','parent','school_admin','admin'));
```

---

## Incremental Save

Each screen posts its data immediately on completion.
onboarding_step incremented per screen.
If student drops off mid-onboarding:
  Next login → detect onboarding_completed = false
  → Resume from onboarding_step + 1
  → Never start over

---

## Endpoints

```
POST /onboarding/secondary          — save secondary onboarding data (per screen)
POST /onboarding/university         — save uni onboarding data (per screen)
POST /onboarding/promo              — validate and redeem promo code
POST /profile/link-parent           — student links parent email
POST /admin/promo/create            — admin generates promo code
GET  /admin/promo/list              — list all codes with usage stats
PATCH /admin/promo/{id}/toggle      — activate/deactivate code
```

---

## Rate Limiting
```
POST /onboarding/*:          20/minute per user
POST /onboarding/promo:      5/minute per user  (prevent brute force)
POST /profile/link-parent:   5/minute per user
POST /admin/promo/*:         10/minute per user
```

---

## Resend Templates (this feature)
```
parent_linked       — notifies parent they've been linked by student
parent_invite       — invites unregistered email to create parent account
pilot_access_granted— confirms promo code redemption (optional, nice touch)
```

---

## user_events Logging
```
onboarding_started
onboarding_screen_completed    — with screen_number and user_type tags
onboarding_completed
onboarding_dropped             — session ended before completion (detected on resume)
promo_code_redeemed
promo_code_invalid
promo_code_expired
parent_link_initiated
parent_link_completed
parent_invite_sent
```

---

## model_usage Logging
No model calls in onboarding. No entries needed.

---

## Open Questions — Resolved

| Question | Decision |
|----------|----------|
| Onboarding feel | Cinematic, conversational — not a form |
| Screen count secondary | 7 (name, DOB, class, school, goals, sentiment, paywall) |
| Screen count uni | 6 (name, DOB, institution+course, struggle, sentiment, dashboard) |
| Screen count parent | 2 (name, dashboard) |
| Age range responses | Motivational one-liners per age bracket, both user types |
| Subject selection in onboarding | Not needed — subjects always visible by class level |
| Goals options | 6 curated + Other free text, multi-select |
| Education sentiment | Anonymous, validated with empathetic one-liner response |
| Paywall skip | "Start with free chapter first" → Ch00 → paywall on Ch01 attempt |
| Invited member paywall | Detected and replaced with membership confirmation screen |
| Pilot school access | Promo code system — school gets code, shares with students |
| Parent linking | Student-initiated via profile settings, post-onboarding |
| Bulk parent linking | Future feature — not built this sprint |
| School name | Autocomplete from schools table, free text fallback |
| Incremental save | Yes — onboarding_step on user_profiles, resume on re-login |
| Uni paywall in onboarding | No — existing credit system handles upgrade |

