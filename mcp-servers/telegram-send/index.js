#!/usr/bin/env node
/**
 * Minimal Telegram Send MCP — no polling, no conflicts.
 * Just sendMessage via Bot API. Works alongside webhooks.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const PAPERCLIP_URL = process.env.PAPERCLIP_URL || "http://localhost:4444";

if (!TOKEN) { console.error("TELEGRAM_BOT_TOKEN required"); process.exit(1); }

const server = new McpServer({ name: "telegram-send", version: "1.0.0" });

const TG_TASK_MAP_FILE = "/tmp/tg-task-map.json";

function loadTaskMap() {
  try { return JSON.parse(fs.readFileSync(TG_TASK_MAP_FILE, "utf8")); } catch { return {}; }
}

function saveTaskMap(map) {
  // Keep last 500 entries
  const entries = Object.entries(map);
  if (entries.length > 500) {
    map = Object.fromEntries(entries.slice(-500));
  }
  fs.writeFileSync(TG_TASK_MAP_FILE, JSON.stringify(map));
}

server.tool(
  "send_message",
  "Send a message to the AmriTech Telegram group chat. If task_id is provided, team can reply to this message to comment on that task.",
  {
    text: z.string().describe("Message text (supports HTML: <b>, <i>, <code>)"),
    chat_id: z.string().optional().describe("Chat ID (defaults to group)"),
    task_id: z.string().optional().describe("Paperclip task ID — links this TG message to the task so team replies become comments"),
  },
  async ({ text, chat_id, task_id }) => {
    const targetChat = chat_id || CHAT_ID;
    if (!targetChat) return { content: [{ type: "text", text: "No chat_id" }], isError: true };

    const payload = { chat_id: targetChat, text, parse_mode: "HTML" };

    // Add inline buttons if task_id provided
    if (task_id) {
      payload.reply_markup = {
        inline_keyboard: [
          [
            { text: "💬 Комментарий", callback_data: `comment:${task_id}` },
            { text: "✅ Done", callback_data: `status:done:${task_id}` },
            { text: "🔄 Progress", callback_data: `status:in_progress:${task_id}` },
          ],
          [
            { text: "🚫 Block", callback_data: `status:blocked:${task_id}` },
            { text: "⚡ Urgent", callback_data: `priority:urgent:${task_id}` },
          ],
        ]
      };
    }

    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.ok) {
      if (task_id) {
        const map = loadTaskMap();
        map[String(data.result.message_id)] = task_id;
        saveTaskMap(map);
      }
      return { content: [{ type: "text", text: `Sent (id: ${data.result.message_id})` }] };
    }
    return { content: [{ type: "text", text: `Error: ${data.description}` }], isError: true };
  }
);

import fs from "node:fs";
import path from "node:path";

server.tool(
  "send_document",
  "Send a document file to the AmriTech Telegram group chat",
  {
    file_path: z.string().describe("Absolute path to the file to send (e.g., /tmp/report.docx)"),
    caption: z.string().optional().describe("Caption text for the file (supports HTML)"),
    chat_id: z.string().optional().describe("Chat ID (defaults to group)"),
  },
  async ({ file_path: filePath, caption, chat_id }) => {
    const targetChat = chat_id || CHAT_ID;
    if (!targetChat) return { content: [{ type: "text", text: "No chat_id" }], isError: true };

    if (!fs.existsSync(filePath)) {
      return { content: [{ type: "text", text: `File not found: ${filePath}` }], isError: true };
    }

    try {
      const fileBuffer = fs.readFileSync(filePath);
      const fileName = path.basename(filePath);
      const blob = new Blob([fileBuffer]);

      const form = new FormData();
      form.append("chat_id", targetChat);
      form.append("document", blob, fileName);
      if (caption) {
        form.append("caption", caption);
        form.append("parse_mode", "HTML");
      }

      const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendDocument`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();

      if (data.ok) return { content: [{ type: "text", text: `Document sent: ${fileName} (id: ${data.result.message_id})` }] };
      return { content: [{ type: "text", text: `Error: ${data.description}` }], isError: true };
    } catch (err) {
      return { content: [{ type: "text", text: `Send error: ${err.message}` }], isError: true };
    }
  }
);

server.tool(
  "send_photo",
  "Send a photo to the AmriTech Telegram group chat",
  {
    file_path: z.string().describe("Absolute path to the image file (PNG, JPG, etc.)"),
    caption: z.string().optional().describe("Caption text for the photo (supports HTML)"),
    chat_id: z.string().optional().describe("Chat ID (defaults to group)"),
  },
  async ({ file_path: filePath, caption, chat_id }) => {
    const targetChat = chat_id || CHAT_ID;
    if (!targetChat) return { content: [{ type: "text", text: "No chat_id" }], isError: true };

    if (!fs.existsSync(filePath)) {
      return { content: [{ type: "text", text: `File not found: ${filePath}` }], isError: true };
    }

    try {
      const fileBuffer = fs.readFileSync(filePath);
      const fileName = path.basename(filePath);
      const blob = new Blob([fileBuffer]);

      const form = new FormData();
      form.append("chat_id", targetChat);
      form.append("photo", blob, fileName);
      if (caption) {
        form.append("caption", caption);
        form.append("parse_mode", "HTML");
      }

      const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();

      if (data.ok) return { content: [{ type: "text", text: `Photo sent: ${fileName} (id: ${data.result.message_id})` }] };
      return { content: [{ type: "text", text: `Error: ${data.description}` }], isError: true };
    } catch (err) {
      return { content: [{ type: "text", text: `Send error: ${err.message}` }], isError: true };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
