import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const obsidianApiKey = env.VITE_OBSIDIAN_API_KEY ?? "";

  return {
    plugins: [react()],
    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
    server: {
      port: 5173,
      cors: true,
      middlewareMode: false,
      hmr: {
        host: 'localhost',
        port: 5173,
        protocol: 'ws',
      },
      watch: {
        usePolling: true,
        interval: 100,
      },
      proxy: {
        "/obsidian-api": {
          target: "https://127.0.0.1:27124",
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/obsidian-api/, ""),
          configure: (proxy, _options) => {
            if (mode === 'development') {
              proxy.on("error", (err, _req, _res) => {
                console.warn("proxy error", err);
              });
              proxy.on("proxyReq", (proxyReq, req, _res) => {
                console.info("Sending Request to the Target:", req.method, req.url);
                if (obsidianApiKey) {
                  proxyReq.setHeader("Authorization", `Bearer ${obsidianApiKey}`);
                }
              });
              proxy.on("proxyRes", (proxyRes, req, _res) => {
                console.info("Received Response from the Target:", proxyRes.statusCode, req.url);
              });
            } else {
              proxy.on("proxyReq", (proxyReq) => {
                if (obsidianApiKey) {
                  proxyReq.setHeader("Authorization", `Bearer ${obsidianApiKey}`);
                }
              });
            }
          },
        },
      },
    },
  };
});
