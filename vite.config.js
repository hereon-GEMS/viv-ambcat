import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "fs";
import path from "path";
import os from "os";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    https: {
      key: fs.readFileSync(
        path.resolve(os.homedir(), "server_keys/server-key.pem"),
      ),
      cert: fs.readFileSync(
        path.resolve(os.homedir(), "server_keys/all-cert-AMBCAT.pem"),
      ),
    },
  },
});
