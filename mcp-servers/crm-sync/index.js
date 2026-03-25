/**
 * AmriTech CRM Auto-Sync Service
 *
 * Polls Paperclip for [LEAD]/[HOT] issues and auto-creates
 * Lead records in Twenty CRM (custom Lead object).
 *
 * Runs as a background service, checked by watchdog.
 */

import http from "node:http";

const {
  PAPERCLIP_URL = "http://localhost:4444",
  TWENTY_URL = "http://localhost:5555",
  TWENTY_API_KEY,
  COMPANY_ID,
  PORT = "3089",
  POLL_INTERVAL_MS = "60000",
} = process.env;

if (!TWENTY_API_KEY || !COMPANY_ID) {
  console.error("Required: TWENTY_API_KEY, COMPANY_ID");
  process.exit(1);
}

const syncedIssues = new Set();
let stats = { synced: 0, skipped: 0, errors: 0, lastPoll: null };

// ---------- Twenty CRM GraphQL ----------

async function twentyQuery(query, variables = {}) {
  const res = await fetch(`${TWENTY_URL}/graphql`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${TWENTY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (data.errors) {
    console.error("  GraphQL error:", data.errors[0].message);
  }
  return data;
}

async function findLeadByName(name) {
  const data = await twentyQuery(`
    query($name: String!) {
      leads(filter: { name: { eq: $name } }) {
        edges { node { id name } }
      }
    }
  `, { name });
  return data?.data?.leads?.edges?.[0]?.node || null;
}

async function createLead(input) {
  const data = await twentyQuery(`
    mutation($input: LeadCreateInput!) {
      createLead(data: $input) { id name }
    }
  `, { input });
  return data?.data?.createLead || null;
}

async function updateLead(id, input) {
  const data = await twentyQuery(`
    mutation($id: UUID!, $input: LeadUpdateInput!) {
      updateLead(id: $id, data: $input) { id name }
    }
  `, { id, input });
  return data?.data?.updateLead || null;
}

// ---------- Parse lead from Paperclip issue ----------

function parseLeadFromDescription(title, description) {
  if (!description) return null;

  const lead = {};

  // Parse title: [LEAD] Company Name — Niche — Score: XX/100
  const titleMatch = title?.match(/\[(?:LEAD|HOT)\]\s*(.+?)\s*[—-]\s*(.+?)\s*[—-]\s*Score:\s*(\d+)/i);
  if (titleMatch) {
    lead.name = titleMatch[1].trim();
    lead.companyName = titleMatch[1].trim();
    lead.industry = titleMatch[2].trim();
    lead.icpScore = parseInt(titleMatch[3]);
  }

  // Extract field value: handles both "**Label:** value" AND "**Label**: value"
  function extract(text, label) {
    // Match both: **Label:** value AND **Label**: value AND **Label** value
    const re = new RegExp(`\\*\\*${label}:?\\*\\*:?\\s*(.+)`, "i");
    const m = text.match(re);
    return m ? m[1].replace(/\s*[—-]\s*\*\*Source.*/i, "").trim() : null;
  }

  // Clean URL for CRM Links field
  function cleanUrl(url) {
    if (!url) return null;
    let clean = url.replace(/[)>"'\],;]+$/, "").trim();
    if (!clean.match(/^https?:\/\//)) clean = "https://" + clean;
    try { new URL(clean); return clean; } catch { return null; }
  }

  const lines = description.split("\n");
  for (const line of lines) {
    const l = line.trim();

    // Universal bold pattern: matches both **Label:** and **Label**:
    const bold = (label) => new RegExp(`\\*\\*${label}:?\\*\\*:?`, "i");

    // Fit/Intent scores
    const fitMatch = l.match(/\*\*Fit Score:?\*\*:?\s*(\d+)/i);
    if (fitMatch) lead.fitScore = parseInt(fitMatch[1]);
    const intentMatch = l.match(/\*\*Intent Score:?\*\*:?\s*(\d+)/i);
    if (intentMatch) lead.intentScore = parseInt(intentMatch[1]);

    // MRR
    const mrrMatch = l.match(/\*\*Estimated MRR:?\*\*:?\s*\$?([\d,]+)/i);
    if (mrrMatch) lead.estimatedMrr = { amountMicros: parseInt(mrrMatch[1].replace(/,/g, "")) * 1000000, currencyCode: "USD" };

    // Location
    if (bold("Location").test(l)) {
      const loc = extract(l, "Location");
      if (loc) lead.location = loc;
    }

    // Website — handle both full URLs and bare domains
    if (bold("Website").test(l)) {
      const urlMatch = l.match(/https?:\/\/[^\s)>"]+/) || l.match(/([\w.-]+\.\w{2,})/);
      if (urlMatch) {
        const cleaned = cleanUrl(urlMatch[0]);
        if (cleaned) lead.website = { primaryLinkUrl: cleaned, primaryLinkLabel: "" };
      }
    }

    // Employees — handle "~30-50 across 4 locations" etc
    if (bold("Employees?").test(l)) {
      const num = l.match(/~?(\d+)/);
      if (num) lead.employeeCount = parseInt(num[1]);
    }

    // Current IT
    if (bold("Current IT").test(l)) {
      lead.currentIt = extract(l, "Current IT") || "";
    }

    // Decision Maker name
    if (bold("Name").test(l) && !l.match(/Company.*Name/i)) {
      const name = extract(l, "Name");
      if (name && !name.match(/^TBD|^Unknown/i)) lead.decisionMaker = name;
    }

    // DM Title
    if (bold("Title").test(l) && !l.match(/Job Title/i)) {
      const title = extract(l, "Title");
      // dmTitle field doesn't exist in CRM Lead schema — skip
    }

    // DM Email
    if (bold("Email").test(l)) {
      const email = l.match(/[\w.+-]+@[\w.-]+\.\w+/);
      if (email && !l.match(/Unknown|TBD|not found|unverified/i)) {
        lead.decisionMakerEmail = email[0];
      }
    }

    // DM Phone
    if (bold("Phone").test(l) && !lead.decisionMakerPhone) {
      const phone = l.match(/[\d()+-][\d()\s+-]{6,}/);
      if (phone) lead.decisionMakerPhone = phone[0].trim();
    }

    // DM LinkedIn
    if (bold("LinkedIn").test(l) && l.match(/https?:\/\//)) {
      const urlMatch = l.match(/https?:\/\/[^\s)>"]+/);
      if (urlMatch) {
        const cleaned = cleanUrl(urlMatch[0]);
        if (cleaned) lead.decisionMakerLinkedin = { primaryLinkUrl: cleaned, primaryLinkLabel: "" };
      }
    }

    // Confidence → source
    if (bold("Confidence").test(l)) {
      lead.decisionMakerSource = extract(l, "Confidence") || "";
    }

    // Signals (numbered list under ### Signals)
    if (l.match(/^\d+\.\s/)) {
      if (!lead._signals) lead._signals = [];
      lead._signals.push(l.replace(/^\d+\.\s*/, ""));
    }
  }

  // Also extract source URLs from signals
  if (lead._signals?.length) {
    const sources = [];
    for (const s of lead._signals) {
      const urls = s.match(/https?:\/\/[^\s)]+/g);
      if (urls) sources.push(...urls);
    }
    if (sources.length) lead.signalSources = sources.join("\n");
  }

  // Build signals string
  if (lead._signals?.length) {
    lead.signals = lead._signals.join("\n");
    lead.signalCount = lead._signals.length;
    delete lead._signals;
  }

  // Also try ## header for company name
  if (!lead.name) {
    const headerMatch = description.match(/^##\s+(.+?)\s*[—-]/m);
    if (headerMatch) {
      lead.name = headerMatch[1].trim();
      lead.companyName = headerMatch[1].trim();
    }
  }

  lead.source = "Hunter Agent";

  // Auto-queue: ICP 60+ with email → qualified, otherwise new
  if (lead.icpScore >= 60 && lead.decisionMakerEmail) {
    lead.status = "qualified";
    lead.outreachStatus = "pending";
  } else {
    lead.status = "new";
    lead.outreachStatus = "pending";
  }

  return lead.name ? lead : null;
}

// ---------- Sync one issue ----------

async function syncLeadToCRM(issue) {
  const lead = parseLeadFromDescription(issue.title, issue.description);
  if (!lead) {
    stats.skipped++;
    return;
  }

  console.log(`  Syncing ${issue.identifier}: ${lead.name}`);

  // Check if already exists
  const existing = await findLeadByName(lead.name);
  if (existing) {
    // Update with any new data
    const updates = {};
    if (lead.decisionMaker) updates.decisionMaker = lead.decisionMaker;
    if (lead.decisionMakerEmail) updates.decisionMakerEmail = lead.decisionMakerEmail;
    if (lead.decisionMakerPhone) updates.decisionMakerPhone = lead.decisionMakerPhone;
    if (lead.icpScore) updates.icpScore = lead.icpScore;
    if (lead.fitScore) updates.fitScore = lead.fitScore;
    if (lead.intentScore) updates.intentScore = lead.intentScore;
    if (lead.employeeCount) updates.employeeCount = lead.employeeCount;
    if (lead.signals) updates.signals = lead.signals;
    if (lead.signalCount) updates.signalCount = lead.signalCount;
    if (lead.signalSources) updates.signalSources = lead.signalSources;
    if (lead.location) updates.location = lead.location;
    if (lead.currentIt) updates.currentIt = lead.currentIt;
    if (lead.website) updates.website = lead.website;
    if (lead.industry) updates.industry = lead.industry;
    if (lead.estimatedMrr) updates.estimatedMrr = lead.estimatedMrr;
    if (lead.decisionMakerLinkedin) updates.decisionMakerLinkedin = lead.decisionMakerLinkedin;
    if (lead.decisionMakerSource) updates.decisionMakerSource = lead.decisionMakerSource;

    if (Object.keys(updates).length > 0) {
      await updateLead(existing.id, updates);
      console.log(`    Updated: ${existing.name}`);
    } else {
      console.log(`    Already up to date: ${existing.name}`);
    }
    stats.synced++;
    return;
  }

  // Create new lead
  const created = await createLead(lead);
  if (created) {
    console.log(`    Created lead: ${created.name} (${created.id})`);
    stats.synced++;
  } else {
    console.error(`    Failed to create lead: ${lead.name}`);
    stats.errors++;
  }
}

// ---------- Poll ----------

async function pollForLeads() {
  try {
    const res = await fetch(`${PAPERCLIP_URL}/api/companies/${COMPANY_ID}/issues?status=todo,in_progress&limit=100`);
    if (!res.ok) return;

    const data = await res.json();
    const issues = Array.isArray(data) ? data : data.issues || data.data || [];

    let newLeads = 0;
    for (const issue of issues) {
      const title = issue.title || "";
      if (!title.match(/^\[(?:LEAD|HOT)\]/)) continue;
      if (syncedIssues.has(issue.id)) continue;
      syncedIssues.add(issue.id);

      try {
        await syncLeadToCRM(issue);
        newLeads++;
      } catch (err) {
        console.error(`  Error syncing ${issue.identifier}: ${err.message}`);
        stats.errors++;
      }
    }

    stats.lastPoll = new Date().toISOString();
    if (newLeads > 0) console.log(`Poll: ${newLeads} leads processed`);
  } catch (err) {
    console.error("Poll error:", err.message);
  }
}

// ---------- Safety Net: Check for missed handoffs ----------

async function safetyNetCheck() {
  try {
    // Find leads that replied positively but may not have a Closer task
    const replied = await twentyQuery(`
      query {
        leads(filter: {
          outreachStatus: { in: ["replied_interested"] }
          status: { in: ["engaged", "qualified"] }
        }) {
          edges { node { id name decisionMaker lastContactDate } }
        }
      }
    `);

    const leads = replied?.data?.leads?.edges || [];
    for (const { node: lead } of leads) {
      // Check if there's already a [BRIEFING] task for this company
      try {
        const res = await fetch(`${PAPERCLIP_URL}/api/companies/${COMPANY_ID}/issues?status=todo,in_progress&limit=200`);
        if (!res.ok) continue;
        const data = await res.json();
        const issues = Array.isArray(data) ? data : data.issues || data.data || [];
        const hasBriefing = issues.some(i =>
          i.title?.includes("[BRIEFING]") && i.title?.includes(lead.name)
        );

        if (!hasBriefing) {
          console.log(`  Safety net: ${lead.name} replied_interested but no [BRIEFING] task found`);
          // Log only — agent should create the task. This is a monitoring alert.
          // In future: auto-create task via Paperclip API
        }
      } catch (err) {
        // Ignore errors in safety check
      }
    }
  } catch (err) {
    console.error("Safety net error:", err.message);
  }
}

// ---------- Health ----------

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", uptime: process.uptime(), ...stats }));
  } else {
    res.writeHead(404).end("not found");
  }
});

console.log("\n📊 AmriTech CRM Auto-Sync (Lead object)");
console.log(`   Paperclip: ${PAPERCLIP_URL} → Twenty CRM: ${TWENTY_URL}`);
console.log(`   Poll: every ${POLL_INTERVAL_MS}ms | Health: :${PORT}/health\n`);

await pollForLeads();
setInterval(pollForLeads, parseInt(POLL_INTERVAL_MS));

// Safety net runs every 5 minutes
setInterval(safetyNetCheck, 300000);

server.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`CRM Sync listening on 0.0.0.0:${PORT}`);
});
