/**
 * Whisper Transcription Service
 * Runs on HOST (not Docker) — uses whisper.cpp binary at /usr/local/bin/whisper
 *
 * POST /transcribe — accepts JSON { filePath: "/tmp/amritech-tg-files/xxx.oga" }
 * Returns JSON { transcript: "..." } or { error: "..." }
 *
 * GET /health — returns { status: "ok" }
 */

import http from "node:http";
import { execSync } from "node:child_process";
import fs from "node:fs";

const PORT = process.env.WHISPER_PORT || "3090";
const MODEL = "/usr/local/share/whisper-cpp/ggml-base.bin";

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  if (req.method === "GET" && req.url === "/health") {
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (req.method === "POST" && req.url === "/transcribe") {
    let body = "";
    for await (const chunk of req) body += chunk;

    try {
      const { filePath } = JSON.parse(body);
      if (!filePath || !fs.existsSync(filePath)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "File not found: " + filePath }));
        return;
      }

      const wavPath = filePath.replace(/\.[^.]+$/, ".wav");
      const outPath = filePath.replace(/\.[^.]+$/, "");

      // Convert to 16kHz mono WAV
      execSync(`ffmpeg -i "${filePath}" -ar 16000 -ac 1 -y "${wavPath}" 2>/dev/null`, { timeout: 15000 });

      // Run whisper.cpp
      execSync(`whisper -m "${MODEL}" -l auto -otxt -of "${outPath}" "${wavPath}" 2>/dev/null`, { timeout: 30000 });

      const txtFile = outPath + ".txt";
      const transcript = fs.existsSync(txtFile) ? fs.readFileSync(txtFile, "utf8").trim() : "";

      // Cleanup temp files
      try { fs.unlinkSync(wavPath); } catch {}
      try { fs.unlinkSync(txtFile); } catch {}

      console.log(`Transcribed: ${transcript.slice(0, 80)}...`);
      res.end(JSON.stringify({ transcript }));
    } catch (err) {
      console.error(`Error: ${err.message}`);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(Number(PORT), "127.0.0.1", () => {
  console.log(`Whisper service on :${PORT}`);
});
