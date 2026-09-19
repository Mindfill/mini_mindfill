# Techcess Platform Sprint — Build Spec v2

> **What this document is:** A complete implementation spec for Claude Code sessions. It covers fixes to existing features and new features to build. Read this entire document before every session.
>
> **CRITICAL RULE: Do NOT modify, refactor, or restructure any existing working feature without explicit approval. The platform has 80-90% of its planned features already built and functional. This spec adds to what exists — it does not replace it. If a new feature touches an existing component, ask before changing it. When in doubt, leave it alone.**
>
> **Two products, one codebase:** Secondary school (authored curriculum, gated progression) and University (note uploads, open navigation). They share UI components and backend patterns but differ in data source and behavior.
>
> **Stack:** `mindfill_mvp_backend` (FastAPI + Supabase), `mini_mindfill` (React frontend)

---

## 1. CRITICAL FIXES (Do These First)

### 1.1 Mobile Responsiveness
- **Problem:** Multiple testers report horizontal overflow — UI wider than screen, requires horizontal scroll to read text. At least two testers hit this independently.
- **Impact:** Most target users (African students) are on mobile. This makes the product unusable.
- **Fix:** Audit ALL existing components for fixed widths, overflow, and viewport issues. Every component must work within `max-width: 100vw` with zero horizontal scroll. Test at 360px width minimum (common budget Android devices).
- **Do first.** Everything built on top of a broken responsive layout will also be broken.

### 1.2 Session Persistence / Auth Overhaul
- **Problem:** Students re-authenticate with Google OAuth on every visit. No persistent session.
- **Change:** Switch from JWT in local storage to **httpOnly cookies** for session management. Use Supabase SSR helpers (`@supabase/ssr`) for cookie-based sessions.
- **Behavior:** After successful OAuth, redirect to dashboard. Never show login screen to an already-authenticated user. Session should persist across browser closes and app restarts.
- **Stretch:** Add email/password signup as fallback auth method alongside Google OAuth.

### 1.3 Upload Flow (University Product Only)
- **Problem:** File picker routes to Google Drive instead of device gallery/local storage. Only PDFs accepted.
- **Fix:** Use native HTML file input with `accept="application/pdf,image/jpeg,image/png"`. No Drive-specific picker. Let the OS handle file selection.
- **New:** Accept JPEG/PNG uploads alongside PDF. Backend detects file type and routes accordingly (see Section 2).
- **Note:** Secondary school has NO uploads. This entire section applies only to the university product.

### 1.4 Manim Visualization Pipeline
- **Problem:** No visualizations appeared for testers despite the pipeline being functional on Render.
- **Diagnosis first:** Is the backend emitting `[VIZ]` signals that the frontend isn't rendering? Or is the model not requesting visualizations at all? Add a temporary debug indicator to isolate frontend vs backend.
- **If frontend bug:** Fix SSE parsing for `[VIZ]` signals and the polling endpoint `GET /visualizations/status` rendering.
- **If model bug:** Update tutor system prompt to make VIZ requests mandatory for specific subsection types (see Section 8.3).
- **Reminder:** Visualization retry interval is temporarily at 5 minutes for local debugging — revert to 5 seconds before deployment.

---

## 2. EXTRACTION PIPELINE OVERHAUL (University Product Only)

### 2.1 The Three-Tier Extraction Chain

**Replace the current GPT-5.6 Luna vision-only extraction with a production-grade fallback chain:**

```
UPLOAD ARRIVES
    │
    ├── PDF file?
    │       ↓
    │   TIER 1: pymupdf4llm.to_markdown("file.pdf")
    │       - Extracts text, tables, headers, bold/italic, multi-column layout
    │       - Preserves reading order
    │       - Outputs structured Markdown
    │       - Auto-detects per page:
    │           • Clean digital text → direct parsing (instant, $0)
    │           • Scanned/image pages → Tesseract OCR auto-triggered (fast, $0)
    │           • Only OCRs broken spans, not full pages
    │       - Images extracted as separate files (see Section 2.3)
    │       - Time: 1-5 seconds for entire document
    │       ↓
    │   TIER 2: Quality check on output
    │       - If substantial text returned → proceed to AI structuring
    │       - If sparse/garbled text on specific pages despite OCR →
    │         those pages go to TIER 3
    │       ↓
    │   TIER 3 (rare fallback): Vision model (GPT-5.6 Luna)
    │       - Only for pages where Tier 1+2 failed
    │       - Severely degraded handwriting, complex diagram descriptions
    │       - Expensive, slow — but only hits ~5-10% of uploads
    │
    ├── JPEG/PNG file?
    │       ↓
    │   Store original image in Supabase Storage bucket
    │   Run Tesseract OCR on image
    │       - If good text returned → proceed to AI structuring
    │       - If sparse text (likely a diagram, not notes) → vision model
    │
    └── Multiple images uploaded?
            ↓
        Batch as single note with sequential page ordering
        Process each image as above
```

### 2.2 Install Requirements
```bash
# Backend server
pip install pymupdf4llm
apt-get install tesseract-ocr
```

### 2.3 Extracted Image Handling
- PyMuPDF4LLM extracts embedded images from PDFs as separate binary files
- Upload each extracted image to a **Supabase Storage bucket** (e.g., `note-images`)
- Get public URL from Supabase
- Replace inline image references in Markdown with Supabase URLs
- Teaching cards display these images inline when relevant
- For JPEG uploads: the uploaded image IS the source — store in Supabase Storage, link to the note section, display in teaching cards as-is

### 2.4 Streamed Extraction → Circuit Board

After PyMuPDF4LLM extracts the Markdown (1-5 seconds), send it to the AI model for structuring:

```
Clean Markdown text (from PyMuPDF4LLM, not raw images)
    ↓
AI model call (text-mode, NOT vision-mode — fast and cheap)
Prompt: "Structure this academic content into sections. Return as streamed
JSON objects, each with: section_title, description (one line), content
(full text for this section), has_formulas (bool), has_diagrams (bool),
prerequisites (array of earlier section_titles)."
    ↓
Streamed via SSE — each JSON block as generated:
  → Frontend renders node on circuit board (fade-in animation)
  → Backend stores into note_sections table
  → concept_tree_json on notes table accumulates tree structure
    ↓
Circuit board fully built in ~10-15 seconds total
```

**Key cost insight:** The AI model now does STRUCTURING (text-mode, cheap) not EXTRACTION (vision-mode, expensive). PyMuPDF4LLM handles extraction at $0. Vision model only hits the rare fallback pages.

### 2.5 Schema (Already Migrated — Do NOT Run Again)
The following columns and resources have already been added to the database. They are listed here for reference only — do not create them again.

- `notes.concept_tree_json` (JSONB) — stores tree structure for circuit board rendering
- `note_sections.section_teaching_cards` (JSONB) — caches generated teaching cards after first visit
- `note_sections.section_flashcards` (JSONB) — caches flashcards after section completion
- `note_sections.extracted_image_urls` (JSONB, default `[]`) — Supabase Storage public URLs for images extracted from this section
- `student_knowledge_state.learning_pace` (VARCHAR, default `'moderate'`, CHECK `IN ('fast', 'moderate', 'deliberate')`) — adaptive pacing parameter
- Supabase Storage bucket `note-images` (public) — stores images extracted from PDFs and uploaded JPEGs/PNGs

**No changes** were made to existing columns on `note_sections`, `lesson_plans`, `conversations`, or `conversation_messages`.
**No changes** to secondary school schema — existing curriculum hierarchy IS the circuit board data.

---

## 3. CIRCUIT BOARD UI (Course Navigation)

### 3.1 Technical Approach
- **No React Flow.** Build with styled HTML elements + SVG overlays + Framer Motion.
- Vertical scrolling layout — nodes are styled `div` elements, traces are SVG `path` elements drawn between nodes with 90-degree angular routing.
- Framer Motion for all animations: fade-in, glow, pulse, trace-draw.
- This is simpler, lighter, and more performant on budget Android phones than any canvas/graph library.

### 3.2 Visual Design Language — PCB Aesthetic
- **Layout:** Top-down vertical scrolling path. Student scrolls down. Occasional horizontal branches for parallel concepts. Think subway map meets circuit board.
- **Nodes:** Chip-styled rectangular blocks. Rounded corners, subtle border, clean padding. Each node = one section.
- **Traces:** Copper/gold SVG `path` elements connecting nodes. 90-degree angular routing (horizontal → vertical → horizontal). Animated with `stroke-dashoffset` for draw-in effects.
- **Color palette:**
  ```
  --bg-primary: #0a1628          /* Deep navy */
  --bg-card: #111d2e             /* Card backgrounds */
  --trace-color: #c4873b         /* Copper/gold traces */
  --trace-glow: #e8a948          /* Active trace glow */
  --node-border: #2a3a52         /* Locked node border */
  --node-active: #c4873b         /* Active/completed fill */
  --node-locked: #1a2438         /* Locked node fill */
  --text-primary: #e8ecf1        /* Labels */
  --text-secondary: #8899aa      /* Descriptions */
  --accent-tutor: #c4873b        /* Tutor message accent */
  --pulse-loading: rgba(196, 135, 59, 0.3)
  ```
- **Typography:** Inter for UI text. JetBrains Mono for formulas/code. KaTeX for LaTeX rendering (already in stack).

### 3.3 Node States
| State | Visual | Behavior |
|-------|--------|----------|
| **Locked** | Dim, muted border, faded text | Not tappable (secondary only — university has no locks) |
| **Available** | Subtle border pulse, visible | Tappable |
| **Loading** | Animated trace drawing toward node | Extraction or card generation in progress |
| **Active** | Highlighted border, accent fill | Student is in this lesson |
| **Completed** | Full copper/gold glow, "powered on" | Done, reviewable |

### 3.4 Progressive Build (University)
As SSE streams extraction results:
1. Each JSON block → new node fades in at bottom of path (Framer Motion `initial/animate`)
2. SVG trace draws itself connecting to previous node (`stroke-dashoffset` animation)
3. Student watches their material assemble into a circuit — this IS the loading experience
4. Nodes become tappable as content arrives

### 3.5 Unlock Animation (Secondary School)
When comprehension depth met:
1. Current node fills with copper/gold glow
2. Trace line animates from current node to next node
3. Next node transitions from Locked → Available
4. Clean, satisfying — not gamified, just the circuit powering on

### 3.6 Data Sources

**Secondary school** — no generation, no extraction. Read directly from existing curriculum hierarchy:
```sql
SELECT subsection_id, subsection_title, subsection_type, display_order
FROM curriculum_subsections
WHERE chapter_id = :chapter_id
ORDER BY display_order;
```

**University** — generated from uploaded content via `concept_tree_json` on the `notes` table.

---

## 4. LESSON SCREEN (Inside a Node)

### 4.1 The Learning Feed

When a student taps a node → a sequence of **teaching cards** appears, one idea per card, progressed by tapping "Got it" / "Continue." This is NOT a chat interface. The student reads and advances.

At any point, tapping "I'm confused" opens a **conversation breakout** — a bounded tutor chat about that specific card. When resolved, the feed resumes.

### 4.2 Card Design
Each card is a well-designed block — rounded corners, clean padding, PCB color palette, good typography. One concept per card. Not a wall of text.

### 4.3 Card Content Per Product

**Secondary school (pre-authored, instant load, NO model call):**

| Card | Source |
|------|--------|
| Analogy | `analogy_text` from `curriculum_subsections` |
| Intuition | `intuition_explanation` from `curriculum_subsections` |
| Nigerian Context | `nigerian_real_world_context` from `curriculum_subsections` |
| Key Definitions | `key_definitions` from `curriculum_subsections` |
| Visualization | Manim output from `manim_prompts` (inline) |
| Tutor Prompt | `chat_prompt_text` — invites engagement / opens chat |

**University (generated on node tap — one model call, streamed):**

| Card | Content |
|------|---------|
| Analogy | Grounding the concept in relatable terms |
| Formal Explanation | With LaTeX + plain language for each piece |
| Worked Example | Preferably from the student's own notes if found in extracted content |
| Socratic Provocation | Open question testing understanding |

The generation prompt receives:
- Extracted section content from `note_sections.content`
- Student's `learning_pace` parameter (fast / moderate / deliberate)
- Instruction to return streamed JSON cards with `card_type` fields

**Pace effect on generation:**
- `fast` → Skip extended analogies. Formal definition + worked example. Technical language. Compress.
- `moderate` → Balanced analogy + formal + one narrated example. Standard depth.
- `deliberate` → Concrete analogy first. Formal explanation broken smaller. Intermediate + full example. Simpler language. Explicit transitions.

### 4.4 Conversation Breakout ("I'm confused")
- Floating button always visible during card viewing
- Tap → current card pins at top as context
- Chat pane appears below
- **Tutor speaks first** — never a blank input box
- Tutor has full context: card content, section content, pace, prior sessions
- When conversation resolves → remaining cards regenerate with conversation context (one additional model call)
- Chat collapses → feed resumes

### 4.5 Chat Visual Design (Not ChatGPT)
- **Tutor messages:** Card-style blocks with copper/gold left accent bar. Small branded avatar icon. Distinct background.
- **Student messages:** Right-aligned, simpler styling, different background.
- **Progress indicator:** Top of screen showing card position (e.g., "2 of 5")
- **Bounded.** Session has a natural end — when last card done (or quiz passed for secondary), clear completion moment. Not open-ended.

### 4.6 Loading Animation (First Load)
On node tap before cards are ready:
- Branded animation: trace line animating along PCB path, "powering up" the node
- Built with SVG + Framer Motion (NOT Rive — keeping the animation stack unified for now)
- University: 3-5 seconds while first card generates. Animation transitions into first card.
- Secondary: content loads from DB near-instantly. Animation purely for brand polish — under 2 seconds.

---

## 5. STATE MACHINE (Session Architecture)

### 5.1 States

```
LOADING → CARD_VIEWING → CARD_VIEWING → ... → SECTION_COMPLETE
               ↓
          CONVERSATION → CARD_REGENERATION → CARD_VIEWING
```

| State | What happens | Transitions to |
|-------|-------------|----------------|
| `LOADING` | Node tapped. Generation in flight (uni) or DB fetch (secondary). Loading animation. | `CARD_VIEWING` on first card |
| `CARD_VIEWING` | Student reading card. Frontend records time. | Next `CARD_VIEWING` (on "Got it"), `CONVERSATION` (on "I'm confused"), `SECTION_COMPLETE` (if last card) |
| `CONVERSATION` | Tutor chat open, grounded in current card | `CARD_REGENERATION` (if cards remain), `SECTION_COMPLETE` (if last card) |
| `CARD_REGENERATION` | New generation for remaining cards with conversation context | `CARD_VIEWING` on first regenerated card |
| `SECTION_COMPLETE` | Node powers up on circuit board. Metrics stored. Pace updates. | Return to circuit board |

### 5.2 Frontend Implementation

Single `useLessonFlow` React hook. Both products use it.

```javascript
// Reducer actions
dispatch({ type: 'CARD_READY', card: cardData })
dispatch({ type: 'GOT_IT' })
dispatch({ type: 'CONFUSED' })
dispatch({ type: 'CONVERSATION_RESOLVED', transcript: messages })
dispatch({ type: 'SECTION_DONE' })

// Content source controls behavior
useLessonFlow({
  contentSource: 'authored' | 'generated',
  sectionId: string,
  studentPace: 'fast' | 'moderate' | 'deliberate'
})
```

### 5.3 Backend Endpoints

| Endpoint | Purpose | Status |
|----------|---------|--------|
| `POST /sections/{id}/generate-cards` | Section content + pace → streamed teaching cards | **NEW** |
| `POST /sections/{id}/chat` | Tutor conversation exchange | **EXISTING — wire to conversation breakout** |
| `POST /sections/{id}/complete` | Receives metrics, updates pace, returns state | **NEW** |

### 5.4 Edge Cases
- **App close mid-section:** Persist current card index + viewed cards in session record. Resume on return.
- **Re-visit completed node:** Load from `section_teaching_cards` cache. No regeneration. Instant.
- **Network drop during generation:** Display whatever cards arrived. Chat available on any displayed card.
- **"I'm confused" on first card:** Conversation opens. On resolve, ALL subsequent cards regenerate.
- **Taps under 3 seconds:** Counted as skip — not genuine engagement. Not factored into pace calculation.

---

## 6. ADAPTIVE PACING

### 6.1 Frontend Metrics (Zero Model Calls)

```javascript
const cardMetrics = {
  card_index: number,
  time_spent_ms: Date.now() - cardRenderTimestamp,
  action: 'got_it' | 'confused' | 'skip',
  conversation_exchanges: number | null
}
```

### 6.2 Backend Pace Calculation (Simple Math)

```python
def calculate_pace(recent_metrics: list) -> str:
    # Last 3 sections = 70% weight, older = 30%
    avg_time = weighted_average(metrics)
    conv_rate = conversations_opened / total_cards

    if avg_time < 8: pace = 'fast'
    elif avg_time <= 25: pace = 'moderate'
    else: pace = 'deliberate'

    if conv_rate > 0.6: shift_toward_deliberate(pace)
    elif conv_rate < 0.2: shift_toward_fast(pace)

    return pace
```

For secondary school: normalize against expected difficulty per `subsection_type` (definition < conceptual_illustration < worked_example).

### 6.3 Calibration
- First node: full default sequence, no adaptation
- Second node: light signal from first
- Third node onward: pace set with confidence, recalculated after every completion

---

## 7. QUIZZES AND FLASHCARDS

### 7.1 Quizzes

**Secondary (gated):** Quiz triggers at SECTION_COMPLETE. Node doesn't fully power up until passed. Assessment via Haiku model against `working` field as rubric.

**University (optional):** "Test yourself?" prompt after last card. 2-3 generated questions. Results feed pace parameter. Skippable.

### 7.2 Flashcards
- Generated at SECTION_COMPLETE
- Cached in `section_flashcards` JSON column
- Reviewable anytime via completed nodes
- Global review mode: flashcards from all completed nodes, weighted by recency and quiz performance

### 7.3 Anki Export
- Library: `genanki` (`pip install genanki`)
- Endpoint: `GET /notes/{id}/anki-export` (uni) or `GET /chapters/{id}/anki-export` (secondary)
- "Download deck" button on circuit board view

---

## 8. SYSTEM PROMPT UPDATES

### 8.1 Pedagogical Framework (Embed in Both Tutor Prompts)

Hard rules, not suggestions:
1. Teach observation before notation
2. Make the translation step explicit every time
3. Never let a formula be the destination
4. Connect concepts across disciplines deliberately
5. Teach the failure modes of models
6. Use real problems with no clean answers
7. Make misconceptions productive
8. Build metacognitive awareness
9. Celebrate connection over correct answers
10. End every session with an open question

### 8.2 Tutor Behavior Per Subsection Type
- `definition_analogy` → Ask student to restate. "I understand" not accepted.
- `worked_example` → Reveal one step at a time after student attempts. Why this formula, not another.
- `conceptual_illustration` → Present new scenario after understanding shown.
- `misconception_address` → Ask what student thought BEFORE reading. Don't correct immediately.

### 8.3 Mandatory Manim VIZ Triggers
```
- conceptual_illustration subsections → ALWAYS emit [VIZ] after analogy explanation
- worked_example subsections → ALWAYS emit [VIZ] after walkthrough
- definition_analogy → emit [VIZ] only if concept has spatial/graphical dimension
```

### 8.4 Session Boundaries
```
- Once comprehension threshold met AND minimum exchange floor hit → signal [SECTION_COMPLETE]
- Do NOT keep asking questions after student demonstrates understanding
- A lesson session has a natural end — this is a tutor, not a chatbot
```

---

## 9. DEPENDENCIES

| Dependency | Purpose | Install |
|-----------|---------|---------|
| PyMuPDF4LLM | PDF extraction (Tier 1) | `pip install pymupdf4llm` |
| Tesseract | OCR for scanned pages (Tier 2) | `apt-get install tesseract-ocr` |
| Framer Motion | All UI animations | `npm install framer-motion` |
| genanki | Anki deck generation | `pip install genanki` |
| @supabase/ssr | Cookie-based auth | `npm install @supabase/ssr` |

**NOT using:** React Flow, Rive, D3.js, or any canvas/graph library. SVG + Framer Motion handles everything.

---

## 10. WHAT IS NOT IN THIS SPRINT

- Parent dashboard
- School admin dashboard
- Paystack billing changes
- WhatsApp/Termii notification pipeline
- Content authoring (SS1 curriculum — separate sessions)
- Physical lab planning
- Multi-device enforcement
- OpenAI prompt stored object migration
- PDF/image uploads for secondary school (secondary uses authored curriculum only)

---

## 11. INTEGRATION GUARDRAILS

**Before modifying ANY existing file:**
1. Check if the component/endpoint is already functional
2. If it works, do NOT refactor, restructure, or "improve" it
3. New features should be added as NEW components/endpoints where possible
4. If a new feature MUST touch an existing component, describe the planned change and wait for approval
5. Do not duplicate functionality that already exists — check the codebase first

**The following features are already built and working (do not rebuild):**
- Google OAuth flow (being modified to cookies — that's the only auth change)
- Basic note upload and storage
- Lesson plan generation pipeline
- Tutor chat (notes chat + course lesson chat)
- Manim visualization generation pipeline (backend — frontend display needs fixing)
- Student knowledge state tracking
- Basic curriculum data model

**These are being EXTENDED, not replaced:**
- Upload flow → adding JPEG/PNG support + new extraction pipeline
- Lesson experience → adding circuit board navigation + learning feed on top of existing chat
- Chat → adding conversation breakout pattern within learning feed context
- Extraction → replacing vision-first with PyMuPDF4LLM-first pipeline
