// HTTP wrapper around notebook-to-svg.sh. POST image bytes, receive raw SVG.
//
// Env:
//   PORT       listen port (default 8080)
//   TOKEN      if set, requires Authorization: Bearer <TOKEN> on POST
//   MAX_BYTES  request body cap, default 10 MB
//   LEVEL, THRESHOLD, TURDSIZE, SMOOTH, MAX_WIDTH — passed to the script

import http from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = Number(process.env.PORT) || 8080;
const TOKEN = process.env.TOKEN || "";
const MAX_BYTES = Number(process.env.MAX_BYTES) || 10 * 1024 * 1024;
const SCRIPT = process.env.NOTEBOOK_SCRIPT || "/app/notebook-to-svg.sh";

const server = http.createServer((req, res) => {
    if (req.method === "GET" && (req.url === "/health" || req.url === "/")) {
        res.writeHead(200, { "content-type": "text/plain" });
        res.end("ok\n");
        return;
    }

    if (req.method !== "POST") {
        res.writeHead(405, { "content-type": "text/plain", allow: "POST" });
        res.end("POST an image body to receive an SVG.\n");
        return;
    }

    if (TOKEN && req.headers.authorization !== `Bearer ${TOKEN}`) {
        res.writeHead(401, { "content-type": "text/plain" });
        res.end("unauthorized\n");
        return;
    }

    const chunks = [];
    let total = 0;
    let aborted = false;

    req.on("data", (chunk) => {
        if (aborted) return;
        total += chunk.length;
        if (total > MAX_BYTES) {
            aborted = true;
            res.writeHead(413, { "content-type": "text/plain" });
            res.end(`payload exceeds ${MAX_BYTES} bytes\n`);
            req.destroy();
        } else {
            chunks.push(chunk);
        }
    });

    req.on("end", () => {
        if (aborted) return;
        if (total === 0) {
            res.writeHead(400, { "content-type": "text/plain" });
            res.end("empty body\n");
            return;
        }

        const dir = mkdtempSync(join(tmpdir(), "notebook-"));
        const inPath = join(dir, "input");
        writeFileSync(inPath, Buffer.concat(chunks));

        const proc = spawn(SCRIPT, [inPath], {
            env: {
                ...process.env,
                PATH: [
                    process.env.PATH,
                    "/opt/homebrew/bin",
                    "/usr/local/bin",
                    "/usr/bin",
                    "/bin",
                ]
                    .filter(Boolean)
                    .join(":"),
            },
        });

        let stdout = "";
        let stderr = "";
        proc.stdout.on("data", (d) => (stdout += d));
        proc.stderr.on("data", (d) => (stderr += d));

        proc.on("close", (code) => {
            rmSync(dir, { recursive: true, force: true });
            if (code === 0) {
                res.writeHead(200, {
                    "content-type": "image/svg+xml; charset=utf-8",
                    "cache-control": "no-store",
                });
                res.end(stdout.trim() + "\n");
            } else {
                console.error(`script exit ${code}: ${stderr.trim()}`);
                res.writeHead(500, { "content-type": "text/plain" });
                res.end(`conversion failed (exit ${code})\n${stderr}`);
            }
        });

        proc.on("error", (err) => {
            rmSync(dir, { recursive: true, force: true });
            console.error("spawn error:", err);
            if (!res.headersSent) {
                res.writeHead(500, { "content-type": "text/plain" });
                res.end(`spawn failed: ${err.message}\n`);
            }
        });
    });

    req.on("error", () => {
        if (!aborted) {
            aborted = true;
            if (!res.headersSent) res.writeHead(400).end();
        }
    });
});

server.listen(PORT, () => {
    console.log(`notebook-to-svg listening on :${PORT}`);
});

for (const sig of ["SIGTERM", "SIGINT"]) {
    process.on(sig, () => {
        server.close(() => process.exit(0));
    });
}
