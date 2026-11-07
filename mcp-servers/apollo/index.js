#!/usr/bin/env node
/**
 * apollo-mcp — Apollo.io MCP server for Hunter lead discovery
 *
 * Free plan endpoints available:
 *   - POST /api/v1/organizations/search  — company search with filters
 *   - POST /api/v1/organizations/enrich  — enrich company by domain
 *
 * Note: people/search and people/match require a paid Apollo plan.
 *
 * Env: APOLLO_API_KEY
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_KEY = process.env.APOLLO_API_KEY;
const BASE_URL = "https://api.apollo.io";

if (!API_KEY) { console.error("APOLLO_API_KEY required"); process.exit(1); }

function ok(text) { return { content: [{ type: "text", text }] }; }
function err(e) { return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }] }; }

async function apolloPost(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Apollo error: ${data.error}`);
  return data;
}

// ─── Server & tools ───
const server = new McpServer({ name: "apollo-mcp", version: "1.0.0" });

/**
 * search_companies — Find companies matching ICP criteria in NY/NJ/PA
 *
 * Maps to Apollo organization search. Returns compact lead-ready data.
 */
server.tool(
  "search_companies",
  "Search Apollo.io for companies matching ICP criteria. Filters by location (NY/NJ/PA), industry, and employee count. Returns company name, phone, website, city, state, employees, and technologies.",
  {
    locations: z.array(z.string()).optional().describe(
      "Location filters, e.g. ['New York, NY', 'New Jersey, NJ', 'Pennsylvania, PA']. Defaults to NY/NJ/PA if omitted."
    ),
    industries: z.array(z.string()).optional().describe(
      "Industry keywords, e.g. ['legal services', 'accounting', 'dental', 'managed services']"
    ),
    min_employees: z.number().optional().describe("Minimum employee count (e.g. 10)"),
    max_employees: z.number().optional().describe("Maximum employee count (e.g. 200)"),
    keywords: z.array(z.string()).optional().describe(
      "Company keyword tags, e.g. ['IT support', 'cloud', 'Microsoft 365']"
    ),
    page: z.number().optional().describe("Page number (default 1)"),
    per_page: z.number().optional().describe("Results per page (default 10, max 25)"),
  },
  async (args) => {
    try {
      const locations = args.locations ?? ["New York, NY", "New Jersey, NJ", "Pennsylvania, PA"];
      const perPage = Math.min(args.per_page ?? 10, 25);

      const body = {
        page: args.page ?? 1,
        per_page: perPage,
        organization_locations: locations,
      };

      if (args.industries?.length) {
        body.q_organization_keyword_tags = args.industries;
      }
      if (args.keywords?.length) {
        body.q_organization_keyword_tags = [
          ...(body.q_organization_keyword_tags ?? []),
          ...args.keywords,
        ];
      }
      if (args.min_employees != null || args.max_employees != null) {
        const min = args.min_employees ?? 1;
        const max = args.max_employees ?? 100000;
        body.num_employees_ranges = [`${min},${max}`];
      }

      const data = await apolloPost("/api/v1/organizations/search", body);
      const orgs = data.organizations ?? [];
      const total = data.pagination?.total_entries ?? 0;

      if (!orgs.length) return ok("No companies found for the given filters.");

      const lines = orgs.map(o => {
        const parts = [
          `**${o.name}**`,
          o.city && o.state ? `${o.city}, ${o.state}` : (o.city || o.state || ""),
          o.industry ? `Industry: ${o.industry}` : "",
          o.estimated_num_employees ? `Employees: ${o.estimated_num_employees}` : "",
          o.phone ? `Phone: ${o.phone}` : "",
          o.website_url ? `Website: ${o.website_url}` : "",
          o.primary_domain ? `Domain: ${o.primary_domain}` : "",
          o.linkedin_url ? `LinkedIn: ${o.linkedin_url}` : "",
        ].filter(Boolean).join(" | ");
        return parts;
      });

      return ok(
        `Found ${total} total companies (showing ${orgs.length}):\n\n` +
        lines.join("\n\n")
      );
    } catch (e) { return err(e); }
  }
);

/**
 * enrich_company — Get detailed company data by domain
 *
 * Returns full org profile: tech stack, headcount by dept, address, revenue.
 */
server.tool(
  "enrich_company",
  "Enrich company data from Apollo.io by domain name. Returns tech stack, employee counts by department, HQ address, revenue estimate, and LinkedIn URL. Use after search_companies to get deeper intel on a prospect.",
  {
    domain: z.string().describe("Company domain, e.g. 'acmecpa.com'"),
  },
  async (args) => {
    try {
      const data = await apolloPost("/api/v1/organizations/enrich", { domain: args.domain });
      const o = data.organization;
      if (!o) return ok("No company data found for that domain.");

      const tech = (o.technology_names ?? []).slice(0, 15).join(", ");
      const depts = o.departmental_head_count
        ? Object.entries(o.departmental_head_count)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")
        : "N/A";

      const summary = [
        `**${o.name}** (${o.primary_domain})`,
        `Address: ${o.raw_address || "N/A"}`,
        `Industry: ${o.industry || "N/A"}`,
        `Employees: ${o.estimated_num_employees ?? "N/A"}`,
        `Revenue: ${o.organization_revenue_printed || "N/A"}`,
        `Phone: ${o.phone || "N/A"}`,
        `LinkedIn: ${o.linkedin_url || "N/A"}`,
        `Website: ${o.website_url || "N/A"}`,
        `Technologies: ${tech || "N/A"}`,
        `Dept headcount: ${depts}`,
        `Founded: ${o.founded_year || "N/A"}`,
      ].join("\n");

      return ok(summary);
    } catch (e) { return err(e); }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
