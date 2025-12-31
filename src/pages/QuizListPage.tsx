import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Group, Button, Text, Stack, TextInput, Menu, ActionIcon, Badge, Paper } from "@mantine/core";
import { Quiz } from "../types/quiz";

type Props = {
  quizzes: Record<string, Quiz>;
  currentQuizId?: string;
  status: "idle" | "loading" | "ready" | "error";
  error?: string;
  onCreate: (name: string) => Promise<void> | void;
  onSelect: (id?: string) => void;
  onDelete: (id: string) => Promise<void> | void;
};

export function QuizListPage({ quizzes, currentQuizId, status, error, onCreate, onSelect, onDelete }: Props) {
  const [name, setName] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const sortedQuizzes = Object.values(quizzes).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const isBusy = status === "loading";
  const navigate = useNavigate();

  function closeMenus() {
    setOpenMenuId(null);
  }

  function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim());
    setName("");
  }

  const hasQuizzes = sortedQuizzes.length > 0;

  return (
    <Paper withBorder shadow="xs" radius="md" p="sm">
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Text fw={600}>{hasQuizzes ? "Pick a quiz" : "Create a quiz"}</Text>
          {status === "loading" && <Badge variant="light">Loading…</Badge>}
        </Group>
        <form onSubmit={handleCreate} style={{ display: "flex", gap: "0.5rem" }} onClick={(e) => e.stopPropagation()}>
          <TextInput
            placeholder="New quiz name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Button type="submit" loading={isBusy}>
            Create
          </Button>
        </form>
        {error && (
          <Text c="red" fz="sm" role="alert">
            {error}
          </Text>
        )}
        {hasQuizzes ? (
          <Stack gap="xs" onClick={closeMenus}>
            {sortedQuizzes.map((quiz) => (
              <Paper
                key={quiz.id}
                withBorder
                radius="md"
                p="sm"
                style={{ cursor: "pointer", background: quiz.id === currentQuizId ? "#f6f9ff" : "white" }}
                onClick={() => {
                  onSelect(quiz.id);
                  navigate(`/quiz/${quiz.id}`);
                }}
              >
                <Group justify="space-between">
                  <div>
                    <Text fw={600}>{quiz.name}</Text>
                    <Text fz="xs" c="dimmed">
                      {new Date(quiz.createdAt).toLocaleDateString()}
                    </Text>
                  </div>
                  <Group gap="xs">
                    <Menu opened={openMenuId === quiz.id} onChange={() => setOpenMenuId((prev) => (prev === quiz.id ? null : quiz.id))} withinPortal>
                      <Menu.Target>
                        <ActionIcon
                          variant="subtle"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId((prev) => (prev === quiz.id ? null : quiz.id));
                          }}
                        >
                          ⋯
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(quiz.id);
                            setOpenMenuId(null);
                          }}
                          color="red"
                        >
                          Delete
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                    <Button
                      size="compact-sm"
                      variant="light"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/play?quiz=${quiz.id}`);
                      }}
                    >
                      Play
                    </Button>
                  </Group>
                </Group>
              </Paper>
            ))}
          </Stack>
        ) : (
          status !== "loading" && <Text c="dimmed">No quizzes yet. Create one to start adding tracks.</Text>
        )}
      </Stack>
    </Paper>
  );
}
