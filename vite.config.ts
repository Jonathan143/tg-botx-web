import { readFileSync } from "node:fs";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const tlsCertificate = env.VITE_TLS_CERTIFICATE;
  const tlsPrivateKey = env.VITE_TLS_PRIVATE_KEY;

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: env.VITE_HOST || undefined,
      port: 8143,
      https:
        tlsCertificate && tlsPrivateKey
          ? { cert: readFileSync(tlsCertificate), key: readFileSync(tlsPrivateKey) }
          : undefined,
      proxy: {
        "/api": {
          target: env.VITE_API_PROXY_TARGET || "http://127.0.0.1:8000",
          changeOrigin: true,
        },
      },
    },
    resolve: {
      alias: {
        "@": new URL("./src", import.meta.url).pathname,
      },
    },
  };
});
