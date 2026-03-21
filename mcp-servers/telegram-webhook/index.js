/**
 * AmriTech Telegram Command Router
 *
 * Routes Telegram messages to agents via Paperclip wakeup API.
 * Also creates tasks so agents have context when they wake up.
 *
 * Commands:
 *   /ceo <message>     → CEO (default without command)
 *   /staff <question>  → Staff Manager (help, agent info)
 *   /hunter <task>     → Hunter (find leads)
 *   /sdr <task>        → SDR (write emails)
 *   /closer <task>     → Closer (meeting prep)
 *   /gov <task>        → Gov Scout (tenders)
 *   /proposal <task>   → Proposal Writer
 *   /contract <task>   → Contract Manager
 *   /finance <task>    → Finance Tracker
 *   /legal <task>      → Legal Assistant
 *   /onboard <task>    → Onboarding Agent
 *   /help              → Show commands
 *
 * Dedup: tracks message IDs to prevent double-processing.
 */

import http from "node:http";

const {
  TELEGRAM_BOT_TOKEN,
  PAPERCLIP_URL = "http://localhost:4444",
  COMPANY_ID,
  TELEGRAM_CHAT_ID,
  PORT = "3088",
} = process.env;

if (!TELEGRAM_BOT_TOKEN || !COMPANY_ID) {
  console.error("Required: TELEGRAM_BOT_TOKEN, COMPANY_ID");
  process.exit(1);
}

const chatId = TELEGRAM_CHAT_ID ? Number(TELEGRAM_CHAT_ID) : null;

// Team member mapping: TG username → real name + role
const TEAM_MEMBERS = {
  "tr00x": { name: "Tim", role: "AI/Automation & Dev", handle: "@tr00x" },
  "ikberik": { name: "Berik", role: "CEO", handle: "@ikberik" },
  "ula_placeholder": { name: "Ula", role: "Account Manager", handle: "@ula_placeholder" },
};

function resolveTeamMember(tgMessage) {
  const username = tgMessage.from?.username;
  if (username && TEAM_MEMBERS[username]) {
    return TEAM_MEMBERS[username];
  }
  // Fallback: use first_name but warn
  return { name: tgMessage.from?.first_name || "Unknown", role: "team", handle: `@${username || "unknown"}` };
}

// Dedup: track processed message IDs (last 500)
const processedMessages = new Set();
const MAX_DEDUP = 500;

function isDuplicate(messageId) {
  if (processedMessages.has(messageId)) return true;
  processedMessages.add(messageId);
  if (processedMessages.size > MAX_DEDUP) {
    const first = processedMessages.values().next().value;
    processedMessages.delete(first);
  }
  return false;
}

// Agent ID cache
let agentMap = {};

async function loadAgents() {
  try {
    const res = await fetch(`${PAPERCLIP_URL}/api/companies/${COMPANY_ID}/agents`);
    const agents = await res.json();
    for (const a of agents) {
      const slug = a.urlKey || a.name || "";
      agentMap[slug] = a.id;
    }
    console.log(`Loaded ${Object.keys(agentMap).length} agents`);
  } catch (err) {
    console.error("Failed to load agents:", err.message);
  }
}

// Command routing
const COMMANDS = {
  "/ceo": { agent: "ceo", emoji: "👑", name: "CEO" },
  "/staff": { agent: "staff-manager", emoji: "🛟", name: "Staff Manager" },
  "/hunter": { agent: "hunter", emoji: "🔍", name: "Hunter" },
  "/sdr": { agent: "sdr", emoji: "📧", name: "SDR" },
  "/closer": { agent: "closer", emoji: "🤝", name: "Closer" },
  "/gov": { agent: "gov-scout", emoji: "🏛️", name: "Gov Scout" },
  "/proposal": { agent: "proposal-writer", emoji: "📝", name: "Proposal Writer" },
  "/contract": { agent: "contract-manager", emoji: "📋", name: "Contract Manager" },
  "/finance": { agent: "finance-tracker", emoji: "💰", name: "Finance Tracker" },
  "/legal": { agent: "legal-assistant", emoji: "⚖️", name: "Legal Assistant" },
  "/onboard": { agent: "onboarding-agent", emoji: "🚀", name: "Onboarding Agent" },
};

function parseCommand(text) {
  if (!text) return { slug: "ceo", message: "", cmd: COMMANDS["/ceo"] };
  const lower = text.toLowerCase().trim();
  for (const [prefix, cmd] of Object.entries(COMMANDS)) {
    if (lower.startsWith(prefix)) {
      return { slug: cmd.agent, message: text.slice(prefix.length).trim(), cmd };
    }
  }
  return { slug: "ceo", message: text, cmd: COMMANDS["/ceo"] };
}

async function createTaskAndWake(agentSlug, cmd, from, text, member) {
  const agentId = agentMap[agentSlug];
  if (!agentId) {
    await sendTelegram(`❌ Агент "${agentSlug}" не найден`);
    return;
  }

  const ts = new Date().toISOString().slice(0, 16);
  console.log(`[${ts}] ${from} → ${cmd.emoji} ${cmd.name}: ${text.slice(0, 80)}`);

  // Create a task so the agent has context
  let taskId = null;
  try {
    const res = await fetch(`${PAPERCLIP_URL}/api/companies/${COMPANY_ID}/issues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `[TG] ${text.slice(0, 80)}`,
        description: `**Сообщение из Telegram от ${from}:**\n\n${text}\n\n---\n_Получено: ${ts}_`,
        priority: "medium",
        assigneeAgentId: agentId,
        status: "todo",
      }),
    });
    const task = await res.json();
    taskId = task.id;
    console.log(`  → Task created: ${task.identifier || "?"}`);
  } catch (err) {
    console.error(`  → Task creation failed: ${err.message}`);
  }

  // Wake the agent
  try {
    const res = await fetch(`${PAPERCLIP_URL}/api/agents/${agentId}/wakeup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: "telegram_message",
        context: `Telegram from ${from}: ${text.slice(0, 500)}`,
      }),
    });
    const data = await res.json();

    if (res.ok) {
      await sendTelegram(`${cmd.emoji} <b>${cmd.name}</b> принял задачу от <b>${member.name}</b>\n\n<i>${text.slice(0, 200)}</i>`);
    } else {
      await sendTelegram(`⚠️ ${cmd.name}: ${data.error || "ошибка"}`);
    }
  } catch (err) {
    console.error(`  → Wakeup error: ${err.message}`);
  }
}

async function sendTelegram(text) {
  if (!chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
  } catch {}
}

async function handleHelp() {
  await sendTelegram(`🤖 <b>AmriTech AI Штаб</b>

<b>Команды:</b>
/ceo — Координатор (по умолчанию)
/staff — Справка по агентам и системе
/hunter — Поиск лидов
/sdr — Cold emails
/closer — Подготовка к звонкам
/gov — Тендеры (SAM.gov)
/proposal — Proposals и RFP
/contract — Контракты и renewals
/finance — Финансы и инвойсы
/legal — Юридические вопросы
/onboard — Онбординг клиентов

<b>Примеры:</b>
<code>/staff что может SDR?</code>
<code>/ceo найди 10 заводов в Hoboken NJ</code>
<code>/hunter юрфирмы в Bergen County</code>
<code>/sdr напиши email для ABC Corp</code>

Без команды → CEO`);
}

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/webhook") {
    let body = "";
    for await (const chunk of req) body += chunk;

    try {
      const update = JSON.parse(body);
      const message = update.message || update.edited_message;

      if (message) {
        if (message.from?.is_bot) { res.writeHead(200).end("ok"); return; }
        if (chatId && message.chat?.id !== chatId) { res.writeHead(200).end("ok"); return; }
        if (isDuplicate(message.message_id)) { res.writeHead(200).end("ok"); return; }

        const text = message.text || "";
        const member = resolveTeamMember(message);
        const from = `${member.name} (${member.role}, ${member.handle})`;

        if (text.toLowerCase().startsWith("/help") || text.toLowerCase().startsWith("/start")) {
          await handleHelp();
        } else {
          const { slug, message: agentMsg, cmd } = parseCommand(text);
          if (agentMsg) {
            await createTaskAndWake(slug, cmd, from, agentMsg, member);
          } else {
            await sendTelegram(`${cmd.emoji} Напиши сообщение после команды.\nПример: <code>${Object.keys(COMMANDS).find(k => COMMANDS[k].agent === slug)} текст задачи</code>`);
          }
        }
      }
    } catch (err) {
      console.error("Error:", err.message);
    }

    res.writeHead(200).end("ok");
  } else if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200).end(JSON.stringify({ status: "ok", uptime: process.uptime(), agents: Object.keys(agentMap).length }));
  } else {
    res.writeHead(404).end("not found");
  }
});

await loadAgents();
server.listen(Number(PORT), "127.0.0.1", () => {
  console.log(`\n🤖 AmriTech Telegram Command Router`);
  console.log(`   Port: ${PORT} | Agents: ${Object.keys(agentMap).length}`);
  console.log(`   Commands: ${Object.keys(COMMANDS).join(", ")}, /help`);
  console.log(`   Default: CEO | Dedup: ON\n`);
});
