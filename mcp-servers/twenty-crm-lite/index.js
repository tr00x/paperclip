#!/usr/bin/env node
/**
 * twenty-crm-lite — Role-based MCP server for Twenty CRM
 *
 * Usage: node index.js --role=hunter
 * Env: TWENTY_API_KEY, TWENTY_BASE_URL
 *
 * Each role gets only the CRM tools it needs (2-5 tools vs 29 in full MCP).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_KEY = process.env.TWENTY_API_KEY;
const BASE_URL = process.env.TWENTY_BASE_URL || "http://localhost:5555";
const ROLE = (process.argv.find(a => a.startsWith("--role=")) || "").replace("--role=", "") || "readonly";

if (!API_KEY) { console.error("TWENTY_API_KEY required"); process.exit(1); }

// ─── GraphQL helper ───
async function gql(query, variables = {}) {
  const res = await fetch(`${BASE_URL}/graphql`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (data.errors) throw new Error(data.errors[0].message);
  return data.data;
}

function ok(text) { return { content: [{ type: "text", text }] }; }
function err(e) { return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }] }; }

// ─── Tool definitions by role ───
const ROLE_TOOLS = {
  hunter:           ["create_lead", "search_leads", "update_lead", "create_company", "search_companies"],
  sdr:              ["get_lead", "search_leads", "update_lead", "get_contact"],
  closer:           ["get_lead", "get_company", "get_contact", "list_pipeline", "update_lead"],
  ceo:              ["search_leads", "pipeline_stats", "search_companies"],
  "gov-scout":      ["create_tender", "search_tenders", "create_company", "search_companies"],
  "proposal-writer":["get_lead", "get_company", "get_contact"],
  "contract-manager":["search_clients", "get_client", "update_client"],
  "finance-tracker": ["search_invoices", "create_invoice", "update_invoice", "get_client"],
  "legal-assistant": ["get_client", "get_company"],
  onboarding:       ["get_client", "get_contact", "update_client", "update_lead"],
  readonly:         ["search_leads", "search_companies"],
};

const allowedTools = new Set(ROLE_TOOLS[ROLE] || ROLE_TOOLS.readonly);

// ─── Tool implementations ───
const TOOLS = {};

function defTool(name, description, schema, handler) {
  TOOLS[name] = { name, description, schema, handler };
}

// === LEAD tools ===
defTool("create_lead", "Create a new lead in CRM", {
  name: z.string().describe("Lead/company name"),
  companyName: z.string().optional().describe("Company name if different"),
  industry: z.string().optional().describe("Industry/niche"),
  icpScore: z.number().optional().describe("ICP score 0-100"),
  status: z.string().optional().describe("Lead status"),
  source: z.string().optional().describe("Lead source"),
  signalSources: z.string().optional().describe("Signals that triggered this lead"),
  website: z.string().optional().describe("Company website URL"),
  phone: z.string().optional().describe("Phone number"),
  employeeCount: z.number().optional().describe("Number of employees"),
  notes: z.string().optional().describe("Additional notes"),
}, async (args) => {
  try {
    const input = { name: args.name };
    if (args.companyName) input.companyName = args.companyName;
    if (args.industry) input.industry = args.industry;
    if (args.icpScore != null) input.icpScore = args.icpScore;
    if (args.status) input.status = args.status;
    if (args.source) input.source = args.source;
    if (args.signalSources) input.signalSources = args.signalSources;
    if (args.website) input.website = { primaryLinkUrl: args.website, primaryLinkLabel: "" };
    if (args.phone) input.phone = { primaryPhoneNumber: args.phone };
    if (args.employeeCount != null) input.employeeCount = args.employeeCount;
    if (args.notes) input.notes = args.notes;
    const data = await gql(`mutation($input: LeadCreateInput!) { createLead(data: $input) { id name status icpScore } }`, { input });
    return ok(`Lead created: ${data.createLead.name} (ID: ${data.createLead.id}, Score: ${data.createLead.icpScore || "N/A"})`);
  } catch (e) { return err(e); }
});

defTool("search_leads", "Search leads by name, status, outreach status, or follow-up date", {
  query: z.string().optional().describe("Search by name (contains)"),
  status: z.string().optional().describe("Filter by status (e.g. new, contacted, engaged, closed)"),
  outreachStatus: z.string().optional().describe("Filter by outreach status (e.g. email_sent, follow_up_1, follow_up_2, replied_interested)"),
  lastContactBefore: z.string().optional().describe("Leads last contacted before this date (ISO format) — for follow-up queries"),
  email: z.string().optional().describe("Search by decision maker email"),
  limit: z.number().optional().describe("Max results (default 20)"),
}, async (args) => {
  try {
    const filters = [];
    if (args.query) filters.push(`{ name: { like: "%${args.query}%" } }`);
    if (args.status) filters.push(`{ status: { eq: "${args.status}" } }`);
    if (args.outreachStatus) filters.push(`{ outreachStatus: { eq: "${args.outreachStatus}" } }`);
    if (args.lastContactBefore) filters.push(`{ lastContactDate: { lt: "${args.lastContactBefore}" } }`);
    if (args.email) filters.push(`{ decisionMakerEmail: { eq: "${args.email}" } }`);
    const filterStr = filters.length ? `filter: { and: [${filters.join(",")}] },` : "";
    const limit = args.limit || 20;
    const data = await gql(`{ leads(${filterStr} first: ${limit}, orderBy: { createdAt: DescNullsLast }) { edges { node { id name companyName status outreachStatus icpScore industry source lastContactDate decisionMakerEmail createdAt } } } }`);
    const leads = data.leads.edges.map(e => e.node);
    if (!leads.length) return ok("No leads found.");
    const lines = leads.map(l => `[${l.status || "?"}/${l.outreachStatus || "?"}] ${l.name} — ${l.industry || "?"} — Score: ${l.icpScore || "?"} — Last: ${l.lastContactDate || "never"} (ID: ${l.id})`);
    return ok(`Found ${leads.length} leads:\n${lines.join("\n")}`);
  } catch (e) { return err(e); }
});

defTool("get_lead", "Get lead details by ID", {
  id: z.string().describe("Lead ID"),
}, async (args) => {
  try {
    const data = await gql(`{ lead(id: "${args.id}") { id name companyName status icpScore industry source signalSources website { primaryLinkUrl } phone { primaryPhoneNumber } employeeCount notes lastContactDate createdAt updatedAt } }`);
    return ok(JSON.stringify(data.lead, null, 2));
  } catch (e) { return err(e); }
});

defTool("update_lead", "Update a lead's status, outreach status, notes, or other fields", {
  id: z.string().describe("Lead ID"),
  status: z.string().optional().describe("New status (new, contacted, engaged, closed)"),
  outreachStatus: z.string().optional().describe("Outreach status (email_sent, follow_up_1, follow_up_2, replied_interested, replied_question, cold)"),
  notes: z.string().optional().describe("Notes to set"),
  icpScore: z.number().optional().describe("Updated ICP score"),
  lastContactDate: z.string().optional().describe("Last contact date (ISO)"),
}, async (args) => {
  try {
    const input = {};
    if (args.status) input.status = args.status;
    if (args.outreachStatus) input.outreachStatus = args.outreachStatus;
    if (args.notes) input.notes = args.notes;
    if (args.icpScore != null) input.icpScore = args.icpScore;
    if (args.lastContactDate) input.lastContactDate = args.lastContactDate;
    const data = await gql(`mutation($id: UUID!, $input: LeadUpdateInput!) { updateLead(id: $id, data: $input) { id name status outreachStatus } }`, { id: args.id, input });
    return ok(`Lead updated: ${data.updateLead.name} → status:${data.updateLead.status}, outreach:${data.updateLead.outreachStatus}`);
  } catch (e) { return err(e); }
});

// === COMPANY tools ===
defTool("create_company", "Create a company record", {
  name: z.string().describe("Company name"),
  domainName: z.string().optional().describe("Company website domain"),
  employees: z.number().optional().describe("Number of employees"),
}, async (args) => {
  try {
    const input = { name: args.name };
    if (args.domainName) input.domainName = { primaryLinkUrl: `https://${args.domainName}`, primaryLinkLabel: "" };
    if (args.employees) input.employees = args.employees;
    const data = await gql(`mutation($input: CompanyCreateInput!) { createCompany(data: $input) { id name } }`, { input });
    return ok(`Company created: ${data.createCompany.name} (ID: ${data.createCompany.id})`);
  } catch (e) { return err(e); }
});

defTool("search_companies", "Search companies by name", {
  query: z.string().describe("Company name to search"),
  limit: z.number().optional().describe("Max results (default 10)"),
}, async (args) => {
  try {
    const limit = args.limit || 10;
    const data = await gql(`{ companies(filter: { name: { like: "%${args.query}%" } }, first: ${limit}) { edges { node { id name domainName { primaryLinkUrl } } } } }`);
    const companies = data.companies.edges.map(e => e.node);
    if (!companies.length) return ok("No companies found.");
    const lines = companies.map(c => `${c.name} — ${c.domainName?.primaryLinkUrl || "no domain"} (ID: ${c.id})`);
    return ok(lines.join("\n"));
  } catch (e) { return err(e); }
});

defTool("get_company", "Get company details by ID", {
  id: z.string().describe("Company ID"),
}, async (args) => {
  try {
    const data = await gql(`{ company(id: "${args.id}") { id name domainName { primaryLinkUrl } employees createdAt } }`);
    return ok(JSON.stringify(data.company, null, 2));
  } catch (e) { return err(e); }
});

// === CONTACT (person) tools ===
defTool("get_contact", "Get contact/person details by ID", {
  id: z.string().describe("Contact ID"),
}, async (args) => {
  try {
    const data = await gql(`{ person(id: "${args.id}") { id name { firstName lastName } emails { primaryEmail } phones { primaryPhoneNumber } jobTitle city company { id name } createdAt } }`);
    return ok(JSON.stringify(data.person, null, 2));
  } catch (e) { return err(e); }
});

// === PIPELINE tools ===
defTool("list_pipeline", "List opportunities/deals in pipeline", {
  stage: z.string().optional().describe("Filter by stage"),
  limit: z.number().optional().describe("Max results (default 20)"),
}, async (args) => {
  try {
    const filterStr = args.stage ? `filter: { stage: { eq: "${args.stage}" } },` : "";
    const limit = args.limit || 20;
    const data = await gql(`{ opportunities(${filterStr} first: ${limit}, orderBy: { createdAt: DescNullsLast }) { edges { node { id name stage amount closeDate company { name } } } } }`);
    const opps = data.opportunities.edges.map(e => e.node);
    if (!opps.length) return ok("Pipeline empty.");
    const lines = opps.map(o => `[${o.stage}] ${o.name} — $${o.amount || 0} — ${o.company?.name || "?"} — Close: ${o.closeDate || "?"}`);
    return ok(`Pipeline (${opps.length}):\n${lines.join("\n")}`);
  } catch (e) { return err(e); }
});

defTool("pipeline_stats", "Get pipeline summary stats", {}, async () => {
  try {
    const data = await gql(`{
      leads(first: 1000) { edges { node { status icpScore } } }
      opportunities(first: 1000) { edges { node { stage amount } } }
      clients(first: 1000) { edges { node { id } } }
    }`);
    const leads = data.leads.edges.map(e => e.node);
    const opps = data.opportunities.edges.map(e => e.node);
    const clients = data.clients.edges.map(e => e.node);

    const byStatus = {};
    leads.forEach(l => { byStatus[l.status || "unknown"] = (byStatus[l.status || "unknown"] || 0) + 1; });

    const byStage = {};
    let totalPipeline = 0;
    opps.forEach(o => {
      byStage[o.stage || "unknown"] = (byStage[o.stage || "unknown"] || 0) + 1;
      totalPipeline += o.amount || 0;
    });

    const avgScore = leads.length ? Math.round(leads.reduce((s, l) => s + (l.icpScore || 0), 0) / leads.length) : 0;

    let report = `📊 Pipeline Stats\n`;
    report += `Leads: ${leads.length} (avg score: ${avgScore})\n`;
    Object.entries(byStatus).forEach(([k, v]) => { report += `  ${k}: ${v}\n`; });
    report += `Opportunities: ${opps.length} ($${totalPipeline})\n`;
    Object.entries(byStage).forEach(([k, v]) => { report += `  ${k}: ${v}\n`; });
    report += `Clients: ${clients.length}`;
    return ok(report);
  } catch (e) { return err(e); }
});

// === TENDER tools ===
defTool("create_tender", "Create a government tender/contract record", {
  name: z.string().describe("Tender title"),
  status: z.string().optional().describe("Tender status"),
  setAside: z.string().optional().describe("Set-aside type (SBA, 8a, etc)"),
  notes: z.string().optional().describe("Notes about the tender"),
}, async (args) => {
  try {
    const input = { name: args.name };
    if (args.status) input.status = args.status;
    if (args.setAside) input.setAside = args.setAside;
    if (args.notes) input.notes = args.notes;
    const data = await gql(`mutation($input: TenderCreateInput!) { createTender(data: $input) { id name status } }`, { input });
    return ok(`Tender created: ${data.createTender.name} (ID: ${data.createTender.id})`);
  } catch (e) { return err(e); }
});

defTool("search_tenders", "Search tenders by name or status", {
  query: z.string().optional().describe("Search by name"),
  status: z.string().optional().describe("Filter by status"),
  limit: z.number().optional().describe("Max results (default 20)"),
}, async (args) => {
  try {
    const filters = [];
    if (args.query) filters.push(`{ name: { like: "%${args.query}%" } }`);
    if (args.status) filters.push(`{ status: { eq: "${args.status}" } }`);
    const filterStr = filters.length ? `filter: { and: [${filters.join(",")}] },` : "";
    const limit = args.limit || 20;
    const data = await gql(`{ tenders(${filterStr} first: ${limit}) { edges { node { id name status setAside createdAt } } } }`);
    const tenders = data.tenders.edges.map(e => e.node);
    if (!tenders.length) return ok("No tenders found.");
    const lines = tenders.map(t => `[${t.status || "?"}] ${t.name} — Set-aside: ${t.setAside || "none"} (ID: ${t.id})`);
    return ok(lines.join("\n"));
  } catch (e) { return err(e); }
});

// === CLIENT tools ===
defTool("get_client", "Get client details by ID", {
  id: z.string().describe("Client ID"),
}, async (args) => {
  try {
    const data = await gql(`{ client(id: "${args.id}") { id name services position createdAt updatedAt } }`);
    return ok(JSON.stringify(data.client, null, 2));
  } catch (e) { return err(e); }
});

defTool("search_clients", "Search clients by name", {
  query: z.string().optional().describe("Search by name"),
  limit: z.number().optional().describe("Max results (default 20)"),
}, async (args) => {
  try {
    const filterStr = args.query ? `filter: { name: { like: "%${args.query}%" } },` : "";
    const limit = args.limit || 20;
    const data = await gql(`{ clients(${filterStr} first: ${limit}) { edges { node { id name services createdAt } } } }`);
    const clients = data.clients.edges.map(e => e.node);
    if (!clients.length) return ok("No clients found.");
    const lines = clients.map(c => `${c.name} — ${c.services || "no services listed"} (ID: ${c.id})`);
    return ok(lines.join("\n"));
  } catch (e) { return err(e); }
});

defTool("update_client", "Update client record", {
  id: z.string().describe("Client ID"),
  services: z.string().optional().describe("Services provided"),
  name: z.string().optional().describe("Client name"),
}, async (args) => {
  try {
    const input = {};
    if (args.services) input.services = args.services;
    if (args.name) input.name = args.name;
    const data = await gql(`mutation($id: UUID!, $input: ClientUpdateInput!) { updateClient(id: $id, data: $input) { id name } }`, { id: args.id, input });
    return ok(`Client updated: ${data.updateClient.name}`);
  } catch (e) { return err(e); }
});

// === INVOICE tools ===
defTool("search_invoices", "Search invoices", {
  query: z.string().optional().describe("Search by name"),
  limit: z.number().optional().describe("Max results (default 20)"),
}, async (args) => {
  try {
    const filterStr = args.query ? `filter: { name: { like: "%${args.query}%" } },` : "";
    const limit = args.limit || 20;
    const data = await gql(`{ invoices(${filterStr} first: ${limit}) { edges { node { id name dueDate createdAt } } } }`);
    const invoices = data.invoices.edges.map(e => e.node);
    if (!invoices.length) return ok("No invoices found.");
    const lines = invoices.map(i => `${i.name} — Due: ${i.dueDate || "?"} (ID: ${i.id})`);
    return ok(lines.join("\n"));
  } catch (e) { return err(e); }
});

defTool("create_invoice", "Create a new invoice", {
  name: z.string().describe("Invoice name/number"),
  dueDate: z.string().optional().describe("Due date (ISO format)"),
}, async (args) => {
  try {
    const input = { name: args.name };
    if (args.dueDate) input.dueDate = args.dueDate;
    const data = await gql(`mutation($input: InvoiceCreateInput!) { createInvoice(data: $input) { id name } }`, { input });
    return ok(`Invoice created: ${data.createInvoice.name} (ID: ${data.createInvoice.id})`);
  } catch (e) { return err(e); }
});

defTool("update_invoice", "Update an invoice's status or details", {
  id: z.string().describe("Invoice ID"),
  name: z.string().optional().describe("Updated invoice name"),
  dueDate: z.string().optional().describe("Updated due date (ISO)"),
  status: z.string().optional().describe("Invoice status (draft, sent, paid, overdue)"),
}, async (args) => {
  try {
    const input = {};
    if (args.name) input.name = args.name;
    if (args.dueDate) input.dueDate = args.dueDate;
    if (args.status) input.status = args.status;
    const data = await gql(`mutation($id: UUID!, $input: InvoiceUpdateInput!) { updateInvoice(id: $id, data: $input) { id name } }`, { id: args.id, input });
    return ok(`Invoice updated: ${data.updateInvoice.name}`);
  } catch (e) { return err(e); }
});

// ─── Register only allowed tools & start ───
const server = new McpServer({ name: `twenty-crm-lite-${ROLE}`, version: "1.0.0" });

for (const [name, tool] of Object.entries(TOOLS)) {
  if (allowedTools.has(name)) {
    server.tool(name, tool.description, tool.schema, tool.handler);
  }
}

const transport = new StdioServerTransport();
await server.connect(transport);
