# Techcess — University Notes Lesson UI Spec
**Target:** Claude Code end-to-end build  
**Scope:** University notes product only — lesson screen inside a section node  
**Stack:** React (mini_mindfill), FastAPI (mindfill_mvp_backend), Supabase  
**Font:** Inter for all UI, JetBrains Mono for code/math  
**Do not touch:** existing working components, lesson_plans table, conversations table schema, conversation_messages schema, note_sections columns

---

## 1. What we're building

Replace the current flat chat thread on the notes lesson screen with a new structured lesson UI. The interaction model is still a conversation — but the visual container is completely different from a generic chat thread.

**Core principles:**
- Tutor speaks first — student never sees a blank input box waiting for a prompt
- Student messages carry a persistent color signal showing comprehension state
- PCB pulse animation fires on each color assignment, then settles into resting glow
- One-tap chip responses replace typed yes/no answers for the tutor's comprehension checks
- Section nodes in a strip at the top — the student always knows where they are

---

## 2. Screen layout (mobile-first, single column)

```
┌─────────────────────────────┐
│  ← Graph Traversal   [Notes]│  ← top bar
│  Section 3 — BFS and DFS   │
│  [S1●] [S2●] [S3●] [S4] [S5]│  ← node strip (scrollable)
├─────────────────────────────┤
│  ▓▓▓▓░░░  Going deeper      │  ← phase bar + label
├─────────────────────────────┤
│                             │
│  TECHCESS                   │  ← tutor label
│  [tutor message bubble]     │
│                             │
│         [student message] ← │  ← student msg, right-aligned
│         ══════════ ● Correct│  ← PCB track + tag (fades)
│                             │
│  TECHCESS                   │
│  [tutor message bubble]     │
│                             │
│     [student message]     ← │
│     ══════════ ● Revisit    │
│                             │
│  TECHCESS                   │
│  [Does that make sense?]    │
│  [Yes, keep going] [Slow]   │  ← chip row
│                             │
├─────────────────────────────┤
│  [Ask anything…]      [▲]  │  ← input bar
└─────────────────────────────┘
```

---

## 3. Component breakdown

### 3.1 Top bar
- Back arrow + note title (truncated to one line)
- "Notes" button top-right — opens full note drawer (bottom sheet, see §7)
- Section title below

### 3.2 Node strip
Horizontally scrollable pill row. One pill per `note_sections` row ordered by `section_index`.

**States:**
| State | Background | Text | Border |
|-------|-----------|------|--------|
| done | `#071610` | `#3dcb8a` | `#1a4d35` |
| active | `#13102a` | `#9d94f5` | `#3a3070` |
| available | dark surface | muted | default |
| locked | dark surface | dim | default, 30% opacity |

Active pill shows a `●` dot after the label.

Tapping a `done` or `available` node navigates to that section's lesson. Tapping `locked` does nothing (no error state needed).

### 3.3 Phase bar
Three equal segments below the node strip. Labels: `Intuition`, `Going deeper`, `Test yourself` — map to tutor pedagogy phases (Layer 1, Layer 2, comprehension check).

Segment colors:
- Done: `#7F77DD` (purple)
- Active: `#4a4580` (dim purple)
- Pending: `#222` (dark)

Phase label text below bar: `#7F77DD`, 11px, 500 weight.

Phase is determined by the tutor backend — it returns a `phase` field (`1 | 2 | 3`) alongside each message. Frontend updates the bar on each tutor response.

### 3.4 Conversation area
Scrollable. No bubble containers on tutor messages — left-aligned text with clear typographic hierarchy. Student messages are right-aligned with rounded corners (`border-radius: 12px 4px 12px 12px`).

**Tutor messages:**
- Background: `#161618`
- Border: `0.5px solid #242428`
- Border-radius: `4px 12px 12px 12px`
- Text: `#c8c8cc`, 13px, line-height 1.6
- Label above: `TECHCESS`, 10px, uppercase, `#444`, letter-spacing 0.05em

**Student messages — base:**
- Right-aligned, max-width 85%
- Border-left: 2.5px solid (color by signal state)
- Background tint by signal state (see §4)
- 13px, line-height 1.5

Below each student message: PCB track + tag row (see §4).

### 3.5 Chip row
Rendered below tutor messages that contain a comprehension check. Not rendered for every tutor message — only when `requires_chips: true` is returned in the tutor response.

Chips:
- Default: dark surface, muted text, 0.5px border
- Primary (first chip): `#13102a` bg, `#9d94f5` text, `#3a3070` border
- Tapping a chip sends it as a message (same as typing it)
- Chips disappear once one is tapped

**Standard chip sets** (tutor decides which set to use via `chip_set` field):
- `comprehension`: `["Yes, keep going", "Slow down"]`
- `confirm`: `["Got it", "Not quite"]`
- `choice`: `["Show me", "I'll re-read first"]`

### 3.6 Input bar
Pinned at bottom. Rounded input field + send button.
- Input: `background: #161618`, 0.5px border, border-radius 20px
- Send button: 32px circle, `#534AB7` bg, white arrow icon
- Placeholder: `Ask anything…`

---

## 4. Signal color system

### 4.1 Signal states

| State | Meaning | Left border | Background | Tag label |
|-------|---------|-------------|------------|-----------|
| `green` | Correct understanding | `#1d9e75` | `#071410` | `Correct` |
| `orange` | Partial / worth revisiting | `#BA7517` | `#160e04` | `Worth revisiting` |
| `red` | Misconception | `#A32D2D` | `#130808` | `Misconception` |
| `null` | No assessment (question asked) | `#2a2a34` | `#1a1a20` | — |

**Light mode overrides** (applied when user preference is light):

| State | Left border | Background | Tag text |
|-------|-------------|------------|----------|
| `green` | `#1d9e75` | `#eaf5ee` | `#0f6e56` |
| `orange` | `#BA7517` | `#fdf3e3` | `#633806` |
| `red` | `#A32D2D` | `#fdf0f0` | `#791F1F` |
| `null` | `#c8c8d4` | `#ececf2` | — |

Tag pill colors remain the same in both modes (light tint with dark text from same color family — already readable on both).

### 4.2 PCB track animation

Rendered as an inline SVG below and left of the student message, in a `trackrow` div alongside the tag.

- Track dimensions: 60px wide, 10px tall
- Background path: `stroke: #1e1e24` (dark) / `stroke: #dddde4` (light), stroke-width 1.5
- Animated path: stroke color matches signal state, stroke-width 2, stroke-linecap round
- Animation: `stroke-dasharray: 80`, `stroke-dashoffset` animates from 80 → 0 over 1.2s ease-out, with opacity 0 → 1 at 15% → opacity 1 → 0 at 85%
- Fires once on signal assignment, does not loop

SVG path: `M3,5 L77,5` (straight horizontal — clean, circuit-like)

Animation keyframes:
```css
@keyframes pcbpulse {
  0%   { stroke-dashoffset: 80; opacity: 0; }
  15%  { opacity: 1; }
  85%  { opacity: 1; }
  100% { stroke-dashoffset: 0; opacity: 0; }
}
```

### 4.3 Tag label

- Rendered beside the PCB track
- Font: 10px, 500 weight
- Pill with 0.5px border, light tint bg, dark-family text (see table above)
- Fades to `opacity: 0` after **2.5 seconds** via CSS transition (`transition: opacity 0.6s ease`)
- Tag element stays in DOM (preserves layout) — only opacity goes to 0
- Does NOT reappear on scroll or re-render

### 4.4 Resting glow

After animation completes, the student message retains:
- The colored left border (`border-left: 2.5px solid {color}`)
- The faint background tint

This is the permanent record. As the session progresses, the student can glance up the screen and read their comprehension history from the color pattern alone.

---

## 5. Backend changes

### 5.1 Tutor response schema

Add three fields to the tutor's streamed JSON response. These are appended to the existing response structure — do not change existing fields.

```json
{
  "message": "...",
  "signal": "green" | "orange" | "red" | null,
  "phase": 1 | 2 | 3,
  "requires_chips": true | false,
  "chip_set": "comprehension" | "confirm" | "choice" | null
}
```

`signal` is `null` when the student asked a question rather than making a claim. `requires_chips` is `true` only when the tutor message ends with a direct comprehension check question. `chip_set` is `null` when `requires_chips` is `false`.

### 5.2 Signal assignment rules (system prompt addition)

Add the following block to the notes tutor system prompt, after the existing pedagogy rules:

---

**SIGNAL ASSIGNMENT**

After every student message that makes a claim or demonstrates understanding, you must assess it and return a `signal` value. This signal is shown visually to the student — use it honestly and consistently.

Rules:

**Return `"green"` when:**
- Student correctly restated a concept in their own words
- Student's reasoning is sound, even if phrasing is informal
- Student identified the right principle, mechanism, or relationship
- Student made a correct connection to prior material

**Return `"orange"` when:**
- Student is on the right track but overclaiming (e.g. "BFS is always better")
- Student has a partial mental model that is correct in one case but breaks in another
- Student is conflating two related but distinct ideas
- Student's answer is roughly right but missing a key constraint or qualifier

**Return `"red"` when:**
- Student stated something factually incorrect
- Student demonstrated a named misconception from the lesson plan's misconception list
- Student's claim would lead them to wrong conclusions in follow-up problems
- The error needs to be caught before the lesson proceeds, not just gently noted

**Return `null` when:**
- Student asked a question rather than making a claim
- Student said something neutral ("ok", "I see", "got it") without demonstrating understanding
- The exchange was a clarification, not an assessment moment

**Important:** `"red"` does not mean the student is being punished. Your response text must remain kind and Socratic regardless of signal. The signal is a quiet background assessment — your words are still the lesson.

**Phase rules:**

Return `"phase": 1` during the intuition and analogy layer (Layer 1 of the pedagogy).  
Return `"phase": 2` when moving into symbolic or deeper explanation (Layer 2).  
Return `"phase": 3` when you are explicitly checking comprehension before moving on.

**Chip rules:**

Return `"requires_chips": true` and a `chip_set` value only when your message ends with a binary comprehension check that the student can reasonably answer with one of the chip options. Use `"comprehension"` for "does that make sense?" moments, `"confirm"` for recap checks, `"choice"` for offering a fork in the lesson path. Most messages should have `"requires_chips": false`.

---

### 5.3 Tutor opening message

On first load of a section lesson, the frontend calls a new endpoint:

`POST /notes/{note_id}/sections/{section_id}/open`

This returns the tutor's opening message for this section — a question or provocation drawn from the section content and the lesson plan's guiding question. The student sees this immediately, before they have typed anything.

The opening message always has `signal: null`, `phase: 1`, `requires_chips: false`.

Response schema:
```json
{
  "message": "string",
  "signal": null,
  "phase": 1,
  "requires_chips": false,
  "chip_set": null
}
```

This replaces the blank input box on first load. The tutor always speaks first.

---

## 6. Light mode

The app respects the user's system preference (`prefers-color-scheme`) and a manual toggle stored in user preferences.

Light mode surface colors:
- Phone/screen background: `#f4f4f6`
- Top bar border: `0.5px solid #dddde4`
- Node strip defaults: `#ebebf0` bg, `#aaa` text
- Tutor bubble: `#ffffff` bg, `#2a2a32` text, `#dddde4` border
- Input field: `#ffffff` bg, `#ccc` border
- Phase bar pending segments: `#ddd`
- PCB track background path: `#dddde4`

Signal colors in light mode: see §4.1 table.

The PCB pulse and resting glow work in both modes. The pulse is subtler on light (no dark backdrop) but still reads as deliberate.

---

## 7. Notes drawer

Tapping the "Notes" button in the top bar opens a bottom sheet containing the full extracted note content (rendered markdown from `note_sections`, ordered by `section_index`).

- Bottom sheet slides up, covers ~85% of screen height
- Drag handle at top
- Scrollable content area
- Current section highlighted with a subtle left border in `#7F77DD`
- Tap outside or drag down to close
- Closing returns to the lesson exactly where it was

This is a read-only view. No editing, no annotations in v1.

---

## 8. Session and progress model

- One chat session per section node (not per note)
- `completed_sections` on the note's progress record: add `section_id` when phase 3 comprehension check is passed
- Completed nodes: `done` state on the node strip, teal color
- Progress persists across sessions — re-opening a completed node loads the existing conversation in read-only mode with an option to "Review again" (starts a new session)
- Unlock order: linear by default (`section_index`). Next node becomes `available` when current node is completed. First node is always `available` on note open.

---

## 9. Build order for Claude Code

1. Backend: add `signal`, `phase`, `requires_chips`, `chip_set` to tutor response schema
2. Backend: add signal assignment + phase/chip rules to notes tutor system prompt
3. Backend: build `POST /notes/{note_id}/sections/{section_id}/open` endpoint
4. Frontend: node strip component with state rendering
5. Frontend: phase bar component (receives `phase` from each tutor response)
6. Frontend: student message component with signal color system + PCB track animation + tag fade
7. Frontend: chip row component (conditional, chip_set driven)
8. Frontend: tutor opening message on section load (calls `/open` endpoint, no blank input)
9. Frontend: notes drawer (bottom sheet, full note content)
10. Frontend: session/progress wiring (completed_sections, node state updates)
11. Light mode: apply light surface tokens and signal color overrides

Test each step before moving to the next. Do not modify existing quiz, flashcard, or lesson plan endpoints.

---

## 10. Out of scope for this build

- Teaching cards (§4 of original spec — deferred)
- Manim visual surfacing changes (existing `[VIZ:N]` behavior unchanged)
- Figure inline display changes (existing `[FIGURE:n]` behavior unchanged)
- Quiz/flashcard UI (separate sprint item)
- Parent/admin dashboards
- Secondary school lesson screen (different product, different spec)
