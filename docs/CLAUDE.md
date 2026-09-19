# CLAUDE.md — mini_mindfill (Frontend)
## Read this at the start of every session. It is your map.

---

## CRITICAL — Read Before Touching Anything

**Before writing a single line of code:**
1. Scan the existing codebase to understand what's already built
2. Confirm the stack (see Stack Confirmation below)
3. Read the relevant feature file for the session
4. Ask David if anything is unclear — do not assume

**Never rewrite existing working code.**
Add to it. Extend it. Style it. Never replace it wholesale.

---

## Stack Confirmation (Verify This First)

**Expected stack:** React + Vite + Vercel deployment
Before implementing anything, confirm by checking:
- package.json for vite, react, react-dom
- vite.config.js or vite.config.ts exists
- vercel.json or .vercel folder exists

If the stack differs from expected — stop and tell David exactly
what you found before proceeding. Do not rewrite the build system.

---

## What This Codebase Is

Techcess frontend — React application deployed on Vercel.
Two user bases: university students (existing UI) and secondary school
students (new UI — primary build target this sprint).
The uni side exists and works. The secondary school side is new.

---

## Non-Negotiables

**Never touch without explicit instruction:**
- Existing notes upload and chat flow
- Existing lesson/course viewer and chat
- Existing payment flow and Paystack integration
- Existing auth screens
- Existing colour palette — extend it, never replace it
- Existing Manim visual display logic — reuse the same component
- Existing font configuration

**Before modifying any existing component:**
Tell David what you intend to change and why. Wait for confirmation.

---

## Design Identity — Preserve and Extend

### Colour palette
Check the existing codebase for the current colour variables (CSS custom
properties or Tailwind config). Use those as the foundation.
Do not introduce new primary colours — extend the existing palette with
shades and accent uses only.
Amber is the secondary accent (keyword highlights, progress indicators).
Check existing usage before adding any new colour.

### Typography
**Inter** — all UI text (already configured, do not change)
**JetBrains Mono** — code and math expressions (already configured)
These are non-negotiable. Do not add new fonts.
Make the most of Inter's weight range — 300 through 700 — for hierarchy.
Large, confident type. Generous line height. Serious textbook feel.

### Design language
Modern, clean, serious. Not playful. Not gamified.
Think: a premium tool a serious student would trust.
Generous whitespace. Strong typographic hierarchy. Purposeful motion.
Every animation communicates state — nothing animates just to animate.

---

## Animation Libraries (Use These — In Priority Order)

### 1. GSAP (primary — complex timelines)
Use for: streak increment celebration, chapter complete animation,
subsection unlock pulse, onboarding screen transitions,
static-to-tutor zone transition divider.
Import only the modules you need:
```javascript
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
gsap.registerPlugin(ScrollTrigger)
```
Do not import the full GSAP bundle.

### 2. Motion (formerly Framer Motion — React-native transitions)
Use for: component mount/unmount animations, layout transitions,
hover states on cards, tooltip fade-ins.
```javascript
import { motion, AnimatePresence } from 'motion/react'
```

### 3. Anime.js (targeted micro-animations)
Use for: number counters (streak count, progress percentages),
path drawing animations, SVG animations.
```javascript
import anime from 'animejs'
```

### Rule: pick one library per animation — never chain multiple
libraries on the same element. GSAP owns page-level transitions.
Motion owns component-level. Anime.js owns micro-animations.

---

## Anthropic Frontend Design Skill

If the frontend-design skill is available in your skill set,
read it before building any new UI component or page.
It contains the design tokens, spacing system, and component
patterns used in this environment.
Apply its guidance on: visual hierarchy, spacing, interactive states,
and making components feel intentional rather than templated.

---

## Component Library

**shadcn/ui** — base components (already available)
Follow shadcn patterns for: dialogs, tooltips, dropdowns, sheets,
tabs, progress bars, badges.

**Radix UI** — accessible primitives underlying shadcn.
Use directly when shadcn doesn't have what you need.

**Tailwind CSS** — utility styling throughout.
Do not write custom CSS unless a Tailwind utility genuinely cannot
achieve what's needed. Keep custom CSS minimal and scoped.

**KaTeX** — all LaTeX rendering in student-facing content.
Check existing KaTeX implementation and follow the same pattern.
Apply to: subsection content, chat messages, quiz questions, worked solutions.

---

## Manim Visuals — Existing Pattern

**Do not change how Manim visuals are fetched or displayed.**
Find the existing Manim visual component in the codebase and reuse it
exactly for secondary school content.
Static pre-generated visuals: served from storage_url, displayed inline.
Dynamic chat visuals: same component, same display logic.
The only difference for secondary school: static visuals appear in the
subsection page scroll, not in a chat thread.
Lazy load all Manim images — never block page render waiting for visuals.
Show a skeleton placeholder while loading.

---

## Responsive Design Rules

Mobile-first. Every component built for 375px first, then scaled up.
**Test every new component at 375px before considering it done.**
Minimum tap target: 44×44px on all interactive elements.
No horizontal scroll on any viewport width.
Navigation sidebar: desktop only — never on mobile.
Bottom sheet pattern for mobile overlays (not modals/tooltips).

---

## Accessibility

Keyboard navigable: all interactive elements reachable via Tab.
All images (including Manim) must have descriptive alt text.
WCAG AA colour contrast minimum on all text.
Screen reader compatible quiz components (aria-labels on all states).
Focus indicators visible on all interactive elements.

---

## State Management

Follow the existing state management pattern in the codebase.
If React context is used — add to existing contexts, never create parallel ones.
If local state is sufficient for a component — use useState.
Do not introduce Redux, Zustand, or any new state management library
without telling David first.

---

## API Client

Follow the existing API call pattern for auth headers and error handling.
**Device token addition (one place only):**
Find the existing API client/interceptor and add X-Device-Token header there.
Read from localStorage first, fall back to cookie.
Do not add this header per-call — it goes in the interceptor once.

---

## Routing

Secondary school routes: /secondary/* prefix
Parent dashboard: /parent/dashboard
School admin dashboard: /school/dashboard
Admin panel: /admin/curriculum
Onboarding: /onboarding (shared entry, user_type determines flow)
Follow existing routing pattern — do not change the router setup.

---

## Landing Page

Keep existing content and data.
Upgrade visual execution only — same information, better presentation.
Apply the full design identity: stronger typography, purposeful whitespace,
motion on scroll (GSAP ScrollTrigger or Motion viewport detection),
modern component styling consistent with the rest of the platform.
The landing page must feel like it belongs to the same product as the
secondary school UI. Consistent design language throughout.
No new sections invented — refine what exists.

---

## Performance Rules

1. GSAP: import only modules needed, never full bundle
2. Motion: tree-shakeable imports only
3. KaTeX: render after stream completion, never during streaming
4. Manim images: lazy load with skeleton placeholder
5. Dashboard: fetch all widgets in parallel (Promise.all), render progressively
6. Onboarding: each screen is a separate component — do not load all at once
7. Code split by route — do not bundle the entire app into one chunk

---

## Secondary School UI — Components to Build

### Navigation
- Subject list (flat cards, filtered by class level)
- Chapter grid (lock / in-progress / complete visual states)
- Section accordion (expandable, subsection list with type badges + ticks)
- Completion ticks propagate upward: subsection → section → chapter → subject
- Breadcrumb navigation on subsection page

### Subsection Page (single scrollable column)
- Static content zone: analogy callout, KaTeX prose, Nigerian context block,
  definition cards, chat prompt bubble, Manim visuals inline at authored positions
- GSAP transition: divider animates across page, tutor zone fades + slides up,
  tutor opening message types in (typewriter — signals AI presence)
- Tutor chat with SSE streaming and inline dynamic Manim visuals
- Next button three states:
  1. Hidden (not scrolled past static content)
  2. Visible but disabled — greyed, tooltip "Keep going"
  3. Unlocked — GSAP pulse into full colour, text: "I'm ready →"
  Context line above unlocked button: "Next up: [title]" or chapter completion text

### Mini Quiz
- Single question per view, progress bar at top
- Pass / partial / fail result states with Nano feedback
- "Try again" and "See solution" on partial/fail
- Solution reveal (working steps + answer)
- Question status indicators: ✓ passed / ● seen solution / ◐ partial / ○ not attempted
- Section unlock animation on all questions resolved

### End of Chapter Problems
- Numbered tab navigation per problem
- Multiline text area for student working
- Submit → solution reveal
- "Mark as understood ✓"
- "Ask tutor →" slide-up bottom sheet with SSE chat

### Dashboard Widgets
- Streak counter (GSAP animation on increment, flame visual)
- 7-day bar graph (Y: minutes, X: day labels) with % comparison highlights above
- Chapter progress rings per subject
- Strengths/weaknesses (topic names only, no scores)
- Continue learning card (deep link to last incomplete subsection)
- Session count comparison (this week vs last week)

### Onboarding (8 screens — secondary)
- Full viewport screens, GSAP slide transitions between screens
- One question per screen, no visible form structure
- Screen 2: DOB picker + age range response that fades in after input
- Screen 3: SS1/SS2/SS3 large tap cards
- Screen 4: school input with autocomplete dropdown
- Screen 5: goal cards (multi-select, satisfying selection animation)
- Screen 6: sentiment options + empathetic one-liner response after selection
- Screen 7: notification toggle + optional phone input
- Screen 8: plan cards + promo code section + "free chapter" escape hatch
  Invited member variant: "You're all set" confirmation instead of paywall

---

## Keyword Highlighting (Notes Chat — Uni Side)

Client-side only. No backend call.
1. Extract key_definitions from lesson plan payload at session start
   (check exact structure in codebase — ask David if unclear)
2. Build term → definition Map
3. After each AI stream completes (never during):
   - escapeRegex() every term string before building RegExp
   - Word boundary matching (\b), longer terms matched first
   - Skip KaTeX nodes (class 'katex') and <code> elements
   - Wrap: <mark class="key-term" data-term="term">
4. Desktop: hover tooltip, 200ms Motion fade-in
5. Mobile: tap → bottom sheet with term + definition
6. Test with 10+ definitions — loop must be imperceptible

---

## Not Building This Sprint

- Mobile app (web only)
- Dark mode (unless already exists — check first)
- Text-to-speech
- Social layer
- Teacher dashboard

---

## When Unsure

Ask David. Specifically when:
- The existing codebase uses a pattern not described here
- A component's design isn't fully specified in the feature file
- A new npm package seems necessary (confirm before installing)
- Two implementation approaches seem equally valid
- Anything about the existing Manim display or colour system is unclear

