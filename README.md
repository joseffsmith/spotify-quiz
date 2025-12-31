## Spotify Quiz App

Lean React/Vite app for building and running music quiz rounds with Spotify full-track playback (Spotify Premium), backed by Supabase auth/storage.

### Prerequisites
- Node 18+
- Supabase CLI (`brew install supabase/tap/supabase` or see Supabase docs)
- Supabase project with Spotify OAuth configured

### Setup
1) Install deps:
```sh
pnpm install
```
2) Configure env (copy `.env.example` → `.env.local`):
```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```
3) Configure Supabase CLI:
```sh
supabase init            # if not already present
supabase link --project-ref <your-project-ref>
```
4) Apply migrations:
```sh
supabase db push
```
This applies `supabase/migrations/0001_quiz_tables.sql` to your project (quizzes/tracks tables + RLS).

5) Run dev server:
```sh
pnpm run dev
```

### Spotify Playback
- The app requests Spotify scopes for streaming and playback control (`streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state`).
- For full-track playback, users need Spotify Premium; the Web Playback SDK is initialized with the Supabase provider token.
- Make sure your Spotify app’s redirect URI includes `https://<project-ref>.supabase.co/auth/v1/callback` (and `http://localhost:54321/auth/v1/callback` for local Supabase CLI). Site URL in Supabase Auth settings should be your dev host (e.g. `http://localhost:5173`).

### Notes
- Spotify OAuth redirect should include your dev URL (e.g. `http://localhost:5173`) in Supabase > Authentication > Providers.
- State is persisted in Supabase tables `quizzes` and `quiz_tracks`; reducer syncs with remote on load/mutations.
