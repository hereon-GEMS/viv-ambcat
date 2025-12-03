import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import fs from "fs";
import path from "path";
import os from "os";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    tailwindcss({
      // Disable Lightning CSS optimization
      optimize: false,
    }),
  ],
  server: {
    https: {
      key: fs.readFileSync(
        path.resolve(os.homedir(), "server_keys/server-key.pem"),
      ),
      cert: fs.readFileSync(
        path.resolve(os.homedir(), "server_keys/all-cert-AMBCAT.pem"),
      ),
    },
    host: true,
    port: 5173, // or your preferred port
  },
});
