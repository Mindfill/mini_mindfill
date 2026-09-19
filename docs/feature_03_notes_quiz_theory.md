# Feature 03 — Notes Quiz Theory Generation
## Techcess Secondary School Sprint — September 2026

---

## Scope
Uni side only. Upgrade the existing notes quiz system to support theory-based
question generation as an alternative to objective questions. No new tables
beyond one field addition. No new endpoints beyond parameter additions.

---

## Problem Being Solved
Quiz generation currently defaults to objective-style questions (MCQ, true/false)
with no student control over question type. For maths content especially,
theory questions are more pedagogically valuable. Students need to know what
they're asking for before generating.

---

## Two Quiz Types

### Objective (existing behaviour, unchanged)
- Multiple choice, true/false, fill in the blank
- Single correct answer
- Auto-graded via string match on submit
- Default type — existing students unaffected

### Theory (new)
- Short answer requiring explanation, derivation, or justification
- "Explain why...", "Derive...", "Describe what happens when..."
- Evaluated by Haiku against a rubric of key points
- Returns pass / partial / fail + one sentence feedback
- Cannot be auto-graded — requires model evaluation call

---

## DB Change

### note_quizzes — one field addition
```sql
ALTER TABLE note_quizzes
ADD COLUMN quiz_type text NOT NULL DEFAULT 'objective'
  CHECK (quiz_type IN ('objective', 'theory'));
```

Existing rows default to 'objective' — no data migration needed.

### Question object structure in questions JSONB

Objective question:
```json
{
  "question_id": "q1",
  "question": "...",
  "type": "objective",
  "options": ["A", "B", "C", "D"],
  "correct_answer": "B",
  "explanation": "..."
}
```

Theory question:
```json
{
  "question_id": "q1",
  "question": "...",
  "type": "theory",
  "model_answer": "...",
  "key_points": ["point 1", "point 2", "point 3"],
  "marks": 5
}
```

key_points: rubric for Haiku evaluator — non-negotiable elements of correct answer.
model_answer: shown to student after evaluation.
marks: optional weighting for future scoring features.

---

## Endpoint Changes

### POST /notes/{note_id}/quiz
Add optional parameter: quiz_type (default: 'objective')

Request body addition:
```json
{
  "selected_sections": [...],
  "quiz_type": "theory"
}
```

Behaviour:
- quiz_type passed to generation system prompt (see below)
- quiz_type stored on note_quizzes row
- All other behaviour unchanged

### POST /notes/{note_id}/quiz/submit
Upgraded evaluation logic per question type:

```
For each answer in submission:
  
  If question.type = 'objective':
    → existing string match against correct_answer
    → returns: {correct: true|false}
    
  If question.type = 'theory':
    → Haiku evaluation call
    → Input: student_answer + question_text + key_points (rubric)
    → System prompt: evaluate this answer against the key points,
                     return pass/partial/fail and one sentence of feedback
    → Output: {result: 'pass'|'partial'|'fail', feedback: "..."}
    → Stored on note_question_attempts
```

Rate limiting: 10 submissions per minute per user (prevents Haiku evaluation spam).

---

## System Prompt Modification

Existing quiz generation prompt gets a quiz_type-aware conditional block.
Not a replacement — an addition. One prompt file, two branches.

Theory branch injection:
```
Generate theory-based questions that require explanation and reasoning.
Each question must:
- Ask the student to explain, derive, describe, or justify
- Have a model_answer showing the complete expected response  
- Have 3-5 key_points that are the non-negotiable elements of a correct answer
- Be answerable from the selected note sections only
- For maths content: prioritise "explain why this works" and
  "describe what changes if..." over procedural steps
- Never generate MCQ or true/false questions
Return questions in the theory question JSON format.
```

---

## Frontend Change

Toggle added to quiz generation UI above section selector:

```
[● Objective   ○ Theory]
```

- Default: Objective (existing behaviour preserved)
- Toggle state sent as quiz_type in generation request
- Student picks type first, then selects sections, then generates
- Theory questions display a text input on submit instead of option buttons
- After theory submission: show model_answer + key_points alongside feedback

---

## Submit Response Structure (theory)

```json
{
  "question_id": "q1",
  "result": "partial",
  "feedback": "You identified the base conversion correctly but missed
               explaining why the remainder sequence reverses.",
  "model_answer": "...",
  "key_points": ["point 1", "point 2", "point 3"],
  "points_addressed": ["point 1"],
  "points_missed": ["point 2", "point 3"]
}
```

points_addressed and points_missed: gives student specific signal on
what they got and what they missed, not just a pass/fail verdict.

---

## model_usage Logging

```
theory_quiz_generation   — existing model, per generation call
theory_quiz_evaluation   — Haiku, per theory question submitted
```

## user_events Logging

```
quiz_generated_objective   — existing event, unchanged
quiz_generated_theory      — new event
quiz_submitted_objective   — existing
quiz_submitted_theory      — new
theory_answer_passed
theory_answer_partial
theory_answer_failed
```

---

## What Is NOT Changing

- note_quizzes table structure beyond quiz_type field
- note_question_attempts table — no changes
- note_flashcards and flashcard generation — untouched
- POST /quiz/explain — untouched (courses side, not notes)
- All course-side quiz endpoints — untouched
- GET /quiz/{note_id} — untouched
- Objective quiz generation behaviour — unchanged
- Flashcard generation — untouched

---

## Forward Note — Uni Dashboard

Theory quiz evaluation results (pass/partial/fail + key_points_missed) are
richer knowledge signals than objective true/false. When the uni student
knowledge profile and dashboard are designed, these evaluation results
feed into topic-level weakness identification.
key_points_missed aggregated across attempts on the same note sections
surfaces specific conceptual gaps — not just "got it wrong" but "consistently
misses the reversal step in base conversion."
Carry this forward to Feature 05 (Dashboard).

---

## Open Questions — Resolved

| Question | Decision |
|----------|----------|
| New endpoint needed | No — parameter addition to existing endpoints |
| New table needed | No — one field addition to note_quizzes |
| Default quiz type | Objective — existing behaviour unchanged |
| Theory evaluation model | Haiku |
| Grading granularity | pass / partial / fail + key_points_missed |
| Courses quiz system | Untouched — this feature is notes only |

