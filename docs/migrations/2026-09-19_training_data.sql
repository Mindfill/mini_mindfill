-- Opt-in training data from deleted notes.
--
-- When a user deletes a note, an anonymised copy of its tutor conversations is
-- saved here first — ONLY if they are an adult (age computed from
-- date_of_birth at the moment of deletion) AND training_consent = true. Then
-- the note and everything attached to it is hard-deleted as before.
-- Everyone else: plain hard delete, nothing retained.
--
-- There is deliberately no is_minor column: a stored flag goes stale when the
-- student turns 18. Age is always computed from date_of_birth when needed.

-- 1. Consent — explicit opt-in, never assumed. Existing users start at false.
alter table public.user_profiles
  add column if not exists training_consent boolean not null default false,
  add column if not exists training_consent_at timestamp with time zone null;

-- 2. The anonymised copies. NO user_id, NO note_id, NO foreign keys, NO
--    timestamps: nothing here can be joined back to a person.
--    anon_id is random per deletion (consistent across that note's copies,
--    unrelated to the user) and is also what replaced their name / email / id
--    inside the message text.
create table if not exists public.training_data (
  id uuid not null default gen_random_uuid(),
  anon_id text not null,
  source text not null default 'note_lesson',
  section_title text null,
  is_review boolean not null default false,
  messages jsonb not null,
  message_count integer not null,
  -- No created_at on purpose: the delete logs a user-linked "note_deleted"
  -- event, and matching timestamps would re-identify the copy.
  constraint training_data_pkey primary key (id)
);

-- Service-role only: no client policies, so no user can read or write it.
alter table public.training_data enable row level security;

-- Verify (expect 2 + 1 rows):
-- select column_name from information_schema.columns
--   where table_name = 'user_profiles' and column_name in ('training_consent', 'training_consent_at');
-- select count(*) from information_schema.tables where table_name = 'training_data';
