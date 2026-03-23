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
 * Quick Commands (no agent wake — instant response):
 *   /status            → Agent health + pipeline summary
 *   /pipeline          → CRM pipeline by status
 *   /leads             → Lead counts by outreach status
 *   /fix <issue>       → IT Chef diagnostic task
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
  "UlaAmri": { name: "Ula", role: "Account Manager", handle: "@UlaAmri" },
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
  "/chef": { agent: "it-chef", emoji: "🔧", name: "IT Chef" },
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

// ---------- File handling ----------

const FILE_DIR = "/tmp/amritech-tg-files";
import fs from "node:fs";
import path from "node:path";

// Ensure file directory exists
try { fs.mkdirSync(FILE_DIR, { recursive: true }); } catch {}

async function downloadTelegramFile(fileId) {
  try {
    // Step 1: getFile to get file_path
    const fileRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
    const fileData = await fileRes.json();
    if (!fileData.ok || !fileData.result?.file_path) return null;

    const filePath = fileData.result.file_path;
    const fileName = path.basename(filePath);
    const localPath = path.join(FILE_DIR, `${Date.now()}-${fileName}`);

    // Step 2: Download file
    const downloadRes = await fetch(`https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`);
    const buffer = Buffer.from(await downloadRes.arrayBuffer());
    fs.writeFileSync(localPath, buffer);

    console.log(`  Downloaded: ${localPath} (${buffer.length} bytes)`);
    return { localPath, fileName, size: buffer.length, tgPath: filePath };
  } catch (err) {
    console.error(`  File download error: ${err.message}`);
    return null;
  }
}

async function handleIncomingFile(message, member, from) {
  let fileId = null;
  let fileType = "file";
  let caption = message.caption || "";

  // Photo: array of sizes, take largest (last)
  if (message.photo?.length) {
    fileId = message.photo[message.photo.length - 1].file_id;
    fileType = "photo";
  }
  // Document
  else if (message.document) {
    fileId = message.document.file_id;
    fileType = message.document.mime_type?.startsWith("image/") ? "photo" : "document";
    caption = caption || message.document.file_name || "file";
  }
  // Voice
  else if (message.voice) {
    fileId = message.voice.file_id;
    fileType = "voice";
  }
  // Video
  else if (message.video) {
    fileId = message.video.file_id;
    fileType = "video";
  }
  // Sticker (ignore)
  else if (message.sticker) {
    return;
  }

  if (!fileId) return;

  const file = await downloadTelegramFile(fileId);
  if (!file) {
    await sendTelegram(`❌ Не удалось скачать файл`);
    return;
  }

  // Determine which agent to route to
  const { slug, message: agentMsg, cmd } = parseCommand(caption);
  const taskText = agentMsg || caption || `[${fileType.toUpperCase()}] от ${member.name}`;

  const agentId = agentMap[slug];
  if (!agentId) {
    await sendTelegram(`❌ Агент "${slug}" не найден`);
    return;
  }

  const ts = new Date().toISOString().slice(0, 16);
  console.log(`[${ts}] ${from} → ${cmd.emoji} ${cmd.name}: [${fileType}] ${caption.slice(0, 60)}`);

  // Create task with file reference
  try {
    const description = [
      `**${fileType === "photo" ? "Фото" : "Файл"} из Telegram от ${from}:**\n`,
      caption ? `**Подпись:** ${caption}\n` : "",
      `**Файл:** \`${file.localPath}\``,
      `**Имя:** ${file.fileName}`,
      `**Размер:** ${(file.size / 1024).toFixed(1)} KB`,
      `**Тип:** ${fileType}`,
      `\n---\n_Получено: ${ts}_`,
      `\n_Агент может прочитать файл по пути выше через Read tool или Bash._`,
    ].join("\n");

    const res = await fetch(`${PAPERCLIP_URL}/api/companies/${COMPANY_ID}/issues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `[TG-${fileType.toUpperCase()}] ${taskText.slice(0, 80)}`,
        description,
        priority: "medium",
        assigneeAgentId: agentId,
        status: "todo",
      }),
    });
    const task = await res.json();
    console.log(`  → Task created: ${task.identifier || "?"}`);
  } catch (err) {
    console.error(`  → Task creation failed: ${err.message}`);
  }

  // Wake agent
  try {
    await fetch(`${PAPERCLIP_URL}/api/agents/${agentId}/wakeup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: "telegram_file",
        context: `${fileType} from ${from}: ${file.localPath}`,
      }),
    });
    const emoji = fileType === "photo" ? "📸" : "📎";
    await sendTelegram(`${emoji} ${cmd.emoji} <b>${cmd.name}</b> получил ${fileType === "photo" ? "фото" : "файл"} от <b>${member.name}</b>\n\n<i>${caption.slice(0, 200) || file.fileName}</i>`);
  } catch (err) {
    console.error(`  → Wakeup error: ${err.message}`);
  }
}

// ---------- Task creation ----------

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
        context: `Telegram from ${from}: ${text}`,
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

// ---------- Quick Commands (CRM queries, no agent wake) ----------

const TWENTY_URL = process.env.TWENTY_URL || "http://localhost:5555";
const TWENTY_API_KEY = process.env.TWENTY_API_KEY || "";

async function crmQuery(query) {
  try {
    const res = await fetch(`${TWENTY_URL}/graphql`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${TWENTY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });
    return await res.json();
  } catch (err) {
    return { error: err.message };
  }
}

async function handleStatus() {
  // Agent health from Paperclip
  let agentStatus = "";
  try {
    const res = await fetch(`${PAPERCLIP_URL}/api/companies/${COMPANY_ID}/agents`);
    const agents = await res.json();
    for (const a of agents) {
      const lastHb = a.lastHeartbeatAt ? new Date(a.lastHeartbeatAt) : null;
      const ago = lastHb ? Math.round((Date.now() - lastHb) / 60000) : null;
      const icon = !ago ? "⚪" : ago < 60 ? "🟢" : ago < 240 ? "🟡" : "🔴";
      const agoStr = ago ? `${ago}м назад` : "никогда";
      agentStatus += `${icon} ${a.name || a.urlKey} — ${agoStr}\n`;
    }
  } catch {
    agentStatus = "❌ Paperclip недоступен\n";
  }

  // Pipeline from CRM
  let pipeline = "";
  if (TWENTY_API_KEY) {
    const data = await crmQuery(`{ leads { edges { node { status outreachStatus } } } }`);
    const leads = data?.data?.leads?.edges || [];
    const byStatus = {};
    for (const { node } of leads) {
      byStatus[node.status] = (byStatus[node.status] || 0) + 1;
    }
    pipeline = Object.entries(byStatus).map(([k, v]) => `  ${k}: ${v}`).join("\n") || "пусто";
  }

  // Services
  let services = "";
  try {
    const crm = await fetch(`${TWENTY_URL}/healthz`).then(r => r.ok ? "🟢" : "🔴").catch(() => "🔴");
    const sync = await fetch("http://localhost:3089/health").then(r => r.ok ? "🟢" : "🔴").catch(() => "🔴");
    services = `CRM: ${crm} | Sync: ${sync}`;
  } catch {
    services = "проверка не удалась";
  }

  await sendTelegram(`📊 <b>Статус штаба</b>\n\n<b>Агенты:</b>\n${agentStatus}\n<b>Pipeline:</b>\n${pipeline}\n\n<b>Сервисы:</b> ${services}`);
}

async function handlePipeline() {
  if (!TWENTY_API_KEY) {
    await sendTelegram("❌ CRM API key не настроен");
    return;
  }
  const data = await crmQuery(`{ leads { edges { node { name status outreachStatus icpScore } } } }`);
  const leads = data?.data?.leads?.edges || [];

  const stages = {
    new: [], qualified: [], contacted: [], engaged: [],
    meeting_set: [], closed_won: [], closed_lost: [], nurture: [],
  };
  for (const { node } of leads) {
    const s = node.status || "new";
    if (!stages[s]) stages[s] = [];
    stages[s].push(node.name);
  }

  const icons = { new: "⬜", qualified: "🟦", contacted: "📧", engaged: "💬", meeting_set: "📞", closed_won: "✅", closed_lost: "❌", nurture: "💤" };
  let msg = "📊 <b>Pipeline</b>\n\n";
  for (const [stage, names] of Object.entries(stages)) {
    if (names.length > 0) {
      msg += `${icons[stage] || "▪️"} <b>${stage}</b> (${names.length}):\n`;
      for (const n of names.slice(0, 5)) msg += `  • ${n}\n`;
      if (names.length > 5) msg += `  ... и ещё ${names.length - 5}\n`;
      msg += "\n";
    }
  }
  msg += `<b>Всего:</b> ${leads.length} лидов`;
  await sendTelegram(msg);
}

async function handleLeads() {
  if (!TWENTY_API_KEY) {
    await sendTelegram("❌ CRM API key не настроен");
    return;
  }
  const data = await crmQuery(`{ leads { edges { node { outreachStatus decisionMakerEmail } } } }`);
  const leads = data?.data?.leads?.edges || [];

  const byOutreach = {};
  let withEmail = 0;
  let withoutEmail = 0;
  for (const { node } of leads) {
    const s = node.outreachStatus || "pending";
    byOutreach[s] = (byOutreach[s] || 0) + 1;
    if (node.decisionMakerEmail) withEmail++;
    else withoutEmail++;
  }

  const icons = { pending: "⬜", email_sent: "📧", follow_up_1: "📧📧", follow_up_2: "📧📧📧", replied_interested: "🔥", replied_question: "❓", replied_objection: "🤔", not_interested: "❌", no_response: "😶", meeting_scheduled: "📞" };
  let msg = "📋 <b>Outreach статус лидов</b>\n\n";
  for (const [status, count] of Object.entries(byOutreach)) {
    msg += `${icons[status] || "▪️"} ${status}: <b>${count}</b>\n`;
  }
  msg += `\n📧 С email: ${withEmail} | Без email: ${withoutEmail}`;
  msg += `\n<b>Всего:</b> ${leads.length}`;
  await sendTelegram(msg);
}

async function handleHelp() {
  // Send two messages — TG has 4096 char limit
  await sendTelegram(`🤖 <b>AmriTech AI Штаб — Справка</b>

<b>━━━ 📊 БЫСТРЫЕ КОМАНДЫ ━━━</b>
<i>(мгновенный ответ, не будит агентов)</i>

/status — Кто из агентов работает, кто завис
/pipeline — Сколько лидов на каждом этапе воронки
/leads — Сколько email отправлено, кто ответил
/fix — Что-то сломалось? Напиши и починим

<b>━━━ 🤖 КОМАНДЫ АГЕНТАМ ━━━</b>
<i>(создаёт задачу агенту и будит его)</i>

<b>Продажи:</b>
/hunter — Найти новых клиентов
/sdr — Написать/отправить cold email
/closer — Подготовить brief для звонка

<b>Управление:</b>
/ceo — Главный координатор (или просто пишите без команды)
/staff — Вопросы про систему и агентов

<b>Контракты и деньги:</b>
/contract — Контракты, renewals, продления
/finance — Инвойсы, оплаты, MRR
/onboard — Онбординг нового клиента

<b>Другое:</b>
/gov — Гос. тендеры (SAM.gov, NY/NJ)
/proposal — Написать proposal или КП
/legal — Юридическая проверка`);

  await sendTelegram(`<b>━━━ 💡 ПРИМЕРЫ ━━━</b>
<i>(копируйте и вставляйте)</i>

<b>Хочу найти клиентов:</b>
<code>/hunter найди стоматологии в Bergen County NJ</code>
<code>/hunter юрфирмы с плохим IT в Manhattan</code>

<b>Хочу отправить email:</b>
<code>/sdr напиши email для ABC Dental</code>
<code>/sdr отправь follow-up всем кто не ответил</code>

<b>Клиент ответил на email:</b>
<code>/closer подготовь brief для звонка с ABC Corp</code>

<b>Новый клиент подписал контракт:</b>
<code>/onboard запусти онбординг для XYZ Law</code>

<b>Вопрос по системе:</b>
<code>/staff что умеет Hunter?</code>
<code>/staff сколько лидов нашли за неделю?</code>

<b>Что-то сломалось:</b>
<code>/fix агенты не отвечают</code>
<code>/fix CRM не грузится</code>

<b>Просто написать координатору:</b>
<code>добавь эту компанию в приоритет: ABC Inc</code>
<i>(без команды = идёт к CEO)</i>

<b>━━━ ⚠️ ВАЖНО ━━━</b>
📋 <b>CRM надо вести!</b> Агенты работают на данных из CRM.
• @ikberik — внеси клиентов, подтверждай решения
• @UlaAmri — записывай результаты звонков
Без данных штаб работает вслепую 🙈`);
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

        const member = resolveTeamMember(message);
        const from = `${member.name} (${member.role}, ${member.handle})`;

        // Handle files/photos FIRST (before text processing)
        if (message.photo || message.document || message.voice || message.video) {
          await handleIncomingFile(message, member, from);
          res.writeHead(200).end("ok");
          return;
        }

        const text = message.text || "";
        const lower = text.toLowerCase().trim();
        if (lower.startsWith("/help") || lower.startsWith("/start")) {
          await handleHelp();
        } else if (lower === "/status") {
          await handleStatus();
        } else if (lower === "/pipeline") {
          await handlePipeline();
        } else if (lower === "/leads") {
          await handleLeads();
        } else if (lower.startsWith("/fix")) {
          const issue = text.slice(4).trim();
          if (issue) {
            // Route to IT Chef (or Staff Manager as fallback)
            const itChefSlug = agentMap["it-chef"] ? "it-chef" : "staff-manager";
            const cmd = { agent: itChefSlug, emoji: "🔧", name: "IT Chef" };
            await createTaskAndWake(itChefSlug, cmd, from, `[TECH-ISSUE] ${issue}`, member);
          } else {
            await sendTelegram("🔧 Напиши проблему после /fix\nПример: <code>/fix CRM не отвечает</code>");
          }
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
