import { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { spotifyPlayerManager } from "../lib/spotifyPlayer";
import { useAuth } from "./AuthProvider";

type SpotifyPlayerContextValue = {
  isReady: boolean;
  deviceActive: boolean;
  error?: string;
  deviceId?: string;
  positionMs?: number;
  currentTrackUri?: string;
  playTrack: (uri: string, range: { startMs: number; endMs: number }) => Promise<boolean>;
  pause: () => Promise<void>;
};

const SpotifyPlayerContext = createContext<SpotifyPlayerContextValue | undefined>(undefined);

export function SpotifyPlayerProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const location = useLocation();
  const [state, setState] = useState({
    isReady: false,
    deviceActive: false,
    error: undefined as string | undefined,
    deviceId: undefined as string | undefined,
    positionMs: undefined as number | undefined,
    currentTrackUri: undefined as string | undefined
  });

  useEffect(() => {
    const unsubscribe = spotifyPlayerManager.subscribe((next) => setState(next));
    const isTrackView = /^\/quiz\/[^/]+\/add/.test(location.pathname);
    spotifyPlayerManager.setToken(session?.provider_token);
    if (!isTrackView) {
      spotifyPlayerManager.pause();
    }
    return () => {
      unsubscribe();
    };
  }, [session?.provider_token, location.pathname]);

  return (
    <SpotifyPlayerContext.Provider
      value={{
        ...state,
        playTrack: (uri, range) => spotifyPlayerManager.playTrack(uri, range),
        pause: () => spotifyPlayerManager.pause()
      }}
    >
      {children}
    </SpotifyPlayerContext.Provider>
  );
}

export function useSpotifyPlayer() {
  const ctx = useContext(SpotifyPlayerContext);
  if (!ctx) {
    throw new Error("useSpotifyPlayer must be used within SpotifyPlayerProvider");
  }
  return ctx;
}
