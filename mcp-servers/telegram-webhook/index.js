/**
 * Telegram → Paperclip Wakeup Bridge
 *
 * Receives Telegram webhook updates and wakes the CEO agent
 * when a message arrives in the group chat.
 *
 * Usage:
 *   TELEGRAM_BOT_TOKEN=xxx CEO_AGENT_ID=xxx PAPERCLIP_URL=http://localhost:4444 node index.js
 */

import http from "node:http";

const {
  TELEGRAM_BOT_TOKEN,
  CEO_AGENT_ID,
  PAPERCLIP_URL = "http://localhost:4444",
  TELEGRAM_CHAT_ID,
  PORT = "3088",
} = process.env;

if (!TELEGRAM_BOT_TOKEN || !CEO_AGENT_ID) {
  console.error("Required: TELEGRAM_BOT_TOKEN, CEO_AGENT_ID");
  process.exit(1);
}

const chatId = TELEGRAM_CHAT_ID ? Number(TELEGRAM_CHAT_ID) : null;

async function wakeCEO(message) {
  const from = message.from?.first_name || "Unknown";
  const text = message.text || "(media/sticker)";

  console.log(`[${new Date().toISOString()}] Message from ${from}: ${text.slice(0, 80)}`);

  try {
    const res = await fetch(`${PAPERCLIP_URL}/api/agents/${CEO_AGENT_ID}/wakeup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: "telegram_message",
        context: `Telegram message from ${from}: ${text.slice(0, 200)}`,
      }),
    });
    const data = await res.json();
    console.log(`  → CEO wakeup: ${res.status} ${data.id ? "queued" : data.error || "?"}`);
  } catch (err) {
    console.error(`  → CEO wakeup failed: ${err.message}`);
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/webhook") {
    let body = "";
    for await (const chunk of req) body += chunk;

    try {
      const update = JSON.parse(body);
      const message = update.message || update.edited_message;

      if (message) {
        // Skip bot's own messages
        if (message.from?.is_bot) {
          res.writeHead(200).end("ok");
          return;
        }
        // If TELEGRAM_CHAT_ID set, only wake for that chat
        if (chatId && message.chat?.id !== chatId) {
          res.writeHead(200).end("ok");
          return;
        }
        await wakeCEO(message);
      }
    } catch (err) {
      console.error("Parse error:", err.message);
    }

    res.writeHead(200).end("ok");
  } else if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200).end(JSON.stringify({ status: "ok", uptime: process.uptime() }));
  } else {
    res.writeHead(404).end("not found");
  }
});

server.listen(Number(PORT), "127.0.0.1", () => {
  console.log(`Telegram webhook bridge listening on :${PORT}`);
  console.log(`CEO agent: ${CEO_AGENT_ID}`);
  console.log(`Paperclip: ${PAPERCLIP_URL}`);
  console.log(`Chat filter: ${chatId || "all chats"}`);
  console.log("");
  console.log("Next steps:");
  console.log(`1. Expose this port via ngrok/cloudflared: ngrok http ${PORT}`);
  console.log(`2. Set webhook: curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=<YOUR_PUBLIC_URL>/webhook"`);
});
