type Props = {
  onLogin: () => Promise<void>;
  error?: string;
};

export function LoginPage({ onLogin, error }: Props) {
  return (
    <main style={{ maxWidth: 480, margin: "3rem auto", fontFamily: "system-ui, sans-serif" }}>
      <h1>Log in with Spotify</h1>
      <p>Use Supabase Auth with the Spotify provider. You will be redirected to complete login.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <button onClick={onLogin} style={{ width: "fit-content" }}>
          Continue with Spotify
        </button>
        {error && (
          <div style={{ color: "crimson", fontSize: 14 }} role="alert">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
