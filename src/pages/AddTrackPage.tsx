import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { RangeSlider, Button as MantineButton } from "@mantine/core";
import { createSpotifyClient, SpotifyTrack } from "../api/spotifyClient";
import { Quiz } from "../types/quiz";
import { QuizActions } from "../providers/QuizProvider";
import { useAuth } from "../providers/AuthProvider";
import { useSpotifyPlayer } from "../providers/SpotifyPlayerProvider";
import { formatMs } from "../utils/time";

type Props = {
  quiz?: Quiz;
  actions: QuizActions;
};

type SearchState = {
  query: string;
  results: SpotifyTrack[];
  loading: boolean;
  error?: string;
};

export function AddTrackPage({ quiz, actions }: Props) {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session } = useAuth();
  const spotifyPlayer = useSpotifyPlayer();
  const [state, setState] = useState<SearchState>({ query: "", results: [], loading: false });
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [startMs, setStartMs] = useState(0);
  const [endMs, setEndMs] = useState(30000);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState<string | undefined>();
  const [selectedMeta, setSelectedMeta] = useState<SpotifyTrack | undefined>();
  const [fetchingMeta, setFetchingMeta] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(state.query.trim()), 300);
    return () => clearTimeout(timer);
  }, [state.query]);

  useEffect(() => {
    if (!quiz && quizId) {
      navigate("/");
    }
  }, [quiz, quizId, navigate]);

  useEffect(() => {
    async function search() {
      if (!session?.provider_token || !debouncedQuery) {
        setState((prev) => ({ ...prev, results: [], loading: false, error: undefined }));
        setShowDropdown(false);
        return;
      }
      setState((prev) => ({ ...prev, loading: true, error: undefined }));
      try {
        const client = createSpotifyClient(session.provider_token);
        const tracks = await client.searchTracks(debouncedQuery);
        setState((prev) => ({ ...prev, results: tracks, loading: false }));
        setShowDropdown(true);
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : "Search failed"
        }));
      }
    }
    search();
  }, [debouncedQuery, session?.provider_token]);

  const selectedTrackMeta = selectedTrackId ? selectedMeta : undefined;
  const inQuizTrack = selectedTrackId ? quiz?.tracks.find((t) => t.id === selectedTrackId) : undefined;

  if (!quiz) {
    return (
      <main style={{ padding: "1.5rem", fontFamily: "system-ui, sans-serif" }}>
        <p>Quiz not found.</p>
      </main>
    );
  }

  useEffect(() => {
    if (!quiz) return;
    const paramTrackId = searchParams.get("trackId");
    if (!paramTrackId || paramTrackId === selectedTrackId) return;
    const existing = quiz.tracks.find((t) => t.id === paramTrackId);
    if (!existing) return;
    setSelectedTrackId(existing.id);
    setSelectedMeta(undefined);
    setStartMs(existing.startMs);
    setEndMs(existing.endMs);
    if (spotifyPlayer.isReady) {
      spotifyPlayer.playTrack(existing.uri, { startMs: existing.startMs, endMs: existing.endMs });
    }
  }, [quiz, searchParams, selectedTrackId, spotifyPlayer.isReady]);

  useEffect(() => {
    if (!selectedTrackId || !session?.provider_token) return;
    if (selectedTrackMeta && selectedTrackMeta.album.images?.length) return;
    setFetchingMeta(true);
    const client = createSpotifyClient(session.provider_token);
    client
      .getTrack(selectedTrackId)
      .then((meta) => {
        setSelectedMeta(meta);
        const existing = quiz?.tracks.find((t) => t.id === selectedTrackId);
        if (existing) {
          setStartMs(existing.startMs);
          setEndMs(existing.endMs);
          if (!existing.coverUrl && meta.album.images[0]?.url) {
            actions.updateTrackCover(quiz.id, existing.id, meta.album.images[0].url);
          }
        }
      })
      .catch(() => {
        /* ignore */
      })
      .finally(() => setFetchingMeta(false));
  }, [selectedTrackId, selectedMeta, session?.provider_token, quiz, actions]);

  function handleSelect(index: number) {
    const chosen = state.results[index];
    if (!chosen) return;
    const existing = quiz.tracks.find((t) => t.id === chosen.id);
    if (!existing) {
      actions.addTrack(quiz.id, {
        id: chosen.id,
        uri: chosen.uri,
        name: chosen.name,
        artists: chosen.artists.map((a) => a.name).join(", "),
        durationMs: chosen.duration_ms,
        startMs: 0,
        endMs: chosen.duration_ms,
        coverUrl: chosen.album.images[0]?.url
      });
      if (chosen.album.images[0]?.url) {
        actions.updateTrackCover(quiz.id, chosen.id, chosen.album.images[0].url);
      }
      setStartMs(0);
      setEndMs(chosen.duration_ms);
    } else {
      setStartMs(existing.startMs);
      setEndMs(existing.endMs);
    }
    setSelectedTrackId(chosen.id);
    setSelectedMeta(chosen);
    setShowDropdown(false);
    spotifyPlayer.playTrack(chosen.uri, { startMs: 0, endMs: chosen.duration_ms });
    setSearchParams({ trackId: chosen.id });
  }

  function handlePrevResult() {
    if (!quiz || quiz.tracks.length === 0) return;
    const ordered = [...quiz.tracks].sort((a, b) => a.order - b.order);
    const currentIndex = selectedTrackId ? ordered.findIndex((t) => t.id === selectedTrackId) : 0;
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : ordered.length - 1;
    const prevTrack = ordered[prevIndex];
    if (!prevTrack) return;
    setSelectedTrackId(prevTrack.id);
    setSelectedMeta(undefined);
    setStartMs(prevTrack.startMs);
    setEndMs(prevTrack.endMs);
    spotifyPlayer.playTrack(prevTrack.uri, { startMs: prevTrack.startMs, endMs: prevTrack.endMs });
    setSearchParams({ trackId: prevTrack.id });
  }

  function handleAdd() {
    if (!quiz) return;
    const ordered = [...quiz.tracks].sort((a, b) => a.order - b.order);
    if (selectedTrackId) {
      const currentIndex = ordered.findIndex((t) => t.id === selectedTrackId);
      const nextIndex = currentIndex >= 0 && currentIndex < ordered.length - 1 ? currentIndex + 1 : -1;
      if (nextIndex >= 0) {
        const nextTrack = ordered[nextIndex];
        setSelectedTrackId(nextTrack.id);
        setSelectedMeta(undefined);
        setStartMs(nextTrack.startMs);
        setEndMs(nextTrack.endMs);
        spotifyPlayer.playTrack(nextTrack.uri, { startMs: nextTrack.startMs, endMs: nextTrack.endMs });
        setSearchParams({ trackId: nextTrack.id });
        return;
      }
    }
    // Start a fresh add flow
    setSelectedTrackId(undefined);
    setSelectedMeta(undefined);
    setState({ query: "", results: [], loading: false, error: undefined });
    setStartMs(0);
    setEndMs(30000);
    setShowDropdown(false);
    setSearchParams({});
  }

  function handlePause() {
    spotifyPlayer.pause();
  }

  return (
    <main style={{ padding: "1rem", maxWidth: 960, margin: "0 auto", fontFamily: "system-ui, sans-serif", position: "relative" }}>
      <div style={{ marginBottom: "1rem", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <button onClick={() => navigate(`/quiz/${quiz.id}`)} style={{ padding: "0.35rem 0.75rem" }}>
            ← Back
          </button>
          <span style={{ fontWeight: 600 }}>{quiz.name}</span>
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <span style={{ fontWeight: 600 }}>Search Spotify</span>
          <input
            value={state.query}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            onChange={(e) => setState((prev) => ({ ...prev, query: e.target.value }))}
            placeholder="Search songs or artists"
            style={{ padding: "0.75rem", borderRadius: 8, border: "1px solid #ddd" }}
          />
        </label>
        {state.loading && <p style={{ marginTop: "0.5rem" }}>Searching...</p>}
        {state.error && (
          <p style={{ color: "crimson", marginTop: "0.5rem" }} role="alert">
            {state.error}
          </p>
        )}
        {showDropdown && !state.loading && state.results.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              zIndex: 10,
              background: "white",
              border: "1px solid #ddd",
              borderRadius: 10,
              marginTop: "0.5rem",
              maxHeight: 320,
              overflowY: "auto",
              boxShadow: "0 6px 18px rgba(0,0,0,0.12)"
            }}
          >
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {state.results.map((track, idx) => {
                const smallestImage = track.album.images[track.album.images.length - 1];
                const isSelected = idx === state.selectedIndex;
                return (
                  <li
                    key={track.id}
                    style={{
                      padding: "0.5rem",
                      background: isSelected ? "#f6f9ff" : "white",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      cursor: "pointer"
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(idx);
                    }}
                  >
                    {smallestImage ? (
                      <img
                        src={smallestImage.url}
                        alt=""
                        width={48}
                        height={48}
                        style={{ borderRadius: 8, objectFit: "cover" }}
                      />
                    ) : (
                      <div style={{ width: 48, height: 48, borderRadius: 8, background: "#f3f3f3" }} />
                    )}
                    <div>
                      <div style={{ fontWeight: 600 }}>{track.name}</div>
                      <div style={{ fontSize: 13, color: "#555" }}>{track.artists.map((a) => a.name).join(", ")}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {selectedTrackId && (
        <section style={{ display: "flex", flexDirection: "column", gap: "1rem", border: "1px solid #eee", borderRadius: 12, padding: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            {selectedTrackMeta?.album.images[0]?.url || inQuizTrack?.coverUrl ? (
              <img
                src={selectedTrackMeta?.album.images[0]?.url || inQuizTrack?.coverUrl}
                alt=""
                width={120}
                height={120}
                style={{ borderRadius: 12, objectFit: "cover" }}
              />
            ) : (
              <div style={{ width: 120, height: 120, borderRadius: 12, background: "#f3f3f3" }} />
            )}
            <div>
              <div style={{ fontSize: 14, color: "#555" }}>Previewing</div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{selectedTrackMeta?.name || inQuizTrack?.name}</div>
              <div style={{ fontSize: 14, color: "#555" }}>
                {selectedTrackMeta
                  ? selectedTrackMeta.artists.map((a) => a.name).join(", ")
                  : inQuizTrack
                  ? inQuizTrack.artists
                  : ""}
              </div>
              <div style={{ fontSize: 12, color: "#777" }}>
                Duration {formatMs(selectedTrackMeta?.duration_ms || inQuizTrack?.durationMs || 0)}
              </div>
            </div>
          </div>

          <RangeSlider
            min={0}
            max={selectedTrackMeta?.duration_ms || inQuizTrack?.durationMs || 0}
            step={500}
            value={[startMs, endMs]}
            onChange={([start, end]) => {
              const duration = selectedTrackMeta?.duration_ms || inQuizTrack?.durationMs || 0;
              const safeStart = Math.max(0, Math.min(start, duration));
              const safeEnd = Math.max(safeStart + 500, Math.min(end, duration));
              setStartMs(safeStart);
              setEndMs(safeEnd);
            }}
            onChangeEnd={([start, end]) => {
              if (selectedTrackId) {
                actions.updateTrackRange(quiz.id, selectedTrackId, start, end);
                spotifyPlayer.playTrack(selectedTrackMeta?.uri || inQuizTrack?.uri || "", { startMs: start, endMs: end });
              }
            }}
            label={(value) => formatMs(value)}
          />

          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "space-between" }}>
            <button onClick={handlePrevResult} disabled={!quiz.tracks.length}>
              Prev song
            </button>
            <button onClick={handlePause}>Pause</button>
            <button onClick={handleAdd} disabled={!spotifyPlayer.isReady}>
              {selectedTrackId && quiz.tracks.sort((a, b) => a.order - b.order).findIndex((t) => t.id === selectedTrackId) < quiz.tracks.length - 1
                ? "Next song"
                : "Add track"}
            </button>
          </div>
          {spotifyPlayer.error && (
            <div style={{ color: "crimson", fontSize: 13 }} role="alert">
              {spotifyPlayer.error}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
