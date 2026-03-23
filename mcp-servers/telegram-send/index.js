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

if (!TOKEN) { console.error("TELEGRAM_BOT_TOKEN required"); process.exit(1); }

const server = new McpServer({ name: "telegram-send", version: "1.0.0" });

server.tool(
  "send_message",
  "Send a message to the AmriTech Telegram group chat",
  { text: z.string().describe("Message text (supports HTML: <b>, <i>, <code>)"), chat_id: z.string().optional().describe("Chat ID (defaults to group)") },
  async ({ text, chat_id }) => {
    const targetChat = chat_id || CHAT_ID;
    if (!targetChat) return { content: [{ type: "text", text: "No chat_id" }], isError: true };

    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: targetChat, text, parse_mode: "HTML" })
    });
    const data = await res.json();

    if (data.ok) return { content: [{ type: "text", text: `Sent (id: ${data.result.message_id})` }] };
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
