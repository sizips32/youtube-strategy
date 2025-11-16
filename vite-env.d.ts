/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly GEMINI_API_KEY?: string;
  readonly YOUTUBE_API_KEY?: string;
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_YOUTUBE_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
