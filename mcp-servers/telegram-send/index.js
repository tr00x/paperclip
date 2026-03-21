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

const transport = new StdioServerTransport();
await server.connect(transport);
