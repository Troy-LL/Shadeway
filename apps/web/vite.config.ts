import { createReadStream, existsSync, statSync } from "node:fs";
import { cp } from "node:fs/promises";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGzip } from "node:zlib";
import type { Connect, Plugin } from "vite";
import { defineConfig } from "vite";

const dataDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../data/build/bgc");

function pilotData(): Plugin {
  const serve: Connect.NextHandleFunction = (request, response, next) => {
    const pathname = decodeURIComponent((request.url ?? "/").split("?")[0] ?? "/");
    const file = normalize(join(dataDir, pathname));
    if (!file.startsWith(dataDir) || !existsSync(file) || statSync(file).isDirectory()) {
      next();
      return;
    }
    const type = file.endsWith(".json") || file.endsWith(".geojson") ? "application/json" : "application/octet-stream";
    response.setHeader("Content-Type", type);
    response.setHeader("Cache-Control", "public, max-age=3600");
    const header = request.headers["accept-encoding"];
    const accept = Array.isArray(header) ? header.join(",") : header;
    if (accept?.includes("gzip")) {
      response.setHeader("Content-Encoding", "gzip");
      createReadStream(file).pipe(createGzip()).pipe(response);
      return;
    }
    createReadStream(file).pipe(response);
  };
  const mount = (server: { middlewares: Connect.Server }) => {
    server.middlewares.use("/data/bgc", serve);
  };
  return {
    name: "pilot-data",
    configureServer: mount,
    configurePreviewServer: mount,
    async writeBundle() {
      if (!existsSync(dataDir)) return;
      await cp(dataDir, resolve(dirname(fileURLToPath(import.meta.url)), "dist/data/bgc"), { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [pilotData()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
