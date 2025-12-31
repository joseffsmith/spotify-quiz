import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../lib/supabaseClient";

let cachedClient: SupabaseClient | null = null;
let supabaseInitError: string | undefined;

function resolveSupabaseClient() {
  if (cachedClient || supabaseInitError) {
    return cachedClient;
  }
  try {
    cachedClient = getSupabaseClient();
  } catch (error) {
    supabaseInitError = error instanceof Error ? error.message : "Failed to initialize Supabase client";
  }
  return cachedClient;
}

type AuthContextValue = {
  supabase: SupabaseClient;
  session: Session | null;
  loading: boolean;
  error?: string;
  signInWithSpotify: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const supabase = resolveSupabaseClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [clientError] = useState<string | undefined>(supabaseInitError);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const description = params.get("error_description");
    const providerCode = params.get("error_code");
    if (description || providerCode) {
      const friendly =
        providerCode === "provider_email_needs_verification"
          ? "Your Spotify email is unverified. Check your Spotify inbox for the verification email and confirm before retrying."
          : description || "Login was denied. Please try again.";
      setError(friendly);
      if (window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
      }
    }
  }, []);

  if (!supabase) {
    return (
      <div style={{ maxWidth: 640, margin: "2rem auto", fontFamily: "system-ui, sans-serif", color: "crimson" }}>
        Supabase configuration is missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.
        {clientError ? ` (${clientError})` : null}
      </div>
    );
  }

  useEffect(() => {
    let isMounted = true;
    supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!isMounted) return;
        if (sessionError) {
          setError(sessionError.message);
          setSession(null);
        } else {
          setSession(data.session);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function signInWithSpotify() {
    setError(undefined);
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "spotify",
      options: {
        redirectTo: window.location.origin,
        scopes: [
          "streaming",
          "user-read-email",
          "user-read-private",
          "user-read-playback-state",
          "user-modify-playback-state"
        ].join(" ")
      }
    });
    if (signInError) {
      setError(signInError.message);
    }
  }

  async function signOut() {
    setError(undefined);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
    }
  }

  return (
    <AuthContext.Provider value={{ supabase, session, loading, error, signInWithSpotify, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}
