import { SupabaseClient } from "@supabase/supabase-js";
import { Quiz, Track } from "../types/quiz";

type QuizRow = {
  id: string;
  name: string;
  created_at: string;
  quiz_tracks?: QuizTrackRow[];
};

type QuizTrackRow = {
  id: string;
  quiz_id: string;
  uri: string;
  name: string;
  artists: string;
  duration_ms: number;
  start_ms: number;
  end_ms: number;
  order_index: number | null;
  preview_url: string | null;
};

function mapTrack(row: QuizTrackRow, fallbackIndex: number): Track {
  return {
    id: row.id,
    uri: row.uri,
    name: row.name,
    artists: row.artists,
    durationMs: row.duration_ms,
    startMs: row.start_ms,
    endMs: row.end_ms,
    order: row.order_index ?? fallbackIndex,
    coverUrl: row.preview_url || undefined
  };
}

function mapQuiz(row: QuizRow): Quiz {
  const tracks = (row.quiz_tracks ?? []).map((track, index) => mapTrack(track, index)).sort((a, b) => a.order - b.order);

  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    tracks
  };
}

export async function fetchRemoteQuizzes(client: SupabaseClient, userId: string) {
  const { data, error } = await client
    .from("quizzes")
    .select(
      `
      id,
      name,
      created_at,
      quiz_tracks (
        id,
        quiz_id,
        uri,
        name,
        artists,
        duration_ms,
        start_ms,
        end_ms,
        order_index,
        preview_url
      )
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapQuiz);
}

export async function createRemoteQuiz(client: SupabaseClient, userId: string, quiz: Quiz) {
  const { error } = await client.from("quizzes").insert({
    id: quiz.id,
    user_id: userId,
    name: quiz.name,
    created_at: quiz.createdAt
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteRemoteQuiz(client: SupabaseClient, quizId: string, userId: string) {
  const { error } = await client.from("quizzes").delete().eq("id", quizId).eq("user_id", userId);
  if (error) {
    throw new Error(error.message);
  }
}

export async function addRemoteTrack(client: SupabaseClient, quizId: string, track: Omit<Track, "order">, orderIndex: number) {
  const { error } = await client.from("quiz_tracks").insert({
    id: track.id,
    quiz_id: quizId,
    uri: track.uri,
    name: track.name,
    artists: track.artists,
    duration_ms: track.durationMs,
    start_ms: track.startMs,
    end_ms: track.endMs,
    order_index: orderIndex,
    preview_url: track.coverUrl ?? null
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateRemoteTrackRange(client: SupabaseClient, trackId: string, startMs: number, endMs: number) {
  const { error } = await client
    .from("quiz_tracks")
    .update({ start_ms: startMs, end_ms: endMs })
    .eq("id", trackId);
  if (error) {
    throw new Error(error.message);
  }
}

export async function updateRemoteTrackCover(client: SupabaseClient, trackId: string, coverUrl?: string) {
  const { error } = await client
    .from("quiz_tracks")
    .update({ preview_url: coverUrl ?? null })
    .eq("id", trackId);
  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteRemoteTrack(client: SupabaseClient, trackId: string) {
  const { error } = await client.from("quiz_tracks").delete().eq("id", trackId);
  if (error) {
    throw new Error(error.message);
  }
}

export async function updateRemoteTrackOrders(client: SupabaseClient, quizId: string, tracks: Track[]) {
  const updates = tracks.map((track, index) => ({
    id: track.id,
    quiz_id: quizId,
    uri: track.uri,
    name: track.name,
    artists: track.artists,
    duration_ms: track.durationMs,
    start_ms: track.startMs,
    end_ms: track.endMs,
    order_index: index,
    preview_url: track.coverUrl ?? null
  }));

  if (updates.length === 0) {
    return;
  }

  const { error } = await client.from("quiz_tracks").upsert(updates, { onConflict: "id" });
  if (error) {
    throw new Error(error.message);
  }
}
