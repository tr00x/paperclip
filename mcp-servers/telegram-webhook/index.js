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

// Persistent pending state — survives webhook restarts
const PENDING_STATE_FILE = "/tmp/tg-pending-state.json";

function loadPendingState() {
  try {
    const data = JSON.parse(fs.readFileSync(PENDING_STATE_FILE, "utf8"));
    // Expire entries older than 10 minutes
    const now = Date.now();
    for (const [key, val] of Object.entries(data)) {
      if (val._ts && now - val._ts > 600000) delete data[key];
    }
    return data;
  } catch { return {}; }
}

function savePendingState(state) {
  try { fs.writeFileSync(PENDING_STATE_FILE, JSON.stringify(state)); } catch {}
}

function setPending(userId, type, value) {
  const state = loadPendingState();
  state[`${userId}:${type}`] = { value, _ts: Date.now() };
  savePendingState(state);
}

function getPending(userId, type) {
  const state = loadPendingState();
  const entry = state[`${userId}:${type}`];
  if (!entry) return null;
  if (Date.now() - entry._ts > 600000) { clearPending(userId, type); return null; }
  return entry.value;
}

function clearPending(userId, type) {
  const state = loadPendingState();
  delete state[`${userId}:${type}`];
  savePendingState(state);
}

function clearAllPending(userId) {
  const state = loadPendingState();
  for (const key of Object.keys(state)) {
    if (key.startsWith(`${userId}:`)) delete state[key];
  }
  savePendingState(state);
}

// Callback dedup: prevent double-click on buttons (track last 200 callback IDs)
const processedCallbacks = new Set();
const MAX_CB_DEDUP = 200;
function isCallbackDuplicate(cbId) {
  if (processedCallbacks.has(cbId)) return true;
  processedCallbacks.add(cbId);
  if (processedCallbacks.size > MAX_CB_DEDUP) {
    const first = processedCallbacks.values().next().value;
    processedCallbacks.delete(first);
  }
  return false;
}

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

  // Voice transcription via whisper.cpp + ffmpeg
  if (fileType === "voice" || fileType === "video") {
    try {
      const { execSync } = await import("node:child_process");
      const wavPath = file.localPath.replace(/\.[^.]+$/, ".wav");
      const outPath = file.localPath.replace(/\.[^.]+$/, "");
      // Convert to 16kHz mono WAV (whisper.cpp requirement)
      execSync(`ffmpeg -i "${file.localPath}" -ar 16000 -ac 1 -y "${wavPath}" 2>/dev/null`, { timeout: 15000 });
      // Run whisper.cpp
      const modelPath = "/usr/local/share/whisper-cpp/ggml-base.bin";
      execSync(`whisper -m "${modelPath}" -l auto -otxt -of "${outPath}" "${wavPath}" 2>/dev/null`, { timeout: 30000 });
      const txtFile = outPath + ".txt";
      const transcript = fs.existsSync(txtFile) ? fs.readFileSync(txtFile, "utf8").trim() : "";
      if (transcript) {
        caption = transcript;
        console.log(`  Whisper transcript: ${transcript.slice(0, 100)}`);
        await sendTelegram(`🎙 <b>Transcript:</b>\n<i>${transcript.slice(0, 500)}</i>`);
      }
      // Cleanup temp wav
      try { fs.unlinkSync(wavPath); } catch {}
    } catch (err) {
      console.log(`  Whisper failed: ${err.message?.slice(0, 80)}`);
    }
  }

  // Determine which agent to route to
  const parsed = parseCommand(caption);
  if (!parsed) {
    // No command in caption — ignore silently (people share files in group chat)
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
      // Send with task buttons so user can track/manage right from TG
      const confirmText = `${cmd.emoji} <b>${cmd.name}</b> принял задачу от <b>${member.name}</b>\n\n<i>${text.slice(0, 200)}</i>\n\n<i>↩ Reply = комментарий · Кнопки = действия</i>`;
      const buttons = taskId ? [
        [
          { text: "💬 Комментарий", callback_data: `comment:${taskId}` },
          { text: "✅ Готово", callback_data: `status:done:${taskId}` },
        ],
        [
          { text: "🚫 Блок", callback_data: `status:blocked:${taskId}` },
          { text: "⚡ Срочно", callback_data: `priority:urgent:${taskId}` },
        ],
      ] : [];
      const sendRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: confirmText,
          parse_mode: "HTML",
          reply_markup: buttons.length ? { inline_keyboard: buttons } : undefined,
        }),
      });
      // Save TG message → task mapping for reply-to-comment
      if (taskId) {
        try {
          const sendData = await sendRes.json();
          if (sendData.ok && sendData.result?.message_id) {
            const taskMap = loadTaskMap();
            taskMap[String(sendData.result.message_id)] = taskId;
            const keys = Object.keys(taskMap);
            if (keys.length > 500) { for (const k of keys.slice(0, keys.length - 500)) delete taskMap[k]; }
            fs.writeFileSync(TG_TASK_MAP_FILE, JSON.stringify(taskMap));
          }
        } catch {}
      }
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

async function sendChatAction(targetChatId, action = "typing") {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: targetChatId || chatId, action }),
    });
  } catch {}
}

async function answerCb(cbId, text = "", showAlert = false) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: cbId, text, show_alert: showAlert }),
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
    text: `🤖 <b>AmriTech AI HQ</b>

12 AI agents on duty 24/7. Pick a section:`,
    buttons: [
      [
        { text: "✍️ Message Agent", callback_data: "menu:agents" },
        { text: "📊 Status", callback_data: "action:status" },
      ],
      [
        { text: "📈 Sales", callback_data: "menu:sales" },
        { text: "📋 CRM", callback_data: "menu:crm" },
      ],
      [
        { text: "🗂 Tasks", callback_data: "menu:tasks" },
        { text: "💰 Finance", callback_data: "menu:finance" },
      ],
      [
        { text: "🏛 Gov Contracts", callback_data: "menu:gov" },
        { text: "📝 Documents", callback_data: "menu:docs" },
      ],
      [
        { text: "📬 Approvals", callback_data: "action:approvals" },
        { text: "⚠️ Errors", callback_data: "action:failed" },
      ],
      [
        { text: "🔧 Fix Something", callback_data: "menu:fix" },
        { text: "❓ Help", callback_data: "menu:help" },
      ],
    ],
  },
  sales: {
    text: `📈 <b>Sales</b>

<b>Hunter</b> — finds companies with bad IT
<b>SDR</b> — sends personalized cold emails
<b>Closer</b> — preps call briefings

Assign a task or view data:`,
    buttons: [
      [
        { text: "📊 Pipeline", callback_data: "action:pipeline" },
        { text: "📋 Outreach", callback_data: "action:leads" },
      ],
      [
        { text: "🔍 Find Clients", callback_data: "agent:hunter" },
        { text: "📧 Cold Email", callback_data: "agent:sdr" },
      ],
      [
        { text: "🤝 Prep Call", callback_data: "agent:closer" },
        { text: "👑 Coordinator", callback_data: "agent:ceo" },
      ],
      [{ text: "« Main Menu", callback_data: "menu:main" }],
    ],
  },
  tasks: {
    text: `🗂 <b>Tasks</b>

All agent tasks. Statuses:
⬜ todo · 🔄 in progress · 🚫 blocked · ✅ done`,
    buttons: [
      [{ text: "📋 Open Tasks", callback_data: "action:tasks" }],
      [
        { text: "✅ Close", callback_data: "input:done" },
        { text: "🚫 Block", callback_data: "input:block" },
        { text: "🔄 Reassign", callback_data: "input:assign" },
      ],
      [{ text: "💬 Comment on Task", callback_data: "input:comment" }],
      [{ text: "« Main Menu", callback_data: "menu:main" }],
    ],
  },
  finance: {
    text: `💰 <b>Finance & Contracts</b>

Pick an agent — they'll get the task:

<b>Finance</b> — invoices, MRR, overdue
<b>Contract</b> — contracts, renewals, SLA
<b>Legal</b> — MSA, NDA, compliance
<b>Onboarding</b> — first 30 days`,
    buttons: [
      [
        { text: "💰 Invoices / MRR", callback_data: "agent:finance" },
        { text: "📋 Contracts", callback_data: "agent:contract" },
      ],
      [
        { text: "⚖️ Legal Review", callback_data: "agent:legal" },
        { text: "🚀 Onboarding", callback_data: "agent:onboard" },
      ],
      [{ text: "« Main Menu", callback_data: "menu:main" }],
    ],
  },
  gov: {
    text: `🏛 <b>Gov Contracts</b>

Sam.gov, HBITS, NYC DOE and more.`,
    buttons: [
      [
        { text: "🔍 Find Tenders", callback_data: "agent:gov" },
        { text: "📝 Write Proposal", callback_data: "agent:proposal" },
      ],
      [{ text: "📋 Tenders in CRM", callback_data: "crm:tenders" }],
      [{ text: "« Main Menu", callback_data: "menu:main" }],
    ],
  },
  fix: {
    text: `🔧 <b>Something Broken?</b>

IT Chef will handle it. Pick an issue:`,
    buttons: [
      [
        { text: "🤖 Agents Down", callback_data: "quickfix:agents" },
        { text: "📊 CRM Down", callback_data: "quickfix:crm" },
      ],
      [
        { text: "📧 Email Broken", callback_data: "quickfix:email" },
        { text: "🔧 Other...", callback_data: "input:fix" },
      ],
      [{ text: "« Main Menu", callback_data: "menu:main" }],
    ],
  },
  docs: {
    text: `📝 <b>Documents</b>

Agents will prepare what you need:`,
    buttons: [
      [
        { text: "📝 Proposal", callback_data: "agent:proposal" },
        { text: "⚖️ MSA / NDA", callback_data: "agent:legal" },
      ],
      [{ text: "📋 Contract", callback_data: "agent:contract" }],
      [{ text: "« Main Menu", callback_data: "menu:main" }],
    ],
  },
  agents: {
    text: `✍️ <b>Message an Agent</b>

Tap an agent — then type your task in chat.
Agent wakes up and starts working immediately.`,
    buttons: [
      [
        { text: "🔍 Hunter — leads", callback_data: "agent:hunter" },
        { text: "📧 SDR — email", callback_data: "agent:sdr" },
      ],
      [
        { text: "🤝 Closer — calls", callback_data: "agent:closer" },
        { text: "👑 CEO — strategy", callback_data: "agent:ceo" },
      ],
      [
        { text: "📋 Contracts", callback_data: "agent:contract" },
        { text: "💰 Finance", callback_data: "agent:finance" },
      ],
      [
        { text: "⚖️ Legal", callback_data: "agent:legal" },
        { text: "🚀 Onboarding", callback_data: "agent:onboard" },
      ],
      [
        { text: "🏛 Gov Scout", callback_data: "agent:gov" },
        { text: "📝 Proposal", callback_data: "agent:proposal" },
      ],
      [
        { text: "🛟 Staff Manager", callback_data: "agent:staff" },
        { text: "🔧 IT Chef", callback_data: "agent:chef" },
      ],
      [{ text: "« Main Menu", callback_data: "menu:main" }],
    ],
  },
  crm: {
    text: `📋 <b>CRM</b> · Lead Database

Live data from Twenty CRM:`,
    buttons: [
      [
        { text: "📈 Pipeline", callback_data: "crm:pipeline" },
        { text: "📊 Stats", callback_data: "crm:stats" },
      ],
      [
        { text: "🔥 Top 70+", callback_data: "crm:hot" },
        { text: "💬 Replied", callback_data: "crm:replied" },
      ],
      [
        { text: "📧 In Outreach", callback_data: "crm:outreach" },
        { text: "🆕 New", callback_data: "crm:new" },
      ],
      [
        { text: "💤 Nurture", callback_data: "crm:nurture" },
        { text: "❌ Lost", callback_data: "crm:lost" },
      ],
      [{ text: "🔍 Search Company", callback_data: "input:search_lead" }],
      [
        { text: "👥 Clients", callback_data: "crm:clients" },
        { text: "🏛 Tenders", callback_data: "crm:tenders" },
      ],
      [{ text: "« Main Menu", callback_data: "menu:main" }],
    ],
  },
  help: {
    text: `❓ <b>Help</b>

<b>Buttons</b> — everything through this menu
<b>Reply</b> to agent message = comment on task

<b>Text commands:</b>
<code>/hunter find dental clinics NJ</code>
<code>/sdr email ABC Dental</code>
<code>/chef CRM is slow</code>

<b>Task management:</b>
<code>/done AMRA-123</code> — close
<code>/block AMRA-123 reason</code> — block
<code>/assign AMRA-123 hunter</code> — reassign
<code>/c AMRA-123 text</code> — comment

Buttons under agent messages = one-tap actions`,
    buttons: [
      [{ text: "« Main Menu", callback_data: "menu:main" }],
    ],
  },
};

// Agent prompt map: when button pressed, ask for task text
const AGENT_PROMPTS = {
  hunter: { emoji: "🔍", name: "Hunter", prompt: "Опиши кого искать (ниша, район, кол-во):" },
  sdr: { emoji: "📧", name: "SDR", prompt: "Что нужно? (написать email, follow-up, проверить inbox):" },
  closer: { emoji: "🤝", name: "Closer", prompt: "Для какой компании подготовить briefing?" },
  ceo: { emoji: "👑", name: "CEO", prompt: "What do you need from the coordinator?" },
  gov: { emoji: "🏛️", name: "Gov Scout", prompt: "What to find? (niche, NAICS, region):" },
  proposal: { emoji: "📝", name: "Proposal Writer", prompt: "Who is the proposal for?" },
  contract: { emoji: "📋", name: "Contract Manager", prompt: "Which contract/client?" },
  finance: { emoji: "💰", name: "Finance Tracker", prompt: "What do you need? (invoice, MRR, report):" },
  legal: { emoji: "⚖️", name: "Legal Assistant", prompt: "What to review? (MSA, NDA, compliance):" },
  onboard: { emoji: "🚀", name: "Onboarding", prompt: "Which client to onboard?" },
  staff: { emoji: "🛟", name: "Staff Manager", prompt: "Question about the system or agents?" },
  chef: { emoji: "🔧", name: "IT Chef", prompt: "What to fix or check?" },
};

const INPUT_PROMPTS = {
  done: "Type task ID (e.g. AMRA-123):",
  block: "Type: AMRA-123 reason for blocking",
  assign: "Type: AMRA-123 agent_name (e.g. AMRA-123 hunter)",
  comment: "Type: AMRA-123 your comment text",
  fix: "Describe the issue — IT Chef will handle it:",
  search_lead: "Type company name (or part of it):",
};

async function sendMainMenu(targetChatId, messageId = null) {
  const menu = MENUS.main;
  if (messageId) {
    // Try to edit existing message to photo+caption (handles back-to-main)
    const capRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageCaption`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: targetChatId,
        message_id: messageId,
        caption: menu.text,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: menu.buttons },
      }),
    });
    const capData = await capRes.json();
    if (capData.ok) return;
    // If edit fails, delete and re-send
    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: targetChatId, message_id: messageId }),
      });
    } catch {}
  }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: targetChatId,
      photo: "https://amritech.us/assets/images/logo.png",
      caption: menu.text,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: menu.buttons },
    }),
  });
}

async function editMenu(targetChatId, messageId, menuKey) {
  const menu = MENUS[menuKey];
  if (!menu) return;

  // Try editMessageCaption first (keeps logo photo visible)
  const capRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageCaption`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: targetChatId,
      message_id: messageId,
      caption: menu.text,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: menu.buttons },
    }),
  });
  const capData = await capRes.json();

  if (!capData.ok) {
    // Not a photo message — try editMessageText
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: targetChatId,
        message_id: messageId,
        text: menu.text,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: menu.buttons },
      }),
    });
    const data = await res.json();

    if (!data.ok) {
      // Last resort: delete old message and send fresh
      try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: targetChatId, message_id: messageId }),
        });
      } catch {}
      // Send new text message
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: targetChatId,
          text: menu.text,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: menu.buttons },
        }),
      });
    }
  }
}

const CRM_PAGE_SIZE = 10;

async function handleCrmQuery(type, targetChatId, page = 1, messageId = null) {
  const backBtn = [[{ text: "← CRM меню", callback_data: "menu:crm" }]];
  if (!TWENTY_API_KEY) { await editOrSend(targetChatId, messageId, "❌ CRM не настроен", backBtn); return; }
  const offset = (page - 1) * CRM_PAGE_SIZE;

  try {
    if (type === "hot") {
      const data = await crmQuery(`{ leads(filter: { icpScore: { gte: 70 } }, first: 100, orderBy: { icpScore: DescNullsLast }) { edges { node { id name status icpScore industry decisionMaker } } } }`);
      const all = data?.data?.leads?.edges || [];
      if (!all.length) { await editOrSend(targetChatId, messageId, "Нет лидов с высокой оценкой", backBtn); return; }
      const total = all.length;
      const pages = Math.ceil(total / CRM_PAGE_SIZE);
      const leads = all.slice(offset, offset + CRM_PAGE_SIZE);

      let msg = `🔥 <b>Лучшие лиды</b> (стр. ${page}/${pages})\n<i>Оценка = насколько подходит как клиент</i>\n\n`;
      for (const { node: l } of leads) {
        const statusRu = { new: "🆕новый", contacted: "📧email", engaged: "💬ответил", qualified: "✅подходит", nurture: "💤пауза" };
        msg += `<b>${l.icpScore}⭐ ${l.name}</b>\n`;
        msg += `   ${l.industry || "?"} | ${statusRu[l.status] || l.status} | DM: ${l.decisionMaker || "?"}\n`;
        msg += `\n`;
      }
      const btns = [];
      // Add top-3 lead detail buttons
      const leadBtns = leads.slice(0, 3).map(({ node: l }) => ({ text: `${l.icpScore}⭐ ${l.name?.slice(0,20)}`, callback_data: `lead:${l.id}` }));
      if (leadBtns.length) btns.push(leadBtns);
      const nav = [];
      if (page > 1) nav.push({ text: `← Стр.${page-1}`, callback_data: `crm:hot:${page-1}` });
      nav.push({ text: `${page}/${pages}`, callback_data: "noop" });
      if (page < pages) nav.push({ text: `Стр.${page+1} →`, callback_data: `crm:hot:${page+1}` });
      if (nav.length > 1) btns.push(nav);
      btns.push([{ text: "← CRM меню", callback_data: "menu:crm" }]);
      await editOrSend(targetChatId, messageId, msg, btns);
    }

    else if (type === "outreach") {
      const data = await crmQuery(`{ leads(filter: { status: { eq: "contacted" } }, first: 100) { edges { node { id name outreachStatus lastContactDate } } } }`);
      const all = data?.data?.leads?.edges || [];
      if (!all.length) { await editOrSend(targetChatId, messageId, "Нет лидов в рассылке", backBtn); return; }
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
      await editOrSend(targetChatId, messageId, msg, btns);
    }

    else if (type === "new") {
      const data = await crmQuery(`{ leads(filter: { status: { eq: "new" } }, first: 100, orderBy: { createdAt: DescNullsLast }) { edges { node { id name icpScore industry } } } }`);
      const all = data?.data?.leads?.edges || [];
      if (!all.length) { await editOrSend(targetChatId, messageId, "✅ Нет новых — SDR всё разобрал!", backBtn); return; }
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
      await editOrSend(targetChatId, messageId, msg, btns);
    }

    else if (type === "replied") {
      const data = await crmQuery(`{ leads(filter: { status: { eq: "engaged" } }, first: 100, orderBy: { lastContactDate: DescNullsLast }) { edges { node { id name icpScore industry decisionMaker lastContactDate outreachStatus notes } } } }`);
      const all = data?.data?.leads?.edges || [];
      if (!all.length) { await editOrSend(targetChatId, messageId, "Пока никто не ответил на email 😔\n💡 <i>SDR продолжает рассылку.</i>", backBtn); return; }
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
      await editOrSend(targetChatId, messageId, msg, btns);
    }

    else if (type === "nurture") {
      const data = await crmQuery(`{ leads(filter: { status: { eq: "nurture" } }, first: 100, orderBy: { icpScore: DescNullsLast }) { edges { node { id name icpScore industry lastContactDate } } } }`);
      const all = data?.data?.leads?.edges || [];
      if (!all.length) { await editOrSend(targetChatId, messageId, "Нет лидов на паузе", backBtn); return; }
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
      await editOrSend(targetChatId, messageId, msg, btns);
    }

    else if (type === "lost") {
      const data = await crmQuery(`{ leads(filter: { status: { eq: "closed" } }, first: 100, orderBy: { updatedAt: DescNullsLast }) { edges { node { id name icpScore industry notes } } } }`);
      const all = data?.data?.leads?.edges || [];
      if (!all.length) { await editOrSend(targetChatId, messageId, "Нет отказов — отлично!", backBtn); return; }
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
      await editOrSend(targetChatId, messageId, msg, btns);
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

      await editOrSend(targetChatId, messageId, msg, backBtn);
    }

    else if (type === "tenders") {
      const data = await crmQuery(`{ tenders(first: 100, orderBy: { createdAt: DescNullsLast }) { edges { node { id name status setAside createdAt } } } }`);
      const all = data?.data?.tenders?.edges || [];
      if (!all.length) { await editOrSend(targetChatId, messageId, "Нет тендеров.\n💡 <i>Gov Scout ищет — скоро появятся!</i>", backBtn); return; }
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
      await editOrSend(targetChatId, messageId, msg, btns);
    }

    else if (type === "clients") {
      const data = await crmQuery(`{ clients(first: 100) { edges { node { id name services } } } }`);
      const all = data?.data?.clients?.edges || [];
      if (!all.length) { await editOrSend(targetChatId, messageId, "Пока нет клиентов.\n💡 <i>@ikberik — внеси текущих клиентов!</i>", backBtn); return; }
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
      await editOrSend(targetChatId, messageId, msg, btns);
    }
  } catch (err) {
    await editOrSend(targetChatId, messageId, `❌ Ошибка CRM: ${err.message}`, backBtn);
  }
}

// Edit existing message in place — NEVER sends new messages to avoid chat spam
async function editOrSend(targetChatId, messageId, text, buttons) {
  const cid = targetChatId || chatId;
  const markup = buttons?.length ? { inline_keyboard: buttons } : { inline_keyboard: [] };
  if (!messageId) return; // No message to edit — silently skip

  // Try caption first (photo messages keep logo)
  const capRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageCaption`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: cid, message_id: messageId, caption: text, parse_mode: "HTML", reply_markup: markup }),
  });
  const capData = await capRes.json();
  if (capData.ok) return;

  // Not a photo — edit as text
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: cid, message_id: messageId, text, parse_mode: "HTML", reply_markup: markup }),
  });
}

// Delete a message after delay (cleanup menu after action)
function deleteMessageLater(targetChatId, messageId, delayMs = 3000) {
  setTimeout(async () => {
    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: targetChatId, message_id: messageId }),
      });
    } catch {}
  }, delayMs);
}

async function handleCrmSearch(query, targetChatId) {
  if (!TWENTY_API_KEY) { await sendTelegram("❌ CRM не настроен"); return; }
  try {
    const safeQuery = query.replace(/["\\\n\r]/g, "");
    const data = await crmQuery(`{ leads(filter: { name: { like: "%${safeQuery}%" } }, first: 10) { edges { node { id name companyName status outreachStatus icpScore industry decisionMaker decisionMakerEmail phone { primaryPhoneNumber } lastContactDate notes createdAt } } } }`);
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

// Inline versions (edit in place with back button)
async function handleStatusInline(chtId, msgId) {
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
  } catch { agentStatus = "❌ Paperclip недоступен\n"; }

  let pipeline = "";
  if (TWENTY_API_KEY) {
    const data = await crmQuery(`{ leads { edges { node { status } } } }`);
    const leads = data?.data?.leads?.edges || [];
    const byStatus = {};
    for (const { node } of leads) byStatus[node.status] = (byStatus[node.status] || 0) + 1;
    pipeline = Object.entries(byStatus).map(([k, v]) => `  ${k}: ${v}`).join("\n") || "пусто";
  }

  const now = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "America/New_York" });
  await editOrSend(chtId, msgId,
    `📊 <b>Статус штаба</b>\n\n<b>Агенты:</b>\n${agentStatus}\n<b>Pipeline:</b>\n${pipeline}\n<i>Обновлено: ${now} ET</i>`,
    [
      [{ text: "🔄 Обновить", callback_data: "action:status" }],
      [{ text: "← Главное меню", callback_data: "menu:main" }],
    ]
  );
}

async function handlePipelineInline(chtId, msgId) {
  if (!TWENTY_API_KEY) { await editOrSend(chtId, msgId, "❌ CRM не настроен", [[{ text: "← Назад", callback_data: "menu:main" }]]); return; }
  const data = await crmQuery(`{ leads { edges { node { name status icpScore } } } }`);
  const leads = data?.data?.leads?.edges || [];
  const stages = {};
  for (const { node } of leads) {
    const s = node.status || "new";
    if (!stages[s]) stages[s] = [];
    stages[s].push(node.name);
  }
  const icons = { new: "⬜", qualified: "🟦", contacted: "📧", engaged: "💬", meeting_set: "📞", closed_won: "✅", closed_lost: "❌", nurture: "💤" };
  let msg = "📈 <b>Воронка продаж</b>\n\n";
  for (const [stage, names] of Object.entries(stages)) {
    if (names.length > 0) {
      msg += `${icons[stage] || "▪️"} <b>${stage}</b> (${names.length}):\n`;
      for (const n of names.slice(0, 5)) msg += `  • ${n}\n`;
      if (names.length > 5) msg += `  ... и ещё ${names.length - 5}\n`;
      msg += "\n";
    }
  }
  msg += `<b>Всего:</b> ${leads.length} лидов`;
  await editOrSend(chtId, msgId, msg, [
    [{ text: "🔄 Обновить", callback_data: "action:pipeline" }, { text: "📊 CRM", callback_data: "menu:crm" }, { text: "← Главное меню", callback_data: "menu:main" }]
  ]);
}

async function handleLeadsInline(chtId, msgId) {
  if (!TWENTY_API_KEY) { await editOrSend(chtId, msgId, "❌ CRM не настроен", [[{ text: "← Назад", callback_data: "menu:main" }]]); return; }
  const data = await crmQuery(`{ leads { edges { node { outreachStatus decisionMakerEmail } } } }`);
  const leads = data?.data?.leads?.edges || [];
  const byOutreach = {};
  let withEmail = 0, withoutEmail = 0;
  for (const { node } of leads) {
    const s = node.outreachStatus || "pending";
    byOutreach[s] = (byOutreach[s] || 0) + 1;
    if (node.decisionMakerEmail) withEmail++; else withoutEmail++;
  }
  const icons = { pending: "⬜", email_sent: "📧", follow_up_1: "📧📧", follow_up_2: "📧📧📧", replied_interested: "🔥", replied_question: "❓", replied_objection: "🤔", not_interested: "❌", no_response: "😶", meeting_scheduled: "📞" };
  let msg = "📋 <b>Статус рассылки</b>\n\n";
  for (const [status, count] of Object.entries(byOutreach)) {
    msg += `${icons[status] || "▪️"} ${status}: <b>${count}</b>\n`;
  }
  msg += `\n📧 С email: ${withEmail} | Без email: ${withoutEmail}\n<b>Всего:</b> ${leads.length}`;
  await editOrSend(chtId, msgId, msg, [
    [{ text: "🔄 Обновить", callback_data: "action:leads" }, { text: "📊 CRM", callback_data: "menu:crm" }, { text: "← Главное меню", callback_data: "menu:main" }]
  ]);
}

async function handleTasksInline(chtId, msgId, page = 1) {
  const TASKS_PAGE_SIZE = 10;
  try {
    const tasksRes = await fetch(`${PAPERCLIP_URL}/api/companies/${COMPANY_ID}/issues?status=todo,in_progress,blocked&limit=100`);
    const allTasks = await tasksRes.json();
    if (!Array.isArray(allTasks) || allTasks.length === 0) {
      await editOrSend(chtId, msgId, "✅ Нет открытых задач!", [[{ text: "← Главное меню", callback_data: "menu:main" }]]);
      return;
    }
    const total = allTasks.length;
    const pages = Math.ceil(total / TASKS_PAGE_SIZE);
    const offset = (page - 1) * TASKS_PAGE_SIZE;
    const tasks = allTasks.slice(offset, offset + TASKS_PAGE_SIZE);

    const si = { todo: "⬜", in_progress: "🔄", blocked: "🚫", backlog: "📥" };
    const pi = { urgent: "🔴", high: "🟠", medium: "🟡", low: "⚪" };
    let msg = `📋 <b>Открытые задачи</b> (стр. ${page}/${pages})\n<i>Всего: ${total}</i>\n\n`;
    for (const t of tasks) {
      const assignee = t.assignee?.name || "—";
      msg += `${si[t.status]||"▪️"}${pi[t.priority]||""} <b>${t.identifier}</b> ${(t.title||"").slice(0,40)}\n   → ${assignee}\n`;
    }
    const btns = [];
    const nav = [];
    if (page > 1) nav.push({ text: `← Стр.${page-1}`, callback_data: `tasks:page:${page-1}` });
    nav.push({ text: `${page}/${pages}`, callback_data: "noop" });
    if (page < pages) nav.push({ text: `Стр.${page+1} →`, callback_data: `tasks:page:${page+1}` });
    if (nav.length > 1) btns.push(nav);
    btns.push([{ text: "🔄 Обновить", callback_data: "tasks:page:" + page }]);
    btns.push([{ text: "← Задачи", callback_data: "menu:tasks" }, { text: "← Главное", callback_data: "menu:main" }]);
    await editOrSend(chtId, msgId, msg, btns);
  } catch (err) {
    await editOrSend(chtId, msgId, `❌ Ошибка: ${err.message}`, [[{ text: "← Главное меню", callback_data: "menu:main" }]]);
  }
}

async function handleApprovalsInline(chtId, msgId) {
  try {
    const res = await fetch(`${PAPERCLIP_URL}/api/companies/${COMPANY_ID}/approvals?status=pending`);
    const approvals = await res.json();
    if (!Array.isArray(approvals) || approvals.length === 0) {
      await editOrSend(chtId, msgId, "✅ Нет ожидающих одобрений", [[{ text: "« Главное меню", callback_data: "menu:main" }]]);
      return;
    }
    const typeRu = { hire_agent: "Найм агента", approve_ceo_strategy: "Стратегия CEO", budget_override_required: "Превышение бюджета" };
    let msg = `<b>Ожидают одобрения</b> (${approvals.length})\n\n`;
    const btns = [];
    for (const a of approvals.slice(0, 5)) {
      const type = typeRu[a.type] || a.type;
      const who = a.requestedByAgentName || "агент";
      const payload = a.payload || {};
      const desc = payload.description || payload.reason || payload.agentName || JSON.stringify(payload).slice(0, 80);
      msg += `<b>${type}</b> от ${who}\n${desc}\n\n`;
      btns.push([
        { text: "✅ Одобрить", callback_data: `approve:${a.id}` },
        { text: "❌ Отклонить", callback_data: `reject:${a.id}` },
      ]);
    }
    btns.push([{ text: "« Главное меню", callback_data: "menu:main" }]);
    await editOrSend(chtId, msgId, msg, btns);
  } catch (err) {
    await editOrSend(chtId, msgId, `❌ ${err.message}`, [[{ text: "« Главное меню", callback_data: "menu:main" }]]);
  }
}

async function handleFailedRunsInline(chtId, msgId) {
  try {
    const res = await fetch(`${PAPERCLIP_URL}/api/companies/${COMPANY_ID}/heartbeat-runs?status=error&limit=5`);
    const runs = await res.json();
    if (!Array.isArray(runs) || runs.length === 0) {
      await editOrSend(chtId, msgId, "✅ Нет упавших запусков", [[{ text: "« Главное меню", callback_data: "menu:main" }]]);
      return;
    }
    let msg = `<b>Последние ошибки</b>\n\n`;
    for (const r of runs.slice(0, 5)) {
      const name = r.agentName || r.agent?.name || "?";
      const ago = r.createdAt ? Math.round((Date.now() - new Date(r.createdAt)) / 60000) : "?";
      const err = (r.error || "unknown").slice(0, 80);
      msg += `<b>${name}</b> — ${ago}м назад\n<code>${err}</code>\n\n`;
    }
    await editOrSend(chtId, msgId, msg, [[{ text: "« Главное меню", callback_data: "menu:main" }]]);
  } catch (err) {
    await editOrSend(chtId, msgId, `❌ ${err.message}`, [[{ text: "« Главное меню", callback_data: "menu:main" }]]);
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
      console.log("[DEBUG] update:", JSON.stringify({id: update.update_id, msg: update.message?.text?.slice(0,30), chat: update.message?.chat?.id, cb: !!update.callback_query}));

      // ─── Handle inline button press ───
      if (update.callback_query) {
        const cb = update.callback_query;
        const cbData = cb.data || "";
        const member = resolveTeamMember(cb);

        // Dedup: prevent double-click (except noop and menu navigation)
        if (!cbData.startsWith("menu:") && cbData !== "noop" && !cbData.startsWith("crm:") && !cbData.startsWith("action:") && !cbData.startsWith("tasks:page:") && !cbData.startsWith("lead:") && !cbData.startsWith("leadact:")) {
          if (isCallbackDuplicate(cb.id)) {
            await answerCb(cb.id, "⏳ Уже обрабатываю...");
            res.writeHead(200).end("ok");
            return;
          }
        }

        if (cbData.startsWith("comment:")) {
          const taskId = cbData.slice(8);
          setPending(cb.from.id, "comment", taskId);
          await answerCb(cb.id, "Напиши комментарий в чат");
          const origText = cb.message?.text || cb.message?.caption || "";
          await editOrSend(cb.message.chat.id, cb.message.message_id,
            origText + `\n\n<i>Жду комментарий от ${member.name}...</i>`,
            [[{ text: "Отмена", callback_data: "menu:main" }]]);
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
              await answerCb(cb.id, `${statusEmoji[newStatus] || "✓"} Статус → ${newStatus}`);
              await addCommentToTask(taskId, `Статус изменён → **${newStatus}**`, `${member.name} (via Telegram)`);
              // Update message inline — replace buttons with confirmation
              const origText = cb.message?.text || cb.message?.caption || "";
              const confirmText = origText + `\n\n${statusEmoji[newStatus] || "✓"} <b>Статус → ${newStatus}</b> — ${member.name}`;
              await editOrSend(cb.message.chat.id, cb.message.message_id, confirmText, [
                [{ text: "💬 Комментарий", callback_data: `comment:${taskId}` }],
              ]);
            } else {
              await answerCb(cb.id, "❌ Ошибка", true);
            }
          } catch (err) {
            console.error("Status change error:", err.message);
          }
        }

        // Menu navigation: menu:sales, menu:tasks, etc.
        else if (cbData.startsWith("menu:")) {
          const menuKey = cbData.slice(5);
          // Clear any pending state when navigating menus (user cancelled)
          if (cb.from?.id) clearAllPending(cb.from.id);
          if (menuKey === "main") {
            await sendMainMenu(cb.message.chat.id, cb.message.message_id);
          } else {
            await editMenu(cb.message.chat.id, cb.message.message_id, menuKey);
          }
          await answerCb(cb.id);
        }

        // Action: execute quick command (status, pipeline, leads, tasks)
        else if (cbData.startsWith("action:")) {
          const action = cbData.slice(7);
          const msgId = cb.message.message_id;
          const chtId = cb.message.chat.id;
          await answerCb(cb.id, "⏳ Загрузка...");
          await sendChatAction(chtId);

          if (action === "status") {
            await handleStatusInline(chtId, msgId);
          } else if (action === "pipeline") {
            await handlePipelineInline(chtId, msgId);
          } else if (action === "leads") {
            await handleLeadsInline(chtId, msgId);
          } else if (action === "tasks") {
            await handleTasksInline(chtId, msgId, 1);
          } else if (action === "approvals") {
            await handleApprovalsInline(chtId, msgId);
          } else if (action === "failed") {
            await handleFailedRunsInline(chtId, msgId);
          }
        }

        // Task pagination
        else if (cbData.startsWith("tasks:page:")) {
          const page = parseInt(cbData.split(":")[2]) || 1;
          await answerCb(cb.id, "⏳ Загрузка...");
          await sendChatAction(cb.message.chat.id);
          await handleTasksInline(cb.message.chat.id, cb.message.message_id, page);
        }

        // Agent: edit menu to prompt, wait for next text message
        else if (cbData.startsWith("agent:")) {
          const agentKey = cbData.slice(6);
          const ap = AGENT_PROMPTS[agentKey];
          if (ap) {
            setPending(cb.from.id, "agent", agentKey);
            await answerCb(cb.id, ap.name);
            await editOrSend(cb.message.chat.id, cb.message.message_id,
              `<b>${ap.name}</b>\n\n${ap.prompt}\n\n<i>Напиши текст задачи прямо в чат.</i>`,
              [[{ text: "Отмена", callback_data: "menu:agents" }]]);
          }
        }

        // Input: edit menu to prompt, wait for next text message
        else if (cbData.startsWith("input:")) {
          const inputType = cbData.slice(6);
          const prompt = INPUT_PROMPTS[inputType];
          if (prompt) {
            setPending(cb.from.id, "input", inputType);
            const cancelMenu = inputType === "search_lead" ? "menu:crm" : inputType === "fix" ? "menu:fix" : "menu:tasks";
            await answerCb(cb.id);
            await editOrSend(cb.message.chat.id, cb.message.message_id,
              `${prompt}\n\n<i>Напиши прямо в чат.</i>`,
              [[{ text: "Отмена", callback_data: cancelMenu }]]);
          }
        }

        // Quick fix: predefined IT issues
        else if (cbData.startsWith("quickfix:")) {
          const issue = cbData.slice(9);
          const issues = { agents: "Агенты не отвечают / зависли", crm: "CRM (Twenty) не грузится", email: "Email не отправляется" };
          const itChefSlug = agentMap["it-chef"] ? "it-chef" : "staff-manager";
          const cmd = { agent: itChefSlug, emoji: "🔧", name: "IT Chef" };
          await answerCb(cb.id, "🔧 IT Chef на связи!");
          // Delete menu — createTaskAndWake sends its own confirmation with buttons
          deleteMessageLater(cb.message.chat.id, cb.message.message_id, 500);
          await createTaskAndWake(itChefSlug, cmd, `${member.name} (via menu)`, `[TECH-ISSUE] ${issues[issue] || issue}`, member);
        }

        // CRM queries: crm:pipeline, crm:hot, crm:outreach, crm:new, crm:clients
        else if (cbData.startsWith("crm:")) {
          const crmAction = cbData.slice(4);
          await answerCb(cb.id, "⏳ Загружаю...");
          await sendChatAction(cb.message.chat.id);

          if (crmAction === "pipeline") {
            await handlePipelineInline(cb.message.chat.id, cb.message.message_id);
          } else {
            const parts = crmAction.split(":");
            const queryType = parts[0];
            const page = parseInt(parts[1]) || 1;
            if (["hot", "outreach", "new", "clients", "replied", "nurture", "lost", "stats", "tenders"].includes(queryType)) {
              await handleCrmQuery(queryType, cb.message.chat.id, page, cb.message.message_id);
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
            await answerCb(cb.id, decisionText[decision]?.slice(0, 50) || "✓");
            // Edit original message — remove decision buttons, show result
            const origText = cb.message?.text || cb.message?.caption || "";
            await editOrSend(cb.message.chat.id, cb.message.message_id,
              origText + `\n\n${decisionText[decision]}\n<i>— ${member.name}</i>`, []);
          } catch (err) { console.error("Decision error:", err.message); }
        }

        // Ula call results: call:done/miss/later/won/lost:{taskId}
        else if (cbData.startsWith("call:")) {
          const parts = cbData.split(":");
          const result = parts[1];
          const taskId = parts.slice(2).join(":");

          if (result === "done") {
            setPending(cb.from.id, "comment", taskId);
            await answerCb(cb.id, "Напиши результат в чат");
            const origText = cb.message?.text || cb.message?.caption || "";
            await editOrSend(cb.message.chat.id, cb.message.message_id,
              origText + `\n\n<i>Жду результат звонка от ${member.name}...</i>`,
              [[{ text: "Отмена", callback_data: "menu:main" }]]);
          } else if (result === "miss") {
            await addCommentToTask(taskId, "📞 Не дозвонился. Перезвоню.", `${member.name} (via Telegram)`);
            await answerCb(cb.id, "📞 Не дозвонился — записано");
            const origText = cb.message?.text || cb.message?.caption || "";
            await editOrSend(cb.message.chat.id, cb.message.message_id,
              origText + `\n\n📞 <b>Не дозвонился</b> — ${member.name}`,
              [[{ text: "📞 Перезвонить", callback_data: `call:done:${taskId}` }]]);
          } else if (result === "later") {
            await addCommentToTask(taskId, "⏰ Перезвоню позже.", `${member.name} (via Telegram)`);
            await answerCb(cb.id, "⏰ Окей, перезвонишь позже");
            const origText = cb.message?.text || cb.message?.caption || "";
            await editOrSend(cb.message.chat.id, cb.message.message_id,
              origText + `\n\n⏰ <b>Перезвоню позже</b> — ${member.name}`,
              [[{ text: "📞 Перезвонить", callback_data: `call:done:${taskId}` }]]);
          } else if (result === "won") {
            await addCommentToTask(taskId, "🎉 КЛИЕНТ СОГЛАСЕН! Закрываем!", `${member.name} (via Telegram)`);
            await fetch(`${PAPERCLIP_URL}/api/issues/${taskId}`, {
              method: "PATCH", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "done" }),
            });
            await answerCb(cb.id, "🎉 Поздравляем!!!");
            // Edit original to show win, send celebration to group
            const origText = cb.message?.text || cb.message?.caption || "";
            await editOrSend(cb.message.chat.id, cb.message.message_id,
              origText + `\n\n🎉🎉🎉 <b>КЛИЕНТ СОГЛАСЕН!</b> — ${member.name}`, []);
            await sendTelegram(`🎉🎉🎉 <b>НОВЫЙ КЛИЕНТ!</b>\n\n<b>${member.name}</b> закрыл сделку!\n\n💡 <i>Onboarding и Contract Manager запустятся автоматически.</i>`);
          } else if (result === "lost") {
            setPending(cb.from.id, "comment", taskId);
            await answerCb(cb.id, "Напиши причину в чат");
            const origText = cb.message?.text || cb.message?.caption || "";
            await editOrSend(cb.message.chat.id, cb.message.message_id,
              origText + `\n\n<i>Почему отказали? Напиши в чат — ${member.name}</i>`,
              [[{ text: "Отмена", callback_data: "menu:main" }]]);
          }
        }

        // Noop (pagination current page indicator)
        else if (cbData === "noop") {
          await answerCb(cb.id);
        }

        // Priority change: priority:urgent:{taskId}
        else if (cbData.startsWith("priority:")) {
          const parts = cbData.split(":");
          const newPriority = parts[1];
          const taskId = parts.slice(2).join(":");
          try {
            const pRes = await fetch(`${PAPERCLIP_URL}/api/issues/${taskId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ priority: newPriority }),
            });
            if (pRes.ok) {
              await answerCb(cb.id, `⚡ Приоритет → ${newPriority}`);
              await addCommentToTask(taskId, `Приоритет изменён → **${newPriority}**`, `${member.name} (via Telegram)`);
              const origText = cb.message?.text || cb.message?.caption || "";
              await editOrSend(cb.message.chat.id, cb.message.message_id, origText + `\n\n⚡ <b>Приоритет → ${newPriority}</b> — ${member.name}`, [
                [{ text: "💬 Комментарий", callback_data: `comment:${taskId}` }],
              ]);
            } else {
              await answerCb(cb.id, "❌ Ошибка", true);
            }
          } catch (err) {
            console.error("Priority change error:", err.message);
          }
        }

        // Approval: approve:{approvalId} / reject:{approvalId}
        else if (cbData.startsWith("approve:") || cbData.startsWith("reject:")) {
          const action = cbData.startsWith("approve:") ? "approve" : "reject";
          const approvalId = cbData.slice(action.length + 1);
          try {
            const aRes = await fetch(`${PAPERCLIP_URL}/api/approvals/${approvalId}/${action}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ decisionNote: `${action === "approve" ? "Approved" : "Rejected"} via Telegram`, decidedByUserId: "board" }),
            });
            if (aRes.ok) {
              const emoji = action === "approve" ? "✅" : "❌";
              await answerCb(cb.id, `${emoji} ${action === "approve" ? "Одобрено" : "Отклонено"}`);
              const origText = cb.message?.text || cb.message?.caption || "";
              await editOrSend(cb.message.chat.id, cb.message.message_id,
                origText + `\n\n${emoji} <b>${action === "approve" ? "Одобрено" : "Отклонено"}</b> — ${member.name}`, []);
            } else {
              await answerCb(cb.id, "❌ Ошибка", true);
            }
          } catch (err) { console.error("Approval error:", err.message); }
        }

        // Lead detail card with actions
        else if (cbData.startsWith("lead:")) {
          const leadId = cbData.slice(5);
          await answerCb(cb.id, "⏳");
          await sendChatAction(cb.message.chat.id);
          try {
            const data = await crmQuery(`{ lead(filter: { id: { eq: "${leadId.replace(/[^a-f0-9-]/g, '')}" } }) { id name companyName status outreachStatus icpScore industry decisionMaker decisionMakerEmail phone { primaryPhoneNumber } lastContactDate notes } }`);
            const l = data?.data?.lead;
            if (!l) { await answerCb(cb.id, "Lead not found", true); }
            else {
              const statusMap = { new: "🆕 New", contacted: "📧 Contacted", engaged: "💬 Engaged", qualified: "✅ Qualified", nurture: "💤 Nurture", closed: "❌ Closed" };
              let card = `<b>${l.name}</b>\n\n`;
              card += `Score: <b>${l.icpScore || "?"}/100</b>\n`;
              card += `Status: ${statusMap[l.status] || l.status || "?"}\n`;
              card += `Industry: ${l.industry || "—"}\n`;
              if (l.decisionMaker) card += `DM: ${l.decisionMaker}\n`;
              if (l.decisionMakerEmail) card += `Email: <code>${l.decisionMakerEmail}</code>\n`;
              if (l.phone?.primaryPhoneNumber) card += `Phone: ${l.phone.primaryPhoneNumber}\n`;
              if (l.notes) card += `\nNotes: <i>${(l.notes || "").slice(0, 200)}</i>\n`;
              if (l.lastContactDate) {
                const ago = Math.round((Date.now() - new Date(l.lastContactDate)) / 86400000);
                card += `\nLast contact: ${ago}d ago`;
              }
              const btns = [
                [
                  { text: "📧 Send Email", callback_data: `leadact:email:${l.id}` },
                  { text: "📞 Log Call", callback_data: `leadact:call:${l.id}` },
                ],
                [
                  { text: "✅ Qualified", callback_data: `leadact:status:${l.id}:qualified` },
                  { text: "💤 Nurture", callback_data: `leadact:status:${l.id}:nurture` },
                  { text: "❌ Close", callback_data: `leadact:status:${l.id}:closed` },
                ],
              ];
              if (l.id) btns.push([{ text: "🔗 Open in CRM", url: `https://crm.amritech.us/object/lead/${l.id}` }]);
              btns.push([{ text: "« Back to leads", callback_data: "crm:hot" }]);
              await editOrSend(cb.message.chat.id, cb.message.message_id, card, btns);
            }
          } catch (err) {
            console.error("Lead detail error:", err.message);
          }
        }

        // Lead actions: status change, email, call
        else if (cbData.startsWith("leadact:")) {
          const parts = cbData.split(":");
          const action = parts[1];
          const leadId = parts[2];

          if (action === "status") {
            const newStatus = parts[3];
            try {
              await crmQuery(`mutation { updateLead(id: "${leadId.replace(/[^a-f0-9-]/g, '')}", data: { status: "${newStatus}" }) { id } }`);
              await answerCb(cb.id, `✅ Status → ${newStatus}`);
              const origText = cb.message?.text || cb.message?.caption || "";
              await editOrSend(cb.message.chat.id, cb.message.message_id,
                origText + `\n\n✅ <b>Status → ${newStatus}</b> — ${member.name}`,
                [[{ text: "« Back", callback_data: "crm:hot" }]]);
            } catch (err) {
              await answerCb(cb.id, "❌ Error", true);
            }
          } else if (action === "email") {
            // Create SDR task to email this lead
            const sdrId = agentMap["sdr"];
            if (sdrId) {
              try {
                await fetch(`${PAPERCLIP_URL}/api/companies/${COMPANY_ID}/issues`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ title: `[AUTO-QUEUE] Email lead ${leadId.slice(0,8)}`, description: `Send outreach email to lead. Lead ID: ${leadId}`, assigneeAgentId: sdrId, status: "todo", priority: "medium" }),
                });
                await fetch(`${PAPERCLIP_URL}/api/agents/${sdrId}/wakeup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "telegram_lead_action" }) });
                await answerCb(cb.id, "📧 SDR task created");
              } catch { await answerCb(cb.id, "❌ Error", true); }
            }
          } else if (action === "call") {
            // Log a call result
            setPending(cb.from.id, "comment", `crm-call:${leadId}`);
            await answerCb(cb.id, "Type call notes in chat");
            const origText = cb.message?.text || cb.message?.caption || "";
            await editOrSend(cb.message.chat.id, cb.message.message_id,
              origText + `\n\n<i>Type call notes in chat — ${member.name}</i>`,
              [[{ text: "Cancel", callback_data: `lead:${leadId}` }]]);
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
        const lower = text.toLowerCase().trim().replace(/@\w+bot\b/i, "").trim();

        // If user types /command while pending — cancel pending state
        if (text.startsWith("/") && message.from?.id) {
          clearAllPending(message.from.id);
        }

        // ─── Handle pending agent task (after menu agent button) ───
        // Skip if user typed a /command — they changed their mind
        const pendingAgent = getPending(message.from?.id, "agent");
        if (pendingAgent && text.trim() && !text.startsWith("/")) {
          const agentKey = pendingAgent;
          clearAllPending(message.from.id);
          const agentSlug = AGENT_PROMPTS[agentKey]?.name ? (COMMANDS[`/${agentKey}`]?.agent || agentKey) : agentKey;
          const cmd = COMMANDS[`/${agentKey}`] || { agent: agentKey, emoji: "🤖", name: agentKey };
          await createTaskAndWake(cmd.agent || agentKey, cmd, from, text, member);
          res.writeHead(200).end("ok");
          return;
        }

        // ─── Handle pending input (done, block, assign, comment, fix) ───
        const pendingInput = getPending(message.from?.id, "input");
        if (pendingInput && text.trim() && !text.startsWith("/")) {
          const inputType = pendingInput;
          clearAllPending(message.from.id);

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
        const pendingTaskId = getPending(message.from?.id, "comment");
        if (pendingTaskId && text.trim() && !text.startsWith("/")) {
          clearAllPending(message.from.id);
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

        // Handle files/photos — route to pending agent if selected via menu
        if (message.photo || message.document || message.voice || message.video) {
          const filePendingAgent = getPending(message.from?.id, "agent");
          if (filePendingAgent) {
            clearAllPending(message.from.id);
            const pendingAgent = filePendingAgent;
            const caption = message.caption || "";
            const cmd = COMMANDS[`/${pendingAgent}`] || { agent: pendingAgent, emoji: "🤖", name: pendingAgent };
            // Inject agent command into caption so handleIncomingFile routes correctly
            message.caption = `/${pendingAgent} ${caption}`.trim();
          }
          await handleIncomingFile(message, member, from);
          res.writeHead(200).end("ok");
          return;
        }

        if (lower.startsWith("/help") || lower.startsWith("/start") || lower.startsWith("/menu") || lower === "меню") {
          // Delete the /menu command message to keep chat clean
          deleteMessageLater(message.chat.id, message.message_id, 500);
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
            // Unknown text in group chat → ignore (people just talk)
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

// Register bot commands for Telegram autocomplete
try {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMyCommands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      commands: [
        { command: "menu", description: "Главное меню" },
        { command: "status", description: "Статус агентов и pipeline" },
        { command: "tasks", description: "Открытые задачи" },
        { command: "hunter", description: "Найти клиентов" },
        { command: "sdr", description: "Отправить email" },
        { command: "chef", description: "Починить что-то" },
        { command: "done", description: "Закрыть задачу (AMRA-123)" },
        { command: "help", description: "Помощь" },
      ],
    }),
  });
  console.log("   Bot commands registered ✓");
} catch {}

server.listen(Number(PORT), "127.0.0.1", () => {
  console.log(`\n🤖 AmriTech Telegram Command Router`);
  console.log(`   Port: ${PORT} | Agents: ${Object.keys(agentMap).length}`);
  console.log(`   Commands: ${Object.keys(COMMANDS).join(", ")}, /help`);
  console.log(`   Default: CEO | Dedup: ON\n`);
});
