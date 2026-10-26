// Local dev server: serves public/ and routes /api/analyze to the Vercel handler.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import handler from "../api/analyze.js";

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const port = process.env.PORT || 3000;

http.createServer(async (req, res) => {
  if (req.url.startsWith("/api/analyze")) {
    let body = "";
    for await (const chunk of req) body += chunk;
    req.body = body ? JSON.parse(body) : {};
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (obj) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(obj)); };
    return handler(req, res);
  }
  const path = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  try {
    const file = await readFile(join(dirname(fileURLToPath(import.meta.url)), "..", "public", path));
    res.setHeader("Content-Type", types[extname(path)] || "application/octet-stream");
    res.end(file);
  } catch {
    res.statusCode = 404; res.end("Not found");
  }
}).listen(port, () => console.log(`http://localhost:${port}`));
