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
  if (!text) return null;
  const lower = text.toLowerCase().trim();
  for (const [prefix, cmd] of Object.entries(COMMANDS)) {
    if (lower.startsWith(prefix)) {
      return { slug: cmd.agent, message: text.slice(prefix.length).trim(), cmd };
    }
  }
  // No command prefix → show menu instead of sending to CEO
  return null;
}

// ---------- File handling ----------

const FILE_DIR = "/tmp/amritech-tg-files";
import fs from "node:fs";
import path from "node:path";

// Ensure file directory exists
try { fs.mkdirSync(FILE_DIR, { recursive: true }); } catch {}

// ─── Task mapping: TG message_id → Paperclip task_id (shared with telegram-send) ───
const TG_TASK_MAP_FILE = "/tmp/tg-task-map.json";

function loadTaskMap() {
  try { return JSON.parse(fs.readFileSync(TG_TASK_MAP_FILE, "utf8")); } catch { return {}; }
}

async function addCommentToTask(taskId, text, from) {
  try {
    const res = await fetch(`${PAPERCLIP_URL}/api/issues/${taskId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: `**[TG] ${from}:**\n\n${text}` }),
    });
    if (res.ok) {
      const comment = await res.json();
      console.log(`  → Comment added to task ${taskId}`);
      return comment;
    }
    console.error(`  → Comment failed: ${res.status}`);
    return null;
  } catch (err) {
    console.error(`  → Comment error: ${err.message}`);
    return null;
  }
}

async function findTaskByIdentifier(identifier) {
  try {
    const res = await fetch(`${PAPERCLIP_URL}/api/companies/${COMPANY_ID}/issues?search=${identifier}`);
    const issues = await res.json();
    if (Array.isArray(issues) && issues.length > 0) {
      const match = issues.find(i => i.identifier === identifier);
      return match || issues[0];
    }
    return null;
  } catch { return null; }
}

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
  const parsed = parseCommand(caption);
  if (!parsed) {
    await sendTelegram(`📎 Файл получен! Добавь команду в подпись чтобы отправить агенту.\n💡 <i>Пример: /hunter визитка клиента</i>`);
    return;
  }
  const { slug, message: agentMsg, cmd } = parsed;
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

// ─── Inline Menu System ───

const MENUS = {
  main: {
    text: `🤖 <b>AmriTech AI Штаб</b>

12 AI-агентов работают на вас 24/7.
Нажмите на раздел 👇`,
    buttons: [
      [
        { text: "📈 Продажи", callback_data: "menu:sales" },
        { text: "📊 CRM", callback_data: "menu:crm" },
      ],
      [
        { text: "📋 Задачи", callback_data: "menu:tasks" },
        { text: "💰 Финансы", callback_data: "menu:finance" },
      ],
      [
        { text: "🏛️ Тендеры", callback_data: "menu:gov" },
        { text: "📝 Документы", callback_data: "menu:docs" },
      ],
      [
        { text: "📊 Статус", callback_data: "action:status" },
        { text: "🔧 Починить", callback_data: "menu:fix" },
      ],
      [
        { text: "❓ Помощь", callback_data: "menu:help" },
      ],
    ],
  },
  sales: {
    text: `📈 <b>Продажи</b>

<b>Как это работает:</b>
🔍 <b>Hunter</b> ищет компании с плохим IT
📧 <b>SDR</b> пишет им персональные письма
🤝 <b>Closer</b> готовит брифинг для звонка Berik'а

Нажми что нужно:`,
    buttons: [
      [
        { text: "📊 Воронка продаж", callback_data: "action:pipeline" },
        { text: "📋 Статус лидов", callback_data: "action:leads" },
      ],
      [
        { text: "🔍 Найти новых клиентов", callback_data: "agent:hunter" },
      ],
      [
        { text: "📧 Написать cold email", callback_data: "agent:sdr" },
      ],
      [
        { text: "🤝 Подготовить звонок", callback_data: "agent:closer" },
      ],
      [
        { text: "👑 Вопрос координатору", callback_data: "agent:ceo" },
      ],
      [{ text: "← Назад", callback_data: "menu:main" }],
    ],
  },
  tasks: {
    text: `📋 <b>Задачи</b>

Каждый агент работает по задачам. Задачи создаются автоматически или вручную.

<b>Статусы:</b>
⬜ todo — новая, ждёт работы
🔄 in progress — агент работает
🚫 blocked — ждёт вашего решения
✅ done — выполнена`,
    buttons: [
      [
        { text: "🔄 Открытые задачи", callback_data: "action:tasks" },
      ],
      [
        { text: "✅ Закрыть задачу", callback_data: "input:done" },
        { text: "🚫 Заблокировать", callback_data: "input:block" },
      ],
      [
        { text: "🔄 Переназначить агенту", callback_data: "input:assign" },
        { text: "💬 Написать комментарий", callback_data: "input:comment" },
      ],
      [{ text: "← Назад", callback_data: "menu:main" }],
    ],
  },
  finance: {
    text: `💰 <b>Финансы и контракты</b>

<b>Finance Tracker</b> — следит за инвойсами, MRR, просрочками
<b>Contract Manager</b> — контракты, renewals, SLA
<b>Legal</b> — MSA, NDA, compliance проверки
<b>Onboarding</b> — первые 30 дней нового клиента`,
    buttons: [
      [
        { text: "💰 Инвойсы и MRR", callback_data: "agent:finance" },
      ],
      [
        { text: "📋 Контракты и renewals", callback_data: "agent:contract" },
      ],
      [
        { text: "⚖️ Юридическая проверка", callback_data: "agent:legal" },
      ],
      [
        { text: "🚀 Онбординг клиента", callback_data: "agent:onboard" },
      ],
      [{ text: "← Назад", callback_data: "menu:main" }],
    ],
  },
  gov: {
    text: "🏛️ <b>Гос. тендеры</b>",
    buttons: [
      [
        { text: "🔍 Найти тендеры", callback_data: "agent:gov" },
        { text: "📝 Написать proposal", callback_data: "agent:proposal" },
      ],
      [{ text: "← Назад", callback_data: "menu:main" }],
    ],
  },
  fix: {
    text: `🔧 <b>Что-то сломалось?</b>

<b>IT Chef</b> — наш DevOps. Он починит всё: CRM, email, агентов, серверы.

Выбери проблему или опиши свою:`,
    buttons: [
      [
        { text: "🤖 Агенты не работают", callback_data: "quickfix:agents" },
      ],
      [
        { text: "📊 CRM не грузится", callback_data: "quickfix:crm" },
      ],
      [
        { text: "📧 Email не уходит", callback_data: "quickfix:email" },
      ],
      [
        { text: "🔧 Другая проблема (напишу)", callback_data: "input:fix" },
      ],
      [{ text: "← Назад", callback_data: "menu:main" }],
    ],
  },
  docs: {
    text: "📝 <b>Документы</b>",
    buttons: [
      [
        { text: "📝 Proposal / КП", callback_data: "agent:proposal" },
        { text: "⚖️ MSA / NDA", callback_data: "agent:legal" },
      ],
      [
        { text: "📋 Контракт", callback_data: "agent:contract" },
      ],
      [{ text: "← Назад", callback_data: "menu:main" }],
    ],
  },
  crm: {
    text: `📊 <b>CRM — вся база</b>

Лиды, клиенты, счета — всё тут.
Не нужно заходить на сайт!`,
    buttons: [
      [
        { text: "📈 Воронка", callback_data: "crm:pipeline" },
        { text: "📊 Цифры", callback_data: "crm:stats" },
      ],
      [
        { text: "🔥 Лучшие (70+⭐)", callback_data: "crm:hot" },
        { text: "💬 Ответили!", callback_data: "crm:replied" },
      ],
      [
        { text: "📧 В рассылке", callback_data: "crm:outreach" },
        { text: "🆕 Новые", callback_data: "crm:new" },
      ],
      [
        { text: "💤 На паузе", callback_data: "crm:nurture" },
        { text: "❌ Отказы", callback_data: "crm:lost" },
      ],
      [
        { text: "🔍 Найти компанию", callback_data: "input:search_lead" },
      ],
      [
        { text: "👥 Клиенты", callback_data: "crm:clients" },
        { text: "💰 Тендеры", callback_data: "crm:tenders" },
      ],
      [{ text: "← Главное меню", callback_data: "menu:main" }],
    ],
  },
  help: {
    text: `❓ <b>Помощь</b>

<b>Как пользоваться:</b>
• Нажимай кнопки в меню — всё по нажатию
• Reply на сообщение агента = комментарий к задаче
• Просто напиши текст = задача для CEO

<b>Команды (для продвинутых):</b>
<code>/done AMRA-123</code> — закрыть задачу
<code>/block AMRA-123 причина</code> — заблокировать
<code>/assign AMRA-123 hunter</code> — переназначить
<code>/c AMRA-123 текст</code> — комментарий

<b>Примеры текстом:</b>
<code>/hunter найди стоматологии в Bergen NJ</code>
<code>/sdr напиши email для ABC Dental</code>

💡 <i>Кнопки под сообщениями агентов — меняй статус в один тап!</i>`,
    buttons: [
      [{ text: "← Главное меню", callback_data: "menu:main" }],
    ],
  },
};

// Agent prompt map: when button pressed, ask for task text
const AGENT_PROMPTS = {
  hunter: { emoji: "🔍", name: "Hunter", prompt: "Опиши кого искать (ниша, район, кол-во):" },
  sdr: { emoji: "📧", name: "SDR", prompt: "Что нужно? (написать email, follow-up, проверить inbox):" },
  closer: { emoji: "🤝", name: "Closer", prompt: "Для какой компании подготовить briefing?" },
  ceo: { emoji: "👑", name: "CEO", prompt: "Что нужно координатору?" },
  gov: { emoji: "🏛️", name: "Gov Scout", prompt: "Что ищем? (ниша, NAICS, регион):" },
  proposal: { emoji: "📝", name: "Proposal Writer", prompt: "Для кого пишем proposal?" },
  contract: { emoji: "📋", name: "Contract Manager", prompt: "Какой контракт/клиент?" },
  finance: { emoji: "💰", name: "Finance Tracker", prompt: "Что нужно? (инвойс, MRR, отчёт):" },
  legal: { emoji: "⚖️", name: "Legal Assistant", prompt: "Что проверить? (MSA, NDA, compliance):" },
  onboard: { emoji: "🚀", name: "Onboarding", prompt: "Какого клиента онбордим?" },
};

const INPUT_PROMPTS = {
  done: "Напиши номер задачи (например AMRA-123):",
  block: "Напиши: AMRA-123 причина блокировки",
  assign: "Напиши: AMRA-123 имя_агента (например: AMRA-123 hunter)",
  comment: "Напиши: AMRA-123 текст комментария",
  fix: "Опиши проблему — IT Chef разберётся:",
  search_lead: "Напиши название компании (или часть названия):",
};

async function sendMainMenu(chatId) {
  const menu = MENUS.main;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: menu.text,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: menu.buttons },
    }),
  });
}

async function editMenu(chatId, messageId, menuKey) {
  const menu = MENUS[menuKey];
  if (!menu) return;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text: menu.text,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: menu.buttons },
    }),
  });
}

const CRM_PAGE_SIZE = 5;

async function handleCrmQuery(type, targetChatId, page = 1) {
  if (!TWENTY_API_KEY) { await sendTelegram("❌ CRM не настроен"); return; }
  const offset = (page - 1) * CRM_PAGE_SIZE;

  try {
    if (type === "hot") {
      const data = await crmQuery(`{ leads(filter: { icpScore: { gte: 70 } }, first: 100, orderBy: { icpScore: DescNullsLast }) { edges { node { id name status icpScore industry decisionMaker } } } }`);
      const all = data?.data?.leads?.edges || [];
      if (!all.length) { await sendTelegram("Нет лидов с высокой оценкой"); return; }
      const total = all.length;
      const pages = Math.ceil(total / CRM_PAGE_SIZE);
      const leads = all.slice(offset, offset + CRM_PAGE_SIZE);

      let msg = `🔥 <b>Лучшие лиды</b> (стр. ${page}/${pages})\n<i>Оценка = насколько подходит как клиент</i>\n\n`;
      for (const { node: l } of leads) {
        const statusRu = { new: "🆕новый", contacted: "📧email", engaged: "💬ответил", qualified: "✅подходит", nurture: "💤пауза" };
        msg += `<b>${l.icpScore}⭐ ${l.name}</b>\n`;
        msg += `   ${l.industry || "?"} | ${statusRu[l.status] || l.status} | DM: ${l.decisionMaker || "?"}\n`;
        msg += `   → /lead_${l.id.slice(0,8)}\n\n`;
      }
      const btns = [];
      const nav = [];
      if (page > 1) nav.push({ text: `← Стр.${page-1}`, callback_data: `crm:hot:${page-1}` });
      nav.push({ text: `${page}/${pages}`, callback_data: "noop" });
      if (page < pages) nav.push({ text: `Стр.${page+1} →`, callback_data: `crm:hot:${page+1}` });
      if (nav.length > 1) btns.push(nav);
      btns.push([{ text: "← CRM меню", callback_data: "menu:crm" }]);
      await sendTelegramWithButtons(targetChatId, msg, btns);
    }

    else if (type === "outreach") {
      const data = await crmQuery(`{ leads(filter: { status: { eq: "contacted" } }, first: 100) { edges { node { id name outreachStatus lastContactDate } } } }`);
      const all = data?.data?.leads?.edges || [];
      if (!all.length) { await sendTelegram("Нет лидов в рассылке"); return; }
      const total = all.length;
      const pages = Math.ceil(total / CRM_PAGE_SIZE);
      const leads = all.slice(offset, offset + CRM_PAGE_SIZE);

      const icons = { email_sent: "📧", follow_up_1: "📧📧", follow_up_2: "📧📧📧", replied_interested: "🔥", replied_question: "❓", not_interested: "❌", no_response: "😶" };
      let msg = `📧 <b>Email рассылка</b> (стр. ${page}/${pages})\n\n`;
      for (const { node: l } of leads) {
        const icon = icons[l.outreachStatus] || "▪️";
        const ago = l.lastContactDate ? Math.round((Date.now() - new Date(l.lastContactDate)) / 86400000) : "?";
        msg += `${icon} <b>${l.name}</b> — ${ago}д назад\n`;
      }
      msg += `\n💡 <i>📧=первое, 📧📧=follow-up, 🔥=ответил!</i>`;
      const btns = [];
      const nav = [];
      if (page > 1) nav.push({ text: `← Стр.${page-1}`, callback_data: `crm:outreach:${page-1}` });
      nav.push({ text: `${page}/${pages}`, callback_data: "noop" });
      if (page < pages) nav.push({ text: `Стр.${page+1} →`, callback_data: `crm:outreach:${page+1}` });
      if (nav.length > 1) btns.push(nav);
      btns.push([{ text: "← CRM меню", callback_data: "menu:crm" }]);
      await sendTelegramWithButtons(targetChatId, msg, btns);
    }

    else if (type === "new") {
      const data = await crmQuery(`{ leads(filter: { status: { eq: "new" } }, first: 100, orderBy: { createdAt: DescNullsLast }) { edges { node { id name icpScore industry } } } }`);
      const all = data?.data?.leads?.edges || [];
      if (!all.length) { await sendTelegram("✅ Нет новых — SDR всё разобрал!"); return; }
      const total = all.length;
      const pages = Math.ceil(total / CRM_PAGE_SIZE);
      const leads = all.slice(offset, offset + CRM_PAGE_SIZE);

      let msg = `🆕 <b>Новые лиды</b> (стр. ${page}/${pages})\n<i>Ждут первый email от SDR</i>\n\n`;
      for (const { node: l } of leads) {
        msg += `⬜ <b>${l.name}</b> — ${l.industry || "?"} — ⭐${l.icpScore || "?"}\n`;
      }
      const btns = [];
      const nav = [];
      if (page > 1) nav.push({ text: `← Стр.${page-1}`, callback_data: `crm:new:${page-1}` });
      nav.push({ text: `${page}/${pages}`, callback_data: "noop" });
      if (page < pages) nav.push({ text: `Стр.${page+1} →`, callback_data: `crm:new:${page+1}` });
      if (nav.length > 1) btns.push(nav);
      btns.push([{ text: "← CRM меню", callback_data: "menu:crm" }]);
      await sendTelegramWithButtons(targetChatId, msg, btns);
    }

    else if (type === "replied") {
      const data = await crmQuery(`{ leads(filter: { status: { eq: "engaged" } }, first: 100, orderBy: { lastContactDate: DescNullsLast }) { edges { node { id name icpScore industry decisionMaker lastContactDate outreachStatus notes } } } }`);
      const all = data?.data?.leads?.edges || [];
      if (!all.length) { await sendTelegram("Пока никто не ответил на email 😔\n💡 <i>SDR продолжает рассылку.</i>"); return; }
      const pages = Math.ceil(all.length / CRM_PAGE_SIZE);
      const leads = all.slice(offset, offset + CRM_PAGE_SIZE);

      let msg = `💬 <b>Ответили на email!</b> (стр. ${page}/${pages})\n<i>Эти лиды ждут звонка или решения</i>\n\n`;
      for (const { node: l } of leads) {
        const ago = l.lastContactDate ? Math.round((Date.now() - new Date(l.lastContactDate)) / 3600000) : "?";
        msg += `🔥 <b>${l.name}</b> — ⭐${l.icpScore || "?"}\n`;
        msg += `   ${l.industry || "?"} | DM: ${l.decisionMaker || "?"}\n`;
        msg += `   Ответил ${ago}ч назад\n`;
        if (l.notes) msg += `   📝 ${l.notes.slice(0, 80)}...\n`;
        msg += `\n`;
      }
      msg += `⚠️ <i>Чем быстрее позвоним — тем выше шанс закрыть!</i>`;
      const btns = [];
      const nav = [];
      if (page > 1) nav.push({ text: `← Стр.${page-1}`, callback_data: `crm:replied:${page-1}` });
      nav.push({ text: `${page}/${pages}`, callback_data: "noop" });
      if (page < pages) nav.push({ text: `Стр.${page+1} →`, callback_data: `crm:replied:${page+1}` });
      if (nav.length > 1) btns.push(nav);
      btns.push([{ text: "← CRM меню", callback_data: "menu:crm" }]);
      await sendTelegramWithButtons(targetChatId, msg, btns);
    }

    else if (type === "nurture") {
      const data = await crmQuery(`{ leads(filter: { status: { eq: "nurture" } }, first: 100, orderBy: { icpScore: DescNullsLast }) { edges { node { id name icpScore industry lastContactDate } } } }`);
      const all = data?.data?.leads?.edges || [];
      if (!all.length) { await sendTelegram("Нет лидов на паузе"); return; }
      const pages = Math.ceil(all.length / CRM_PAGE_SIZE);
      const leads = all.slice(offset, offset + CRM_PAGE_SIZE);

      let msg = `💤 <b>На паузе (nurture)</b> (стр. ${page}/${pages})\n<i>Не ответили или "не сейчас". Вернёмся через 30-90 дней.</i>\n\n`;
      for (const { node: l } of leads) {
        const ago = l.lastContactDate ? Math.round((Date.now() - new Date(l.lastContactDate)) / 86400000) : "?";
        msg += `💤 <b>${l.name}</b> — ⭐${l.icpScore || "?"} | ${l.industry || "?"} | ${ago}д назад\n`;
      }
      const btns = [];
      const nav = [];
      if (page > 1) nav.push({ text: `← Стр.${page-1}`, callback_data: `crm:nurture:${page-1}` });
      nav.push({ text: `${page}/${pages}`, callback_data: "noop" });
      if (page < pages) nav.push({ text: `Стр.${page+1} →`, callback_data: `crm:nurture:${page+1}` });
      if (nav.length > 1) btns.push(nav);
      btns.push([{ text: "← CRM меню", callback_data: "menu:crm" }]);
      await sendTelegramWithButtons(targetChatId, msg, btns);
    }

    else if (type === "lost") {
      const data = await crmQuery(`{ leads(filter: { status: { eq: "closed" } }, first: 100, orderBy: { updatedAt: DescNullsLast }) { edges { node { id name icpScore industry notes } } } }`);
      const all = data?.data?.leads?.edges || [];
      if (!all.length) { await sendTelegram("Нет отказов — отлично!"); return; }
      const pages = Math.ceil(all.length / CRM_PAGE_SIZE);
      const leads = all.slice(offset, offset + CRM_PAGE_SIZE);

      let msg = `❌ <b>Отказы</b> (стр. ${page}/${pages})\n<i>Можно вернуться через 6 мес с новым предложением</i>\n\n`;
      for (const { node: l } of leads) {
        msg += `❌ <b>${l.name}</b> — ${l.industry || "?"}\n`;
        if (l.notes) msg += `   📝 ${l.notes.slice(0, 60)}\n`;
      }
      const btns = [];
      const nav = [];
      if (page > 1) nav.push({ text: `← Стр.${page-1}`, callback_data: `crm:lost:${page-1}` });
      nav.push({ text: `${page}/${pages}`, callback_data: "noop" });
      if (page < pages) nav.push({ text: `Стр.${page+1} →`, callback_data: `crm:lost:${page+1}` });
      if (nav.length > 1) btns.push(nav);
      btns.push([{ text: "← CRM меню", callback_data: "menu:crm" }]);
      await sendTelegramWithButtons(targetChatId, msg, btns);
    }

    else if (type === "stats") {
      const leadsData = await crmQuery(`{ leads(first: 1000) { edges { node { status outreachStatus icpScore } } } }`);
      const clientsData = await crmQuery(`{ clients(first: 1000) { edges { node { id } } } }`);
      const tendersData = await crmQuery(`{ tenders(first: 1000) { edges { node { status } } } }`);

      const leads = leadsData?.data?.leads?.edges?.map(e => e.node) || [];
      const clients = clientsData?.data?.clients?.edges || [];
      const tenders = tendersData?.data?.tenders?.edges?.map(e => e.node) || [];

      const byStatus = {};
      let totalScore = 0, scored = 0;
      for (const l of leads) {
        byStatus[l.status || "new"] = (byStatus[l.status || "new"] || 0) + 1;
        if (l.icpScore) { totalScore += l.icpScore; scored++; }
      }

      const byOutreach = {};
      for (const l of leads) {
        if (l.outreachStatus) byOutreach[l.outreachStatus] = (byOutreach[l.outreachStatus] || 0) + 1;
      }

      const tendersByStatus = {};
      for (const t of tenders) {
        tendersByStatus[t.status || "?"] = (tendersByStatus[t.status || "?"] || 0) + 1;
      }

      const statusRu = { new: "🆕 Новые", qualified: "✅ Подходят", contacted: "📧 Email отправлен", engaged: "💬 Ответили", closed_won: "🎉 Стали клиентами", closed_lost: "❌ Отказ", nurture: "💤 Пауза", meeting_set: "📞 Звонок назначен" };

      let msg = `📊 <b>Статистика CRM</b>\n\n`;
      msg += `<b>Всего лидов:</b> ${leads.length}\n`;
      msg += `<b>Средняя оценка:</b> ${scored ? Math.round(totalScore / scored) : "?"}/100\n`;
      msg += `<b>Клиентов:</b> ${clients.length}\n`;
      msg += `<b>Тендеров:</b> ${tenders.length}\n\n`;

      msg += `<b>По статусу:</b>\n`;
      for (const [s, c] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) {
        msg += `${statusRu[s] || s}: <b>${c}</b>\n`;
      }

      if (Object.keys(byOutreach).length) {
        msg += `\n<b>Рассылка:</b>\n`;
        const outreachRu = { pending: "⬜ Ждут", email_sent: "📧 Первое письмо", follow_up_1: "📧📧 Follow-up 1", follow_up_2: "📧📧📧 Follow-up 2", replied_interested: "🔥 Заинтересованы", no_response: "😶 Молчат" };
        for (const [s, c] of Object.entries(byOutreach).sort((a, b) => b[1] - a[1])) {
          msg += `${outreachRu[s] || s}: <b>${c}</b>\n`;
        }
      }

      await sendTelegramWithButtons(targetChatId, msg, [[{ text: "← CRM меню", callback_data: "menu:crm" }]]);
    }

    else if (type === "tenders") {
      const data = await crmQuery(`{ tenders(first: 100, orderBy: { createdAt: DescNullsLast }) { edges { node { id name status setAside createdAt } } } }`);
      const all = data?.data?.tenders?.edges || [];
      if (!all.length) { await sendTelegram("Нет тендеров.\n💡 <i>Gov Scout ищет — скоро появятся!</i>"); return; }
      const pages = Math.ceil(all.length / CRM_PAGE_SIZE);
      const items = all.slice(offset, offset + CRM_PAGE_SIZE);

      let msg = `🏛️ <b>Тендеры</b> (стр. ${page}/${pages})\n\n`;
      for (const { node: t } of items) {
        const statusIcon = { found: "🔍", scored: "📊", go: "✅", no_go: "❌", expired: "⏰" };
        msg += `${statusIcon[t.status] || "▪️"} <b>${t.name}</b>\n`;
        msg += `   Статус: ${t.status || "?"} | Set-aside: ${t.setAside || "нет"}\n\n`;
      }
      const btns = [];
      const nav = [];
      if (page > 1) nav.push({ text: `← Стр.${page-1}`, callback_data: `crm:tenders:${page-1}` });
      nav.push({ text: `${page}/${pages}`, callback_data: "noop" });
      if (page < pages) nav.push({ text: `Стр.${page+1} →`, callback_data: `crm:tenders:${page+1}` });
      if (nav.length > 1) btns.push(nav);
      btns.push([{ text: "← CRM меню", callback_data: "menu:crm" }]);
      await sendTelegramWithButtons(targetChatId, msg, btns);
    }

    else if (type === "clients") {
      const data = await crmQuery(`{ clients(first: 100) { edges { node { id name services } } } }`);
      const all = data?.data?.clients?.edges || [];
      if (!all.length) { await sendTelegram("Пока нет клиентов.\n💡 <i>@ikberik — внеси текущих клиентов!</i>"); return; }
      const total = all.length;
      const pages = Math.ceil(total / CRM_PAGE_SIZE);
      const clients = all.slice(offset, offset + CRM_PAGE_SIZE);

      let msg = `👥 <b>Наши клиенты</b> (стр. ${page}/${pages})\n\n`;
      for (const { node: c } of clients) {
        msg += `✅ <b>${c.name}</b>${c.services ? ` — ${c.services}` : ""}\n`;
      }
      const btns = [];
      const nav = [];
      if (page > 1) nav.push({ text: `← Стр.${page-1}`, callback_data: `crm:clients:${page-1}` });
      nav.push({ text: `${page}/${pages}`, callback_data: "noop" });
      if (page < pages) nav.push({ text: `Стр.${page+1} →`, callback_data: `crm:clients:${page+1}` });
      if (nav.length > 1) btns.push(nav);
      btns.push([{ text: "← CRM меню", callback_data: "menu:crm" }]);
      await sendTelegramWithButtons(targetChatId, msg, btns);
    }
  } catch (err) {
    await sendTelegram(`❌ Ошибка CRM: ${err.message}`);
  }
}

// Send message with inline keyboard
async function sendTelegramWithButtons(targetChatId, text, buttons) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: targetChatId || chatId,
      text,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: buttons },
    }),
  });
}

async function handleCrmSearch(query, targetChatId) {
  if (!TWENTY_API_KEY) { await sendTelegram("❌ CRM не настроен"); return; }
  try {
    const data = await crmQuery(`{ leads(filter: { name: { like: "%${query}%" } }, first: 10) { edges { node { id name companyName status outreachStatus icpScore industry decisionMaker decisionMakerEmail phone { primaryPhoneNumber } lastContactDate notes createdAt } } } }`);
    const leads = data?.data?.leads?.edges || [];
    if (!leads.length) {
      await sendTelegram(`🔍 По запросу "<b>${query}</b>" ничего не найдено.\n💡 <i>Попробуй другое название или часть слова.</i>`);
      return;
    }
    for (const { node: l } of leads) {
      const statusRu = { new: "🆕 Новый", contacted: "📧 Отправили email", engaged: "💬 Ответил", qualified: "✅ Подходит", closed_won: "🎉 Клиент!", closed_lost: "❌ Отказ", nurture: "💤 На паузе" };
      let card = `🔍 <b>${l.name}</b>\n\n`;
      card += `📊 <b>Оценка:</b> ${l.icpScore || "?"}/100\n`;
      card += `📁 <b>Ниша:</b> ${l.industry || "не указана"}\n`;
      card += `📌 <b>Статус:</b> ${statusRu[l.status] || l.status || "?"}\n`;
      if (l.decisionMaker) card += `👤 <b>Контакт:</b> ${l.decisionMaker}\n`;
      if (l.decisionMakerEmail) card += `📧 <b>Email:</b> ${l.decisionMakerEmail}\n`;
      if (l.phone?.primaryPhoneNumber) card += `📞 <b>Телефон:</b> ${l.phone.primaryPhoneNumber}\n`;
      if (l.lastContactDate) {
        const ago = Math.round((Date.now() - new Date(l.lastContactDate)) / 86400000);
        card += `📅 <b>Последний контакт:</b> ${ago}д назад\n`;
      }
      if (l.notes) card += `\n📝 <b>Заметки:</b>\n<i>${l.notes.slice(0, 300)}</i>\n`;
      card += `\n💡 <i>ID: ${l.id.slice(0, 8)}...</i>`;
      await sendTelegram(card);
    }
  } catch (err) {
    await sendTelegram(`❌ Ошибка поиска: ${err.message}`);
  }
}

async function handleHelp(msgChatId) {
  await sendMainMenu(msgChatId || chatId);
}

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/webhook") {
    let body = "";
    for await (const chunk of req) body += chunk;

    try {
      const update = JSON.parse(body);

      // ─── Handle inline button press ───
      if (update.callback_query) {
        const cb = update.callback_query;
        const cbData = cb.data || "";
        const member = resolveTeamMember(cb);

        if (cbData.startsWith("comment:")) {
          const taskId = cbData.slice(8);
          if (!globalThis.pendingComments) globalThis.pendingComments = {};
          globalThis.pendingComments[cb.from.id] = taskId;

          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: cb.id, text: "Напиши комментарий ↓" }),
          });
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: cb.message.chat.id,
              text: `💬 <b>${member.name}</b>, напиши комментарий к задаче:`,
              parse_mode: "HTML",
              reply_markup: { force_reply: true, selective: true },
            }),
          });
        }

        // Status change: status:done:{taskId}, status:in_progress:{taskId}, status:blocked:{taskId}
        else if (cbData.startsWith("status:")) {
          const parts = cbData.split(":");
          const newStatus = parts[1]; // done, in_progress, blocked
          const taskId = parts.slice(2).join(":");
          try {
            const patchRes = await fetch(`${PAPERCLIP_URL}/api/issues/${taskId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: newStatus }),
            });
            const statusEmoji = { done: "✅", in_progress: "🔄", blocked: "🚫", todo: "📋" };
            if (patchRes.ok) {
              await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ callback_query_id: cb.id, text: `${statusEmoji[newStatus] || "✓"} Статус → ${newStatus}` }),
              });
              // Add comment about status change
              await addCommentToTask(taskId, `Статус изменён → **${newStatus}**`, `${member.name} (via Telegram)`);
            } else {
              await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ callback_query_id: cb.id, text: "❌ Ошибка", show_alert: true }),
              });
            }
          } catch (err) {
            console.error("Status change error:", err.message);
          }
        }

        // Menu navigation: menu:sales, menu:tasks, etc.
        else if (cbData.startsWith("menu:")) {
          const menuKey = cbData.slice(5);
          await editMenu(cb.message.chat.id, cb.message.message_id, menuKey);
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: cb.id }),
          });
        }

        // Action: execute quick command (status, pipeline, leads, tasks)
        else if (cbData.startsWith("action:")) {
          const action = cbData.slice(7);
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: cb.id, text: "⏳ Загрузка..." }),
          });
          if (action === "status") await handleStatus();
          else if (action === "pipeline") await handlePipeline();
          else if (action === "leads") await handleLeads();
          else if (action === "tasks") {
            // Inline task list
            try {
              const tasksRes = await fetch(`${PAPERCLIP_URL}/api/companies/${COMPANY_ID}/issues?status=todo,in_progress,blocked&limit=15`);
              const tasks = await tasksRes.json();
              if (Array.isArray(tasks) && tasks.length > 0) {
                const si = { todo: "⬜", in_progress: "🔄", blocked: "🚫", backlog: "📥" };
                const pi = { urgent: "🔴", high: "🟠", medium: "🟡", low: "⚪" };
                let msg = "📋 <b>Открытые задачи</b>\n\n";
                for (const t of tasks) {
                  msg += `${si[t.status]||"▪️"}${pi[t.priority]||""} <b>${t.identifier}</b> ${(t.title||"").slice(0,45)}\n`;
                }
                await sendTelegram(msg);
              } else {
                await sendTelegram("✅ Нет открытых задач!");
              }
            } catch { await sendTelegram("❌ Ошибка загрузки задач"); }
          }
        }

        // Agent: ask for task text, then create
        else if (cbData.startsWith("agent:")) {
          const agentKey = cbData.slice(6);
          const ap = AGENT_PROMPTS[agentKey];
          if (ap) {
            if (!globalThis.pendingAgentTasks) globalThis.pendingAgentTasks = {};
            globalThis.pendingAgentTasks[cb.from.id] = agentKey;
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ callback_query_id: cb.id }),
            });
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: cb.message.chat.id,
                text: `${ap.emoji} <b>${ap.name}</b>\n\n${ap.prompt}`,
                parse_mode: "HTML",
                reply_markup: { force_reply: true, selective: true },
              }),
            });
          }
        }

        // Input: ask for text input (done, block, assign, comment, fix)
        else if (cbData.startsWith("input:")) {
          const inputType = cbData.slice(6);
          const prompt = INPUT_PROMPTS[inputType];
          if (prompt) {
            if (!globalThis.pendingInputs) globalThis.pendingInputs = {};
            globalThis.pendingInputs[cb.from.id] = inputType;
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ callback_query_id: cb.id }),
            });
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: cb.message.chat.id,
                text: prompt,
                parse_mode: "HTML",
                reply_markup: { force_reply: true, selective: true },
              }),
            });
          }
        }

        // Quick fix: predefined IT issues
        else if (cbData.startsWith("quickfix:")) {
          const issue = cbData.slice(9);
          const issues = { agents: "Агенты не отвечают / зависли", crm: "CRM (Twenty) не грузится", email: "Email не отправляется" };
          const itChefSlug = agentMap["it-chef"] ? "it-chef" : "staff-manager";
          const cmd = { agent: itChefSlug, emoji: "🔧", name: "IT Chef" };
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: cb.id, text: "🔧 IT Chef на связи!" }),
          });
          await createTaskAndWake(itChefSlug, cmd, `${member.name} (via menu)`, `[TECH-ISSUE] ${issues[issue] || issue}`, member);
        }

        // CRM queries: crm:pipeline, crm:hot, crm:outreach, crm:new, crm:clients
        else if (cbData.startsWith("crm:")) {
          const crmAction = cbData.slice(4);
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: cb.id, text: "⏳ Загружаю..." }),
          });

          if (crmAction === "pipeline") {
            await handlePipeline();
          } else {
            // Parse: hot, hot:2, outreach:3 etc
            const parts = crmAction.split(":");
            const queryType = parts[0];
            const page = parseInt(parts[1]) || 1;
            if (["hot", "outreach", "new", "clients"].includes(queryType)) {
              await handleCrmQuery(queryType, cb.message.chat.id, page);
            }
          }
        }

        // Berik decisions: decide:go/skip/priced:{taskId}
        else if (cbData.startsWith("decide:")) {
          const parts = cbData.split(":");
          const decision = parts[1];
          const taskId = parts.slice(2).join(":");
          const decisionText = {
            go: "✅ Решение: звоним! Ula — intro call.",
            skip: "❌ Решение: пропускаем этого лида.",
            priced: "💰 Pricing согласован. Ula — closing call!",
          };
          try {
            if (decision === "skip") {
              await fetch(`${PAPERCLIP_URL}/api/issues/${taskId}`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "done" }),
              });
            }
            await addCommentToTask(taskId, decisionText[decision] || decision, `${member.name} (via Telegram)`);
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ callback_query_id: cb.id, text: decisionText[decision]?.slice(0, 50) || "✓" }),
            });
            // Notify in chat
            await sendTelegram(decisionText[decision] + `\n<i>— ${member.name}</i>`);
          } catch (err) { console.error("Decision error:", err.message); }
        }

        // Ula call results: call:done/miss/later/won/lost:{taskId}
        else if (cbData.startsWith("call:")) {
          const parts = cbData.split(":");
          const result = parts[1];
          const taskId = parts.slice(2).join(":");

          if (result === "done") {
            // Ask for call notes
            if (!globalThis.pendingComments) globalThis.pendingComments = {};
            globalThis.pendingComments[cb.from.id] = taskId;
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ callback_query_id: cb.id, text: "Напиши результат звонка ↓" }),
            });
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: cb.message.chat.id,
                text: `📞 <b>${member.name}</b>, напиши результат звонка:\n\n💡 <i>Что обсудили? Какие потребности? Что дальше?</i>`,
                parse_mode: "HTML",
                reply_markup: { force_reply: true, selective: true },
              }),
            });
          } else if (result === "miss") {
            await addCommentToTask(taskId, "📞 Не дозвонился. Перезвоню.", `${member.name} (via Telegram)`);
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ callback_query_id: cb.id, text: "📞 Не дозвонился — записано" }),
            });
          } else if (result === "later") {
            await addCommentToTask(taskId, "⏰ Перезвоню позже.", `${member.name} (via Telegram)`);
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ callback_query_id: cb.id, text: "⏰ Окей, перезвонишь позже" }),
            });
          } else if (result === "won") {
            await addCommentToTask(taskId, "🎉 КЛИЕНТ СОГЛАСЕН! Закрываем!", `${member.name} (via Telegram)`);
            await fetch(`${PAPERCLIP_URL}/api/issues/${taskId}`, {
              method: "PATCH", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "done" }),
            });
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ callback_query_id: cb.id, text: "🎉 Поздравляем!!!" }),
            });
            await sendTelegram(`🎉🎉🎉 <b>НОВЫЙ КЛИЕНТ!</b>\n\n<b>${member.name}</b> закрыл сделку!\n\n💡 <i>Onboarding и Contract Manager запустятся автоматически.</i>`);
          } else if (result === "lost") {
            // Ask for reason
            if (!globalThis.pendingComments) globalThis.pendingComments = {};
            globalThis.pendingComments[cb.from.id] = taskId;
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ callback_query_id: cb.id, text: "Напиши причину отказа ↓" }),
            });
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: cb.message.chat.id,
                text: `❌ <b>${member.name}</b>, почему отказали?\n\n💡 <i>Цена? Не нужно? Уже есть IT? Другая причина?</i>`,
                parse_mode: "HTML",
                reply_markup: { force_reply: true, selective: true },
              }),
            });
          }
        }

        // Noop (pagination current page indicator)
        else if (cbData === "noop") {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: cb.id }),
          });
        }

        // Priority change: priority:urgent:{taskId}
        else if (cbData.startsWith("priority:")) {
          const parts = cbData.split(":");
          const newPriority = parts[1];
          const taskId = parts.slice(2).join(":");
          try {
            await fetch(`${PAPERCLIP_URL}/api/issues/${taskId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ priority: newPriority }),
            });
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ callback_query_id: cb.id, text: `⚡ Приоритет → ${newPriority}` }),
            });
            await addCommentToTask(taskId, `Приоритет изменён → **${newPriority}**`, `${member.name} (via Telegram)`);
          } catch (err) {
            console.error("Priority change error:", err.message);
          }
        }

        res.writeHead(200).end("ok");
        return;
      }

      const message = update.message || update.edited_message;

      if (message) {
        if (message.from?.is_bot) { res.writeHead(200).end("ok"); return; }
        if (chatId && message.chat?.id !== chatId) { res.writeHead(200).end("ok"); return; }
        if (isDuplicate(message.message_id)) { res.writeHead(200).end("ok"); return; }

        const member = resolveTeamMember(message);
        const from = `${member.name} (${member.role}, ${member.handle})`;
        const text = message.text || "";
        const lower = text.toLowerCase().trim();

        // ─── Handle pending agent task (after menu agent button) ───
        if (!globalThis.pendingAgentTasks) globalThis.pendingAgentTasks = {};
        if (globalThis.pendingAgentTasks[message.from?.id] && message.reply_to_message) {
          const agentKey = globalThis.pendingAgentTasks[message.from.id];
          delete globalThis.pendingAgentTasks[message.from.id];
          const agentSlug = AGENT_PROMPTS[agentKey]?.name ? (COMMANDS[`/${agentKey}`]?.agent || agentKey) : agentKey;
          const cmd = COMMANDS[`/${agentKey}`] || { agent: agentKey, emoji: "🤖", name: agentKey };
          await createTaskAndWake(cmd.agent || agentKey, cmd, from, text, member);
          res.writeHead(200).end("ok");
          return;
        }

        // ─── Handle pending input (done, block, assign, comment, fix) ───
        if (!globalThis.pendingInputs) globalThis.pendingInputs = {};
        if (globalThis.pendingInputs[message.from?.id] && message.reply_to_message) {
          const inputType = globalThis.pendingInputs[message.from.id];
          delete globalThis.pendingInputs[message.from.id];

          if (inputType === "done") {
            const identifier = text.trim().split(/\s+/)[0];
            const task = await findTaskByIdentifier(identifier);
            if (task) {
              await fetch(`${PAPERCLIP_URL}/api/issues/${task.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "done" }) });
              await addCommentToTask(task.id, "Закрыто через Telegram", from);
              await sendTelegram(`✅ <b>${identifier}</b> → done`);
            } else { await sendTelegram(`❌ Задача ${identifier} не найдена`); }
          } else if (inputType === "block") {
            const parts = text.trim().split(/\s+/);
            const identifier = parts[0];
            const reason = parts.slice(1).join(" ") || "Заблокировано";
            const task = await findTaskByIdentifier(identifier);
            if (task) {
              await fetch(`${PAPERCLIP_URL}/api/issues/${task.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "blocked" }) });
              await addCommentToTask(task.id, `🚫 ${reason}`, from);
              await sendTelegram(`🚫 <b>${identifier}</b> → blocked`);
            } else { await sendTelegram(`❌ ${identifier} не найдена`); }
          } else if (inputType === "assign") {
            const parts = text.trim().split(/\s+/);
            const identifier = parts[0];
            const agentSlug = parts[1];
            const task = await findTaskByIdentifier(identifier);
            const targetId = agentMap[agentSlug];
            if (task && targetId) {
              await fetch(`${PAPERCLIP_URL}/api/issues/${task.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assigneeAgentId: targetId, status: "todo" }) });
              await sendTelegram(`🔄 <b>${identifier}</b> → ${agentSlug}`);
              try { await fetch(`${PAPERCLIP_URL}/api/agents/${targetId}/wakeup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "reassign" }) }); } catch {}
            } else { await sendTelegram(`❌ Задача или агент не найдены`); }
          } else if (inputType === "comment") {
            const parts = text.trim().split(/\s+/);
            const identifier = parts[0];
            const commentText = parts.slice(1).join(" ");
            const task = await findTaskByIdentifier(identifier);
            if (task && commentText) {
              await addCommentToTask(task.id, commentText, from);
              await sendTelegram(`💬 Комментарий к <b>${identifier}</b>`);
            } else { await sendTelegram(`❌ Формат: AMRA-123 текст`); }
          } else if (inputType === "fix") {
            const itChefSlug = agentMap["it-chef"] ? "it-chef" : "staff-manager";
            const cmd = { agent: itChefSlug, emoji: "🔧", name: "IT Chef" };
            await createTaskAndWake(itChefSlug, cmd, from, `[TECH-ISSUE] ${text}`, member);
          } else if (inputType === "search_lead") {
            await handleCrmSearch(text.trim(), message.chat.id);
          }
          res.writeHead(200).end("ok");
          return;
        }

        // ─── Check for pending comment (after button press) ───
        if (!globalThis.pendingComments) globalThis.pendingComments = {};
        const pendingTaskId = globalThis.pendingComments[message.from?.id];
        if (pendingTaskId && message.reply_to_message) {
          delete globalThis.pendingComments[message.from.id];
          const comment = await addCommentToTask(pendingTaskId, text, from);
          if (comment) {
            await sendTelegram(`✅ Комментарий добавлен`);
          } else {
            await sendTelegram(`❌ Ошибка`);
          }
          res.writeHead(200).end("ok");
          return;
        }

        // ─── Reply to agent message → comment on linked task ───
        if (message.reply_to_message) {
          const replyToId = String(message.reply_to_message.message_id);
          const taskMap = loadTaskMap();
          const taskId = taskMap[replyToId];
          if (taskId) {
            const comment = await addCommentToTask(taskId, text, from);
            if (comment) {
              await sendTelegram(`✅ Комментарий добавлен к задаче`);
            } else {
              await sendTelegram(`❌ Не удалось добавить комментарий`);
            }
            res.writeHead(200).end("ok");
            return;
          }
          // Reply not linked to a task — fall through to normal handling
        }

        // ─── /done AMRA-123 → close task ───
        if (lower.startsWith("/done ")) {
          const identifier = text.slice(6).trim().split(/\s+/)[0];
          const task = await findTaskByIdentifier(identifier);
          if (task) {
            await fetch(`${PAPERCLIP_URL}/api/issues/${task.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "done" }),
            });
            await addCommentToTask(task.id, "Закрыто через Telegram", from);
            await sendTelegram(`✅ <b>${identifier}</b> → done`);
          } else {
            await sendTelegram(`❌ Задача ${identifier} не найдена`);
          }
          res.writeHead(200).end("ok");
          return;
        }

        // ─── /block AMRA-123 причина → block task ───
        if (lower.startsWith("/block ")) {
          const parts = text.slice(7).trim().split(/\s+/);
          const identifier = parts[0];
          const reason = parts.slice(1).join(" ") || "Заблокировано через TG";
          const task = await findTaskByIdentifier(identifier);
          if (task) {
            await fetch(`${PAPERCLIP_URL}/api/issues/${task.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "blocked" }),
            });
            await addCommentToTask(task.id, `🚫 Заблокировано: ${reason}`, from);
            await sendTelegram(`🚫 <b>${identifier}</b> → blocked\n<i>${reason}</i>`);
          } else {
            await sendTelegram(`❌ Задача ${identifier} не найдена`);
          }
          res.writeHead(200).end("ok");
          return;
        }

        // ─── /tasks → show open tasks ───
        if (lower === "/tasks") {
          try {
            const tasksRes = await fetch(`${PAPERCLIP_URL}/api/companies/${COMPANY_ID}/issues?status=todo,in_progress,blocked&limit=20`);
            const tasks = await tasksRes.json();
            if (Array.isArray(tasks) && tasks.length > 0) {
              const statusIcon = { todo: "⬜", in_progress: "🔄", blocked: "🚫", backlog: "📥" };
              const prioIcon = { urgent: "🔴", high: "🟠", medium: "🟡", low: "⚪", none: "⚪" };
              let msg = "📋 <b>Открытые задачи</b>\n\n";
              for (const t of tasks.slice(0, 15)) {
                const si = statusIcon[t.status] || "▪️";
                const pi = prioIcon[t.priority] || "";
                const assignee = t.assignee?.name || "—";
                msg += `${si}${pi} <b>${t.identifier}</b> ${(t.title || "").slice(0, 50)}\n   → ${assignee}\n`;
              }
              if (tasks.length > 15) msg += `\n... и ещё ${tasks.length - 15}`;
              await sendTelegram(msg);
            } else {
              await sendTelegram("✅ Нет открытых задач!");
            }
          } catch (err) {
            await sendTelegram(`❌ Ошибка: ${err.message}`);
          }
          res.writeHead(200).end("ok");
          return;
        }

        // ─── /assign AMRA-123 hunter → reassign task ───
        if (lower.startsWith("/assign ")) {
          const parts = text.slice(8).trim().split(/\s+/);
          const identifier = parts[0];
          const agentSlug = parts[1];
          if (!identifier || !agentSlug) {
            await sendTelegram("Формат: <code>/assign AMRA-123 hunter</code>");
            res.writeHead(200).end("ok");
            return;
          }
          const task = await findTaskByIdentifier(identifier);
          const targetAgentId = agentMap[agentSlug];
          if (!task) { await sendTelegram(`❌ Задача ${identifier} не найдена`); }
          else if (!targetAgentId) { await sendTelegram(`❌ Агент "${agentSlug}" не найден\nДоступные: ${Object.keys(agentMap).join(", ")}`); }
          else {
            await fetch(`${PAPERCLIP_URL}/api/issues/${task.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ assigneeAgentId: targetAgentId, status: "todo" }),
            });
            await addCommentToTask(task.id, `Переназначено → **${agentSlug}**`, from);
            const cmd = Object.values(COMMANDS).find(c => c.agent === agentSlug) || { emoji: "🤖", name: agentSlug };
            await sendTelegram(`${cmd.emoji} <b>${identifier}</b> → ${cmd.name}`);
            // Wake the target agent
            try {
              await fetch(`${PAPERCLIP_URL}/api/agents/${targetAgentId}/wakeup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: "telegram_reassign", context: `Reassigned from TG by ${from}` }),
              });
            } catch {}
          }
          res.writeHead(200).end("ok");
          return;
        }

        // ─── /c AMRA-123 текст → direct comment ───
        if (lower.startsWith("/c ") || lower.startsWith("/comment ")) {
          const parts = text.replace(/^\/c(omment)?\s+/i, "").split(/\s+/);
          const identifier = parts[0]; // e.g. AMRA-123
          const commentText = parts.slice(1).join(" ");
          if (identifier && commentText) {
            const task = await findTaskByIdentifier(identifier);
            if (task) {
              const comment = await addCommentToTask(task.id, commentText, from);
              if (comment) {
                await sendTelegram(`✅ Комментарий к <b>${identifier}</b>`);
              } else {
                await sendTelegram(`❌ Не удалось добавить комментарий к ${identifier}`);
              }
            } else {
              await sendTelegram(`❌ Задача ${identifier} не найдена`);
            }
          } else {
            await sendTelegram(`Формат: <code>/c AMRA-123 текст комментария</code>`);
          }
          res.writeHead(200).end("ok");
          return;
        }

        // Handle files/photos FIRST (before text processing)
        if (message.photo || message.document || message.voice || message.video) {
          await handleIncomingFile(message, member, from);
          res.writeHead(200).end("ok");
          return;
        }

        if (lower.startsWith("/help") || lower.startsWith("/start") || lower === "/menu" || lower === "меню") {
          await handleHelp(message.chat.id);
        } else if (lower === "/status") {
          await handleStatus();
        } else if (lower === "/pipeline") {
          await handlePipeline();
        } else if (lower === "/leads") {
          await handleLeads();
        } else if (lower.startsWith("/fix")) {
          const issue = text.slice(4).trim();
          if (issue) {
            const itChefSlug = agentMap["it-chef"] ? "it-chef" : "staff-manager";
            const cmd = { agent: itChefSlug, emoji: "🔧", name: "IT Chef" };
            await createTaskAndWake(itChefSlug, cmd, from, `[TECH-ISSUE] ${issue}`, member);
          } else {
            await sendTelegram("🔧 Напиши проблему после /fix\nПример: <code>/fix CRM не отвечает</code>");
          }
        } else {
          const parsed = parseCommand(text);
          if (parsed && parsed.message) {
            await createTaskAndWake(parsed.slug, parsed.cmd, from, parsed.message, member);
          } else if (parsed && !parsed.message) {
            await sendTelegram(`${parsed.cmd.emoji} Напиши сообщение после команды.\nПример: <code>${Object.keys(COMMANDS).find(k => COMMANDS[k].agent === parsed.slug)} текст задачи</code>`);
          } else {
            // No command → show main menu
            await sendMainMenu(message.chat.id);
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
