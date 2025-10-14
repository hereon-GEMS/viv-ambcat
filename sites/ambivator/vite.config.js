import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import fs from "fs";
import path from "path";
import os from "os";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    https: {
      key: fs.readFileSync(
        path.resolve(os.homedir(), "server_keys/server-key.pem")
      ),
      cert: fs.readFileSync(
        path.resolve(os.homedir(), "server_keys/server-cert-AMBCAT.pem")
      ),
    },
    host: true,
    port: 5173, // or your preferred port
  },
});
