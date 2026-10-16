/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TWELVE_DATA_API_KEY: string;
  readonly VITE_POCKETBASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}