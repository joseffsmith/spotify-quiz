-- Allow Spotify track IDs (non-UUID) by storing quiz_track id as text
alter table public.quiz_tracks alter column id type text using id::text;
