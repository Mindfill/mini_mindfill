-- Per-section lesson plans (uni section lessons).
--
-- The old plan was ONE gpt-4.1-mini call over the whole note (measured 15-17s
-- on a 6-section note, ~1.8k output tokens) and blocked the first lesson.
-- Each section's plan entry is now generated the first time that section is
-- opened, in the same call as the tutor's opening message, from that
-- section's text only. Notes that already have a whole-note plan
-- (note_lesson_plans) keep using its section entries; nothing is migrated.
--
-- Backend-only table (service role); no client policies needed.

create table if not exists public.note_section_plans (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  note_id uuid not null references public.notes (id) on delete cascade,
  section_index integer not null,
  content jsonb not null,
  created_at timestamp with time zone not null default now(),
  constraint note_section_plans_pkey primary key (id),
  constraint note_section_plans_note_section_key unique (note_id, section_index)
);

alter table public.note_section_plans enable row level security;

-- Verify (expect 1 row):
-- select count(*) from information_schema.tables where table_name = 'note_section_plans';
