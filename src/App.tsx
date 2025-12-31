import { useState } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import {
  AppShell,
  Group,
  Title,
  Button,
  Menu,
  Container,
  Box,
  Stack,
  Text,
  ActionIcon
} from "@mantine/core";
import { useQuizActions, useQuizState } from "./providers/QuizProvider";
import { useAuth } from "./providers/AuthProvider";
import { LoginPage } from "./pages/LoginPage";
import { QuizListPage } from "./pages/QuizListPage";
import { QuizDetailPage } from "./pages/QuizDetailPage";
import { AddTrackPage } from "./pages/AddTrackPage";

function QuizLayout() {
  const quizState = useQuizState();
  const actions = useQuizActions();
  const navigate = useNavigate();
  const { session, signOut, error: authError } = useAuth();

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  const [showHeaderMenu, setShowHeaderMenu] = useState(false);

  return (
    <AppShell
      header={{
        height: 64
      }}
      padding={0}
    >
      <AppShell.Header>
        <Container size="md" px="md" style={{ height: "100%" }}>
          <Group h="100%" justify="space-between">
            <Group gap="sm">
              <Button variant="subtle" onClick={() => navigate("/")}>
                Home
              </Button>
              <Title order={4}>Spotify Quiz Builder</Title>
            </Group>
            <Menu opened={showHeaderMenu} onChange={setShowHeaderMenu} withinPortal>
              <Menu.Target>
                <ActionIcon variant="subtle" size="lg" aria-label="More options">
                  ⋯
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={() => signOut()} color="red">
                  Log out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
          {authError && (
            <Text c="red" fz="sm" mt="xs" role="alert">
              {authError}
            </Text>
          )}
        </Container>
      </AppShell.Header>
      <AppShell.Main>
        <Container size="md" px="md" py="md">
          <Routes>
            <Route
              path="/"
              element={
                <Stack gap="md" mt="md">
                  <QuizListPage
                    quizzes={quizState.quizzes}
                    currentQuizId={quizState.currentQuizId}
                    status={quizState.status}
                    error={quizState.error}
                    onCreate={(name) => actions.createQuiz(name)}
                    onSelect={(id) => {
                      actions.setCurrentQuiz(id);
                      if (id) navigate(`/quiz/${id}`);
                    }}
                    onDelete={actions.removeQuiz}
                  />
                </Stack>
              }
            />
            <Route path="/quiz/:quizId" element={<QuizDetailRoute />} />
            <Route path="/quiz/:quizId/add" element={<AddTrackRoute />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}

function QuizDetailRoute() {
  const { quizId } = useParams();
  const quizState = useQuizState();
  const actions = useQuizActions();
  const quiz = quizId ? quizState.quizzes[quizId] : undefined;

  return <QuizDetailPage quiz={quiz} actions={actions} status={quizState.status} error={quizState.error} />;
}

function AddTrackRoute() {
  const { quizId } = useParams();
  const quizState = useQuizState();
  const actions = useQuizActions();
  const quiz = quizId ? quizState.quizzes[quizId] : undefined;
  return <AddTrackPage quiz={quiz} actions={actions} />;
}

function App() {
  const { session, loading: authLoading, signInWithSpotify, error: authError } = useAuth();

  if (authLoading) {
    return <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>Checking session...</div>;
  }

  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage onLogin={signInWithSpotify} error={authError} />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/*" element={<QuizLayout />} />
    </Routes>
  );
}

export default App;
