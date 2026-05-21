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
const MIN_BYTES = Number(process.env.MIN_BYTES) || 1024;
const SCRIPT = process.env.NOTEBOOK_SCRIPT || "/app/notebook-to-svg.sh";

/** @param {string | undefined} contentType */
function extFromContentType(contentType) {
    if (!contentType) return "";
    const t = contentType.split(";")[0].trim().toLowerCase();
    const map = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/heic": ".heic",
        "image/heif": ".heif",
        "image/gif": ".gif",
    };
    return map[t] || "";
}

/** @param {Buffer} buf */
function extFromMagic(buf) {
    if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
        return ".jpg";
    }
    if (
        buf.length >= 8 &&
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47
    ) {
        return ".png";
    }
    if (buf.length >= 12 && buf.toString("ascii", 4, 8) === "ftyp") {
        const brand = buf.toString("ascii", 8, 12);
        if (brand.startsWith("heic") || brand.startsWith("heif") || brand === "mif1") {
            return ".heic";
        }
    }
    if (
        buf.length >= 12 &&
        buf.toString("ascii", 0, 4) === "RIFF" &&
        buf.toString("ascii", 8, 12) === "WEBP"
    ) {
        return ".webp";
    }
    return "";
}

/** @param {Buffer} raw @param {string | undefined} contentType */
function extractImageBytes(raw, contentType) {
    const ct = contentType || "";
    if (!ct.toLowerCase().includes("multipart/form-data")) {
        return raw;
    }
    const boundaryMatch = /boundary=([^;\s]+)/i.exec(ct);
    if (!boundaryMatch) return raw;

    const boundary = boundaryMatch[1].replace(/^"|"$/g, "");
    const parts = raw.toString("binary").split(`--${boundary}`);
    for (const part of parts) {
        if (!part || part === "--\r\n" || part === "--") continue;
        const headerEnd = part.indexOf("\r\n\r\n");
        if (headerEnd === -1) continue;
        const headers = part.slice(0, headerEnd).toLowerCase();
        if (!headers.includes("content-disposition") || !headers.includes("filename")) {
            if (!headers.includes("content-type: image")) continue;
        }
        let body = part.slice(headerEnd + 4);
        if (body.endsWith("\r\n")) body = body.slice(0, -2);
        return Buffer.from(body, "binary");
    }
    return raw;
}

/** @param {Buffer} buf */
function resolveImageExt(buf, contentType) {
    const magic = extFromMagic(buf);
    const hinted = extFromContentType(contentType);
    if (magic) return magic;
    if (hinted) return hinted;
    return "";
}

/** @param {Buffer} buf @param {string} ext */
function validateImage(buf, ext) {
    if (buf.length < MIN_BYTES) {
        return `image too small (${buf.length} bytes); send raw photo bytes, not text or an error page`;
    }
    const magic = extFromMagic(buf);
    if (!magic) {
        return "unrecognized image format; POST raw JPEG/PNG/HEIC bytes (Shortcuts: Request Body = File)";
    }
    if (magic !== ext) {
        return `content looks like ${magic.slice(1)} but was labeled ${ext.slice(1)}; check Shortcut sends File not Form`;
    }
    return "";
}

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

        const raw = Buffer.concat(chunks);
        const body = extractImageBytes(raw, req.headers["content-type"]);
        const ext = resolveImageExt(body, req.headers["content-type"]);

        if (!ext) {
            res.writeHead(415, { "content-type": "text/plain" });
            res.end(
                "unsupported or missing image format\n" +
                    "POST raw image bytes with Content-Type image/jpeg (or use multipart File upload)\n",
            );
            return;
        }

        const validationError = validateImage(body, ext);
        if (validationError) {
            console.error(`reject upload (${body.length} bytes, ct=${req.headers["content-type"]}): ${validationError}`);
            res.writeHead(400, { "content-type": "text/plain" });
            res.end(`${validationError}\n`);
            return;
        }

        const dir = mkdtempSync(join(tmpdir(), "notebook-"));
        const inPath = join(dir, `input${ext}`);
        writeFileSync(inPath, body);

        const proc = spawn(SCRIPT, [inPath], {
            env: {
                ...process.env,
                PATH: ["/usr/local/bin", "/usr/bin", "/bin", "/opt/homebrew/bin", process.env.PATH]
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
