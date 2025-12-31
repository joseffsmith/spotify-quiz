export type Track = {
  id: string;
  uri: string;
  name: string;
  artists: string;
  durationMs: number;
  startMs: number;
  endMs: number;
  order: number;
  coverUrl?: string;
};

export type Quiz = {
  id: string;
  name: string;
  tracks: Track[];
  createdAt: string;
};
