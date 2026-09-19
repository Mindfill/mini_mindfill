# Feature 05 — Keyword Highlighting in Note Chats
## Techcess Secondary School Sprint — September 2026

---

## Scope
Frontend only. No new backend endpoints. No new DB tables.
Uni side — notes chat interface.
Highlights key terms from the note's lesson plan key_definitions
in AI tutor responses. Student hovers or taps a highlighted term
to see its definition inline.

---

## Data Source

note_lesson_plans table has a key_definitions section populated
during note onboarding. Already returned in the lesson plan payload
that the frontend fetches at session start. No additional endpoint needed.

Claude Code should extract key_definitions from the note_lesson_plans
response at the start of every note chat session and cache it
client-side for that session duration.

Structure expected from note_lesson_plans.key_definitions:
Array of objects or pipe-separated strings — Claude Code to confirm
exact structure from existing codebase before implementing.

Target structure for client-side cache:
```javascript
const keyDefinitions = [
  { term: "derivative", definition: "The rate of change of a function at a point" },
  { term: "limit", definition: "The value a function approaches as input approaches a value" },
  ...
]
```

---

## How It Works

### On session start
```javascript
// Fetch lesson plan (already happening)
const lessonPlan = await fetchLessonPlan(noteId);

// Extract and normalize key definitions
const keyDefs = extractKeyDefinitions(lessonPlan.key_definitions);

// Build lookup map for O(1) term matching
const defMap = new Map(keyDefs.map(d => [d.term.toLowerCase(), d.definition]));
```

### After each AI response streams in
```javascript
// Run highlighting pass on completed AI message
function applyHighlights(messageText, defMap) {
  // Sort terms by length descending — match longer terms first
  // prevents "derivative" matching inside "partial derivative"
  const terms = [...defMap.keys()].sort((a,b) => b.length - a.length);
  
  let result = messageText;
  for (const term of terms) {
    const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, 'gi');
    result = result.replace(regex, (match) =>
      `<mark class="key-term" data-term="${term.toLowerCase()}">${match}</mark>`
    );
  }
  return result;
}
```

Applied after full stream completion — never during streaming.
Streaming renders raw text. Highlight pass runs once on the
completed message before it settles into the chat history.

---

## UI Behaviour

### Desktop (hover)
- Highlighted term: subtle yellow/amber underline (not full background fill —
  too aggressive visually)
- On hover: tooltip appears above the term with the definition
- Tooltip: clean card, term in bold, definition below, 200ms fade-in
- Tooltip dismisses on mouse leave

### Mobile (tap)
- Highlighted term: same subtle underline
- On tap: inline definition expands below the highlighted word
  (not a tooltip — tooltips are unusable on mobile)
- Tap again: collapses
- Or: bottom sheet slides up with term + definition
  (bottom sheet preferred for longer definitions)

### Styling
```css
.key-term {
  background: transparent;
  border-bottom: 2px solid var(--color-amber-400);
  cursor: help;
  font-weight: inherit;
  padding: 0;
}

.key-term:hover {
  background: var(--color-amber-50);
  border-radius: 2px;
}
```

Matches Techcess design system — amber accent, no aggressive styling,
feels like a textbook highlighting rather than a UI widget.

---

## Edge Cases

**Term appears multiple times in one message:**
All instances highlighted. Same behaviour on hover/tap for each.

**Term appears in a code block or LaTeX expression:**
Skip highlighting inside backtick blocks, <code> tags, and
KaTeX rendered expressions. Regex must exclude these zones
before running the term matching pass.

**Term is a substring of a longer word:**
Word boundary matching (\b) prevents "set" matching inside "setting".
Longer terms matched first prevents partial overlap issues.

**Lesson plan has no key_definitions:**
Highlighting simply does not run. No error, no fallback needed.
Chat works exactly as before.

**Student re-opens a previous note session:**
key_definitions fetched fresh from lesson plan on each session init.
No stale cache issues.

**Term definition is very long:**
Truncate tooltip at 120 characters with "..." — full definition
available in a dedicated glossary view (future feature, not built now).

---

## What Is Not Changing

- No backend endpoints added or modified
- No DB schema changes
- No changes to the streaming logic
- No changes to note_lesson_plans structure
- No changes to existing chat UI layout
- Feature is purely additive — can be toggled off without breaking anything

---

## Implementation Notes for Claude Code

1. Confirm exact structure of key_definitions in note_lesson_plans
   before building the extraction function — ask David if unclear

2. Highlighting pass must run AFTER stream completion, not during —
   partial markdown during streaming will break regex matching

3. Apply escapeRegex() to all term strings before building RegExp —
   terms may contain parentheses or other regex special characters
   e.g. "f(x)" would break an unescaped regex

4. Test with a note that has many key_definitions (10+) to verify
   performance — the replacement loop should be imperceptible

5. KaTeX rendered math must be excluded from highlighting —
   wrap the highlighting pass to skip nodes with class 'katex'

---

## user_events Logging

```
key_term_hovered     — desktop hover on highlighted term
key_term_tapped      — mobile tap on highlighted term
```

Lightweight signal — tells you which terms students look up most.
Useful for future content improvement decisions.

---

## Open Questions — Resolved

| Question | Decision |
|----------|----------|
| Backend endpoint needed | No — key_definitions from existing lesson plan payload |
| When to apply highlights | After full stream completion, not during |
| Desktop interaction | Hover tooltip |
| Mobile interaction | Tap to expand inline or bottom sheet |
| Terms inside LaTeX/code | Excluded from highlighting pass |
| Highlight style | Amber underline — textbook feel, not aggressive |

