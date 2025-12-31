import React from "react";
import ReactDOM from "react-dom/client";
import "@mantine/core/styles.css";
import { QuizProvider } from "./providers/QuizProvider";
import { AuthProvider } from "./providers/AuthProvider";
import App from "./App";
import { MantineProvider } from "@mantine/core";
import { SpotifyPlayerProvider } from "./providers/SpotifyPlayerProvider";
import { BrowserRouter } from "react-router-dom";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <MantineProvider withGlobalStyles withNormalizeCSS>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <AuthProvider>
          <SpotifyPlayerProvider>
            <QuizProvider>
              <App />
            </QuizProvider>
          </SpotifyPlayerProvider>
        </AuthProvider>
      </BrowserRouter>
    </MantineProvider>
  </React.StrictMode>
);
