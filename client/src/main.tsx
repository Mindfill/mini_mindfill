// main.tsx
import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import App from "./App";
import "./index.css";
import "@fontsource/opendyslexic/400.css";
import "@fontsource/opendyslexic/700.css";
import { PostHogProvider } from "posthog-js/react";

// Apply the saved dyslexia-font preference before first paint (no flash).
try {
    if (localStorage.getItem("dyslexia-font") === "1") {
        document.documentElement.classList.add("dyslexic");
    }
} catch {
    /* localStorage unavailable */
}

const options = {
    api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
    autocapture: true,            // optional, defaults to true
    disable_session_recording: false, // optional
  }  

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <PostHogProvider
        apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
        options={options}
      >
        <App />
      </PostHogProvider>
    </StrictMode>
  );
}

