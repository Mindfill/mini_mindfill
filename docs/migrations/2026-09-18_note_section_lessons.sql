-- Uni notes lesson UI (docs/TECHCESS_NOTES_LESSON_UI_SPEC.md §8):
-- one tutor session per SECTION instead of one per note.
--
-- Existing whole-note sessions become "legacy" rows (section_index null).
-- They stay in the database untouched; the new UI simply never loads them.
-- note_progress stays one row per note (dashboards and the notes list read it);
-- completed_sections holds section_index values, as it already did.

-- 1. note_sessions: one row per section attempt ------------------------------
alter table public.note_sessions
  add column if not exists section_index integer null,
  add column if not exists status text not null default 'active',
  add column if not exists is_review boolean not null default false,
  add column if not exists exchange_count integer not null default 0,
  add column if not exists phase smallint not null default 1,
  add column if not exists completed_at timestamp with time zone null;

alter table public.note_sessions
  drop constraint if exists note_sessions_status_check,
  add constraint note_sessions_status_check
    check (status in ('active', 'completed', 'superseded'));

alter table public.note_sessions
  drop constraint if exists note_sessions_phase_check,
  add constraint note_sessions_phase_check check (phase between 1 and 3);

-- The (user_id, note_id) uniqueness must go: a note now has one session per
-- section, plus a fresh one each time a section is reviewed.
alter table public.note_sessions
  drop constraint if exists note_sessions_user_id_note_id_key;

-- Legacy whole-note chat: still at most one per note.
create unique index if not exists note_sessions_legacy_one_per_note
  on public.note_sessions (user_id, note_id)
  where section_index is null;

-- At most one live session per section. Completed / superseded ones are history.
create unique index if not exists note_sessions_one_active_per_section
  on public.note_sessions (user_id, note_id, section_index)
  where section_index is not null and status = 'active';

create index if not exists idx_note_sessions_section
  on public.note_sessions (user_id, note_id, section_index, created_at desc);

-- 2. note_conversations: signal on student turns, UI state on tutor turns -----
alter table public.note_conversations
  add column if not exists signal text null,
  add column if not exists phase smallint null,
  add column if not exists requires_chips boolean not null default false,
  add column if not exists chip_set text null;

alter table public.note_conversations
  drop constraint if exists note_conversations_signal_check,
  add constraint note_conversations_signal_check
    check (signal is null or signal in ('green', 'orange', 'red'));

alter table public.note_conversations
  drop constraint if exists note_conversations_phase_check,
  add constraint note_conversations_phase_check
    check (phase is null or phase between 1 and 3);

alter table public.note_conversations
  drop constraint if exists note_conversations_chip_set_check,
  add constraint note_conversations_chip_set_check
    check (chip_set is null or chip_set in ('comprehension', 'confirm', 'choice'));

-- Verify (expect 6 + 4 rows):
 select table_name, column_name from information_schema.columns
 where (table_name = 'note_sessions' and column_name in
         ('section_index','status','is_review','exchange_count','phase','completed_at'))
    or (table_name = 'note_conversations' and column_name in
         ('signal','phase','requires_chips','chip_set'));
