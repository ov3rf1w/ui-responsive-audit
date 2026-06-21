import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const root = path.resolve(process.env.ROOT || "out");
const port = Number(process.env.PORT || 3100);

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
};

function resolveRequest(urlPath) {
  const decoded = decodeURIComponent((urlPath || "/").split("?")[0]);
  const safePath = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const candidate = path.join(root, safePath);

  for (const file of [candidate, path.join(candidate, "index.html"), `${candidate}.html`]) {
    try {
      const stat = statSync(file);
      if (stat.isFile() && file.startsWith(root)) return file;
    } catch {}
  }

  return path.join(root, "404.html");
}

createServer((request, response) => {
  const file = resolveRequest(request.url);
  const extension = path.extname(file);

  try {
    statSync(file);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(file.endsWith("404.html") ? 404 : 200, {
    "cache-control": "no-store",
    "content-type": types[extension] || "application/octet-stream",
  });
  const stream = createReadStream(file);
  stream.on("error", () => {
    if (!response.headersSent) {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    }
    response.end("Read error");
  });
  response.on("error", () => stream.destroy());
  response.on("close", () => stream.destroy());
  stream.pipe(response);
}).listen(port, () => {
  console.log(`Serving ${root} at http://localhost:${port}`);
});
