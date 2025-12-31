const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

export type SpotifyTrack = {
  id: string;
  uri: string;
  name: string;
  artists: { name: string }[];
  duration_ms: number;
  album: {
    images: { url: string; width: number; height: number }[];
  };
};

type SearchResponse = {
  tracks: {
    items: SpotifyTrack[];
  };
};

export function createSpotifyClient(accessToken: string) {
  async function request<T>(path: string, params?: Record<string, string | number>) {
    const query = params ? `?${new URLSearchParams(params as Record<string, string>)}` : "";
    const response = await fetch(`${SPOTIFY_API_BASE}${path}${query}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      throw new Error(`Spotify request failed: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as T;
  }

  async function searchTracks(query: string) {
    if (!query.trim()) return [];
    const raw = await request<SearchResponse>("/search", { q: query, type: "track", limit: 10 });
    return raw.tracks.items;
  }

  async function getTrack(id: string) {
    return request<SpotifyTrack>(`/tracks/${id}`);
  }

  return {
    searchTracks,
    getTrack
  };
}
