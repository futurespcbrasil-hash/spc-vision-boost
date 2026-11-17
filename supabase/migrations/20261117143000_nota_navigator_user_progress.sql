-- Persist lesson completion per authenticated CRM user.
create table if not exists public.portal_lesson_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null check (char_length(lesson_id) between 1 and 120),
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index if not exists portal_lesson_progress_user_updated_idx
  on public.portal_lesson_progress (user_id, updated_at desc);
alter table public.portal_lesson_progress enable row level security;
drop policy if exists "Users read own portal lesson progress" on public.portal_lesson_progress;
create policy "Users read own portal lesson progress"
  on public.portal_lesson_progress for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "Users create own portal lesson progress" on public.portal_lesson_progress;
create policy "Users create own portal lesson progress"
  on public.portal_lesson_progress for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "Users update own portal lesson progress" on public.portal_lesson_progress;
create policy "Users update own portal lesson progress"
  on public.portal_lesson_progress for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "Users delete own portal lesson progress" on public.portal_lesson_progress;
create policy "Users delete own portal lesson progress"
  on public.portal_lesson_progress for delete to authenticated
  using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.portal_lesson_progress to authenticated;
