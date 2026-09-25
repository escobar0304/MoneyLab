/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Port the sandboxed market embed is published on. Unset means same-origin,
   * which is safe but cannot draw the chart — see lib/markets/embedOrigin.ts. */
  readonly VITE_EMBED_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
