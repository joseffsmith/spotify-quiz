import { useNavigate } from "react-router-dom";
import { Card, Group, Text, Button, Stack, Badge, Image } from "@mantine/core";
import { Quiz, Track } from "../types/quiz";
import { QuizActions } from "../providers/QuizProvider";
import { formatMs } from "../utils/time";

type Props = {
  quiz?: Quiz;
  actions: QuizActions;
  status: "idle" | "loading" | "ready" | "error";
  error?: string;
};

export function QuizDetailPage({ quiz, actions, status, error }: Props) {
  const navigate = useNavigate();

  if (!quiz) {
    return (
      <section style={{ border: "1px solid #ddd", padding: "1rem", borderRadius: 8, minHeight: 200 }}>
        <h2 style={{ marginTop: 0 }}>Quiz details</h2>
        <p>Select or create a quiz to start adding tracks.</p>
        {error && (
          <div style={{ color: "crimson", fontSize: 14 }} role="alert">
            {error}
          </div>
        )}
      </section>
    );
  }

  const sortedTracks = [...quiz.tracks].sort((a, b) => a.order - b.order);

  return (
    <Card withBorder padding="md" radius="md">
      <Group justify="space-between" align="center" mb="md">
        <div>
          <Text fw={700} fz="lg">
            {quiz.name}
          </Text>
          {status === "loading" && (
            <Badge variant="light" mt={4}>
              Syncing...
            </Badge>
          )}
        </div>
        <Button onClick={() => navigate(`/quiz/${quiz.id}/add`)} size="sm">
          Add track
        </Button>
      </Group>
      {error && (
        <Text c="red" fz="sm" mb="sm" role="alert">
          {error}
        </Text>
      )}
      {sortedTracks.length === 0 ? (
        <Text c="dimmed">No tracks yet. Add one to define the playback range.</Text>
      ) : (
        <Stack gap="sm">
          {sortedTracks.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              onRemove={() => actions.removeTrack(quiz.id, track.id)}
              onReorder={(direction) => actions.reorderTrack(quiz.id, track.id, direction)}
              onOpenAdd={(trackId) => navigate(`/quiz/${quiz.id}/add?trackId=${trackId}`)}
              coverUrl={track.coverUrl}
            />
          ))}
        </Stack>
      )}
    </Card>
  );
}

type TrackRowProps = {
  track: Track;
  onRemove: () => void;
  onReorder: (direction: "up" | "down") => void;
  onOpenAdd?: (trackId: string) => void;
  coverUrl?: string;
};

function TrackRow({
  track,
  onRemove,
  onReorder,
  onOpenAdd,
  coverUrl
}: TrackRowProps) {
  return (
    <Card
      withBorder
      padding="sm"
      radius="md"
      style={{ cursor: "pointer" }}
      onClick={() => onOpenAdd?.(track.id)}
    >
      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Group gap="sm" align="center">
            {coverUrl ? (
              <Image src={coverUrl} width={60} height={60} radius="md" alt="" fit="cover" />
            ) : (
              <div style={{ width: 60, height: 60, borderRadius: 12, background: "#f3f3f3" }} />
            )}
            <div>
              <Text fw={600}>{track.name}</Text>
              <Text fz="sm" c="dimmed">
                {track.artists}
              </Text>
              <Text fz="xs" c="dimmed">
                {formatMs(track.startMs)} – {formatMs(track.endMs)} · {formatMs(track.durationMs)} total
              </Text>
            </div>
          </Group>
          <Group gap="xs">
            <Button
              size="compact-sm"
              variant="subtle"
              onClick={(e) => {
                e.stopPropagation();
                onReorder("up");
              }}
            >
              ↑
            </Button>
            <Button
              size="compact-sm"
              variant="subtle"
              onClick={(e) => {
                e.stopPropagation();
                onReorder("down");
              }}
            >
              ↓
            </Button>
            <Button
              size="compact-sm"
              color="red"
              variant="light"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
            >
              Remove
            </Button>
          </Group>
        </Group>
      </Stack>
    </Card>
  );
}
