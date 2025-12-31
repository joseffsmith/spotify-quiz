import React, { createContext, useContext, useEffect, useReducer } from "react";
import { Quiz, Track } from "../types/quiz";
import { useAuth } from "./AuthProvider";
import {
  addRemoteTrack,
  createRemoteQuiz,
  deleteRemoteQuiz,
  deleteRemoteTrack,
  fetchRemoteQuizzes,
  updateRemoteTrackCover,
  updateRemoteTrackRange,
  updateRemoteTrackOrders
} from "../services/quizStorage";

export type QuizState = {
  quizzes: Record<string, Quiz>;
  currentQuizId?: string;
  status: "idle" | "loading" | "ready" | "error";
  error?: string;
};

type Action =
  | { type: "hydrate"; payload: { quizzes: Record<string, Quiz>; currentQuizId?: string } }
  | { type: "setStatus"; payload: QuizState["status"] }
  | { type: "setError"; payload?: string }
  | { type: "createQuiz"; payload: Quiz }
  | { type: "removeQuiz"; payload: { id: string } }
  | { type: "setCurrentQuiz"; payload: { id?: string } }
  | { type: "addTrack"; payload: { quizId: string; track: Track } }
  | {
      type: "updateTrackRange";
      payload: { quizId: string; trackId: string; startMs: number; endMs: number };
    }
  | {
      type: "updateTrackCover";
      payload: { quizId: string; trackId: string; coverUrl?: string };
    }
  | { type: "removeTrack"; payload: { quizId: string; trackId: string } }
  | { type: "reorderTrack"; payload: { quizId: string; trackId: string; direction: "up" | "down" } };

const QuizStateContext = createContext<QuizState | undefined>(undefined);
const QuizDispatchContext = createContext<React.Dispatch<Action> | undefined>(undefined);

export const initialState: QuizState = {
  quizzes: {},
  status: "idle"
};

function reorderTracks(tracks: Track[], trackId: string, direction: "up" | "down"): Track[] {
  const next = [...tracks].sort((a, b) => a.order - b.order);
  const index = next.findIndex((track) => track.id === trackId);

  if (index === -1) {
    return next;
  }

  const targetIndex = direction === "up" ? Math.max(0, index - 1) : Math.min(next.length - 1, index + 1);

  if (targetIndex === index) {
    return next.map((track, order) => ({ ...track, order }));
  }

  const [removed] = next.splice(index, 1);
  next.splice(targetIndex, 0, removed);

  return next.map((track, order) => ({ ...track, order }));
}

function resolveCurrentQuizId(quizzes: Quiz[], previousId?: string) {
  if (previousId && quizzes.some((quiz) => quiz.id === previousId)) {
    return previousId;
  }
  return quizzes[0]?.id;
}

export function quizReducer(state: QuizState, action: Action): QuizState {
  switch (action.type) {
    case "hydrate":
      return { ...state, quizzes: action.payload.quizzes, currentQuizId: action.payload.currentQuizId };
    case "setStatus":
      return { ...state, status: action.payload };
    case "setError":
      return { ...state, error: action.payload };
    case "createQuiz":
      return {
        ...state,
        quizzes: { ...state.quizzes, [action.payload.id]: action.payload },
        currentQuizId: action.payload.id
      };
    case "removeQuiz": {
      const { [action.payload.id]: _, ...rest } = state.quizzes;
      const nextCurrent = state.currentQuizId === action.payload.id ? undefined : state.currentQuizId;
      return {
        ...state,
        quizzes: rest,
        currentQuizId: nextCurrent
      };
    }
    case "setCurrentQuiz":
      return { ...state, currentQuizId: action.payload.id };
    case "addTrack": {
      const quiz = state.quizzes[action.payload.quizId];
      if (!quiz) return state;
      const nextTracks = [...quiz.tracks, { ...action.payload.track, order: quiz.tracks.length }];
      return {
        ...state,
        quizzes: {
          ...state.quizzes,
          [quiz.id]: {
            ...quiz,
            tracks: nextTracks
          }
        }
      };
    }
    case "updateTrackRange": {
      const quiz = state.quizzes[action.payload.quizId];
      if (!quiz) return state;
      const nextTracks = quiz.tracks.map((track) =>
        track.id === action.payload.trackId
          ? {
              ...track,
              startMs: Math.max(0, Math.min(action.payload.startMs, track.durationMs)),
              endMs: Math.max(0, Math.min(action.payload.endMs, track.durationMs))
            }
          : track
      );
      return {
        ...state,
        quizzes: {
          ...state.quizzes,
          [quiz.id]: { ...quiz, tracks: nextTracks }
        }
      };
    }
    case "updateTrackCover": {
      const quiz = state.quizzes[action.payload.quizId];
      if (!quiz) return state;
      const nextTracks = quiz.tracks.map((track) =>
        track.id === action.payload.trackId ? { ...track, coverUrl: action.payload.coverUrl } : track
      );
      return {
        ...state,
        quizzes: {
          ...state.quizzes,
          [quiz.id]: { ...quiz, tracks: nextTracks }
        }
      };
    }
    case "removeTrack": {
      const quiz = state.quizzes[action.payload.quizId];
      if (!quiz) return state;
      const nextTracks = quiz.tracks.filter((track) => track.id !== action.payload.trackId).map((track, index) => ({
        ...track,
        order: index
      }));
      return {
        ...state,
        quizzes: {
          ...state.quizzes,
          [quiz.id]: { ...quiz, tracks: nextTracks }
        }
      };
    }
    case "reorderTrack": {
      const quiz = state.quizzes[action.payload.quizId];
      if (!quiz) return state;
      const nextTracks = reorderTracks(quiz.tracks, action.payload.trackId, action.payload.direction);
      return {
        ...state,
        quizzes: {
          ...state.quizzes,
          [quiz.id]: { ...quiz, tracks: nextTracks }
        }
      };
    }
    default:
      return state;
  }
}

export const QuizProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { supabase, session } = useAuth();
  const [state, dispatch] = useReducer(quizReducer, initialState);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!session?.user) {
        dispatch({ type: "hydrate", payload: { quizzes: {}, currentQuizId: undefined } });
        dispatch({ type: "setStatus", payload: "idle" });
        dispatch({ type: "setError", payload: undefined });
        return;
      }

      dispatch({ type: "setStatus", payload: "loading" });
      dispatch({ type: "setError", payload: undefined });

      try {
        const quizzes = await fetchRemoteQuizzes(supabase, session.user.id);
        if (cancelled) return;
        const quizRecord = quizzes.reduce<Record<string, Quiz>>((acc, quiz) => {
          acc[quiz.id] = quiz;
          return acc;
        }, {});
        dispatch({
          type: "hydrate",
          payload: { quizzes: quizRecord, currentQuizId: resolveCurrentQuizId(quizzes, state.currentQuizId) }
        });
        dispatch({ type: "setStatus", payload: "ready" });
      } catch (error) {
        if (cancelled) return;
        dispatch({
          type: "setError",
          payload: error instanceof Error ? error.message : "Failed to load quizzes"
        });
        dispatch({ type: "setStatus", payload: "error" });
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, supabase]);

  return (
    <QuizStateContext.Provider value={state}>
      <QuizDispatchContext.Provider value={dispatch}>{children}</QuizDispatchContext.Provider>
    </QuizStateContext.Provider>
  );
};

function useQuizDispatch() {
  const dispatch = useContext(QuizDispatchContext);
  if (!dispatch) {
    throw new Error("useQuizDispatch must be used within QuizProvider");
  }
  return dispatch;
}

export function useQuizState() {
  const state = useContext(QuizStateContext);
  if (!state) {
    throw new Error("useQuizState must be used within QuizProvider");
  }
  return state;
}

export function useQuizActions() {
  const dispatch = useQuizDispatch();
  const { supabase, session } = useAuth();
  const state = useQuizState();

  async function reload() {
    if (!session?.user) return;
    dispatch({ type: "setStatus", payload: "loading" });
    try {
      const quizzes = await fetchRemoteQuizzes(supabase, session.user.id);
      const quizRecord = quizzes.reduce<Record<string, Quiz>>((acc, quiz) => {
        acc[quiz.id] = quiz;
        return acc;
      }, {});
      dispatch({
        type: "hydrate",
        payload: { quizzes: quizRecord, currentQuizId: resolveCurrentQuizId(quizzes, state.currentQuizId) }
      });
      dispatch({ type: "setStatus", payload: "ready" });
    } catch (error) {
      dispatch({
        type: "setError",
        payload: error instanceof Error ? error.message : "Failed to load quizzes"
      });
      dispatch({ type: "setStatus", payload: "error" });
    }
  }

  function ensureSession() {
    if (!session?.user) {
      dispatch({ type: "setError", payload: "Please sign in to manage quizzes." });
      return false;
    }
    return true;
  }

  return {
    async createQuiz(name: string) {
      if (!ensureSession()) return;
      const id = crypto.randomUUID();
      const quiz: Quiz = {
        id,
        name,
        createdAt: new Date().toISOString(),
        tracks: []
      };
      dispatch({ type: "createQuiz", payload: quiz });
      try {
        await createRemoteQuiz(supabase, session.user.id, quiz);
      } catch (error) {
        dispatch({
          type: "setError",
          payload: error instanceof Error ? error.message : "Unable to create quiz"
        });
        await reload();
      }
    },
    async removeQuiz(id: string) {
      if (!ensureSession()) return;
      dispatch({ type: "removeQuiz", payload: { id } });
      try {
        await deleteRemoteQuiz(supabase, id, session.user.id);
      } catch (error) {
        dispatch({
          type: "setError",
          payload: error instanceof Error ? error.message : "Unable to remove quiz"
        });
        await reload();
      }
    },
    setCurrentQuiz(id?: string) {
      dispatch({ type: "setCurrentQuiz", payload: { id } });
    },
    async addTrack(quizId: string, track: Omit<Track, "order">) {
      if (!ensureSession()) return;
      const currentQuiz = state.quizzes[quizId];
      const nextOrder = currentQuiz ? currentQuiz.tracks.length : 0;
      dispatch({ type: "addTrack", payload: { quizId, track: { ...track, order: nextOrder } } });
      try {
        await addRemoteTrack(supabase, quizId, track, nextOrder);
      } catch (error) {
        dispatch({
          type: "setError",
          payload: error instanceof Error ? error.message : "Unable to add track"
        });
        await reload();
      }
    },
    async updateTrackRange(quizId: string, trackId: string, startMs: number, endMs: number) {
      if (!ensureSession()) return;
      dispatch({ type: "updateTrackRange", payload: { quizId, trackId, startMs, endMs } });
      try {
        await updateRemoteTrackRange(supabase, trackId, startMs, endMs);
      } catch (error) {
        dispatch({
          type: "setError",
          payload: error instanceof Error ? error.message : "Unable to update range"
        });
        await reload();
      }
    },
    async updateTrackCover(quizId: string, trackId: string, coverUrl?: string) {
      if (!ensureSession()) return;
      dispatch({ type: "updateTrackCover", payload: { quizId, trackId, coverUrl } });
      try {
        await updateRemoteTrackCover(supabase, trackId, coverUrl);
      } catch (error) {
        dispatch({
          type: "setError",
          payload: error instanceof Error ? error.message : "Unable to update cover"
        });
        await reload();
      }
    },
    async removeTrack(quizId: string, trackId: string) {
      if (!ensureSession()) return;
      dispatch({ type: "removeTrack", payload: { quizId, trackId } });
      try {
        await deleteRemoteTrack(supabase, trackId);
      } catch (error) {
        dispatch({
          type: "setError",
          payload: error instanceof Error ? error.message : "Unable to remove track"
        });
        await reload();
      }
    },
    async reorderTrack(quizId: string, trackId: string, direction: "up" | "down") {
      if (!ensureSession()) return;
      dispatch({ type: "reorderTrack", payload: { quizId, trackId, direction } });
      const currentQuiz = state.quizzes[quizId];
      if (!currentQuiz || currentQuiz.tracks.length === 0) return;
      const orderedTracks = reorderTracks(currentQuiz.tracks, trackId, direction);
      if (orderedTracks.length === 0) return;
      try {
        await updateRemoteTrackOrders(supabase, quizId, orderedTracks);
      } catch (error) {
        dispatch({
          type: "setError",
          payload: error instanceof Error ? error.message : "Unable to reorder track"
        });
        await reload();
      }
    },
    reload
  };
}

export type QuizActions = ReturnType<typeof useQuizActions>;
