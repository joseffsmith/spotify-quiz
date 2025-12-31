-- Quizzes owned by a user
create table if not exists public.quizzes (
  id uuid primary key,
  user_id uuid not null,
  name text not null,
  created_at timestamptz not null default now(),
  constraint quizzes_user_fk foreign key (user_id) references auth.users (id) on delete cascade
);

-- Tracks per quiz
create table if not exists public.quiz_tracks (
  id uuid primary key,
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  uri text not null,
  name text not null,
  artists text not null,
  duration_ms integer not null,
  preview_url text,
  start_ms integer not null default 0,
  end_ms integer not null default 0,
  order_index integer,
  created_at timestamptz not null default now()
);

-- Row Level Security
alter table public.quizzes enable row level security;
alter table public.quiz_tracks enable row level security;

-- Quiz policies
drop policy if exists "quizzes select own" on public.quizzes;
drop policy if exists "quizzes insert own" on public.quizzes;
drop policy if exists "quizzes update own" on public.quizzes;
drop policy if exists "quizzes delete own" on public.quizzes;
create policy "quizzes select own" on public.quizzes
  for select using (auth.uid() = user_id);
create policy "quizzes insert own" on public.quizzes
  for insert with check (auth.uid() = user_id);
create policy "quizzes update own" on public.quizzes
  for update using (auth.uid() = user_id);
create policy "quizzes delete own" on public.quizzes
  for delete using (auth.uid() = user_id);

-- Track policies
drop policy if exists "tracks select own" on public.quiz_tracks;
drop policy if exists "tracks insert own" on public.quiz_tracks;
drop policy if exists "tracks update own" on public.quiz_tracks;
drop policy if exists "tracks delete own" on public.quiz_tracks;
create policy "tracks select own" on public.quiz_tracks
  for select using (quiz_id in (select id from public.quizzes where user_id = auth.uid()));
create policy "tracks insert own" on public.quiz_tracks
  for insert with check (quiz_id in (select id from public.quizzes where user_id = auth.uid()));
create policy "tracks update own" on public.quiz_tracks
  for update using (quiz_id in (select id from public.quizzes where user_id = auth.uid()));
create policy "tracks delete own" on public.quiz_tracks
  for delete using (quiz_id in (select id from public.quizzes where user_id = auth.uid()));
