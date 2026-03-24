# TOOLS.md -- Hunter Tools

## Search Tools (3 MCP servers)

You have THREE search tools. Use them strategically — each has strengths.

### 1. DuckDuckGo Search (`ddg-search` MCP)
**Best for:** Quick prospect discovery, broad searches, privacy (no tracking).

Use the `ddg_web_search` tool for queries. Also has `extract_webpage_content` to pull full page text.

**Prospect discovery:**
- `law firm NJ Brooklyn` — find businesses by niche and region
- `auto dealer New Jersey` — broad niche search
- `dental practice New York IT support` — niche + IT pain
- `"{company name}" reviews` — reputation check

**Content extraction:**
- Use `extract_webpage_content` with prospect's website URL to check: SSL, CMS version, tech stack, last update, contact info.

### 2. Multi-Provider Search (`web-search` MCP)
**Best for:** Deep research, when DDG misses results. Searches DDG + Bing + SearXNG (Google results via meta-search) with automatic fallback.

Use `web_search` tool. Also has `extract_content` for URL scraping.

**Signal validation:**
- `"{company name}" "data breach" OR "security incident"` — breach history
- `"{company name}" BBB complaints` — service quality
- `"{company name}" reviews technology computer IT problems` — tech complaints
- `site:glassdoor.com "{company name}"` — employee reviews about IT

**Decision maker discovery:**
- `site:linkedin.com/in "{company name}" "office manager" OR "managing partner"` — find contacts
- `"{company name}" team about staff` — about pages

### 3. Built-in WebSearch
**Best for:** Fallback when MCP tools are unavailable. Standard Claude web search.

### Search Strategy (per prospect)

```
Step 1: DDG quick search → find company, verify it exists
Step 2: extract_webpage_content → scrape their website for tech signals
Step 3: web_search → deep research (reviews, breaches, job postings, LinkedIn)
Step 4: extract_content → pull full page from interesting results
```

### Search Queries by Goal

**Find new prospects:**
| Goal | Query |
|------|-------|
| Law firms NJ | `law firm attorney NJ Bergen County` |
| Medical NYC | `medical practice doctor office Manhattan Brooklyn` |
| Dental | `dental practice dentist office NJ NY` |
| Auto dealers | `car dealer auto dealership New Jersey` |
| CRE | `commercial real estate property management NYC NJ` |
| Accounting | `accounting firm CPA NJ New York` |

**Validate IT pain signals:**
| Signal | How to check |
|--------|-------------|
| SSL expired | `extract_webpage_content` on their site → check for certificate warnings |
| Old website | `extract_webpage_content` → look for WordPress version, old jQuery, copyright year |
| IT job posting | `web_search "{company}" IT support helpdesk site:indeed.com` |
| Employee complaints | `web_search "{company}" glassdoor reviews computer slow crash` |
| Data breach history | `web_search "{company}" data breach security incident` |
| No DMARC/SPF | `web_search "{domain}" DMARC SPF record check` |
| Existing MSP | `web_search "{company}" managed services OR IT provider OR MSP` |

**Hands & Feet specific:**
- `web_search "desktop support" OR "IT technician" NJ NYC site:indeed.com`
- `web_search "{company}" offshore remote IT NOC site:linkedin.com`

### Rate Limiting

- Max 30 searches per heartbeat cycle across all tools
- Space searches by at least 2 seconds
- If a search returns nothing useful, refine query before retrying
- Prefer DDG for quick checks, web-search for deep dives

---

## Twenty CRM (MCP)

Your system of record for all prospect data.

**Available CRM Tools:** `create_lead`, `search_leads`, `update_lead`, `create_company`, `search_companies`

### Before Creating Any Lead

Always search first to prevent duplicates:
`search_leads(query: "company name")` + `search_companies(query: "company name")`

### Lead Records (`create_lead`)

**Required fields:**
- name — Company/lead name
- companyName — Company name
- industry — Niche tag: law-firm, auto-dealer, accounting, cre, architecture, medical, dental, veterinary, hands-and-feet
- icpScore — ICP score 0-100
- source — "Hunter Agent - {channel}" (e.g., "Hunter Agent - Google Maps")
- signalSources — All signals found with source URLs

**Optional but valuable:**
- website — Company website URL
- phone — Phone number
- employeeCount — Number of employees
- notes — Decision maker name/title, IT pain signals, technologies observed

### Company Records (`create_company`)

- name — Company name
- domainName — Website domain
- employees — Employee count

### Updating Leads (`update_lead`)

- Update notes when new intelligence is found — do not create duplicates
- Update icpScore if signals change

### CRM Hygiene Tasks

- Deduplicate on every access
- Archive leads that are confirmed dead (company closed, hired IT team of 3+, moved out of region)
- Update stale records (>90 days) when re-encountered

---

## Paperclip (Skill)

Your coordination layer with the rest of the AmriTech AI team.

### Key Operations

**Check identity:**
```
GET /api/agents/me
```

**Get assignments:**
```
GET /api/companies/{companyId}/issues?assigneeAgentId={your-id}&status=todo,in_progress
```

**Checkout a task:**
```
POST /api/issues/{id}/checkout
```

**Create a [LEAD] task for SDR:**
```
POST /api/companies/{companyId}/issues
{
  "title": "[LEAD] {Company} -- {Niche} -- Score: {XX}/100",
  "description": "{full lead brief per AGENTS.md format}",
  "assigneeAgentId": "{sdr-agent-id}",
  "priority": "medium",
  "labels": ["lead", "{niche-tag}"]
}
```

**Create a [HOT] task for CEO:**
```
POST /api/companies/{companyId}/issues
{
  "title": "[HOT] {Company} -- {Why hot}",
  "description": "{full hot brief per AGENTS.md format}",
  "assigneeAgentId": "{ceo-agent-id}",
  "priority": "urgent",
  "labels": ["hot-lead", "{niche-tag}"]
}
```

**Comment on a task:**
```
POST /api/issues/{id}/comments
{
  "body": "{markdown comment}"
}
```

**Update task status:**
```
PATCH /api/issues/{id}
{
  "status": "done"
}
```

### Headers

Always include on mutating calls:
```
X-Paperclip-Run-Id: {current-run-id}
Authorization: Bearer {PAPERCLIP_API_KEY}
```

---

## Tool Priority

1. **Check CRM first** -- before any research on a prospect, search Twenty CRM
2. **Web Search for signals** -- gather evidence of IT pain
3. **Paperclip for output** -- create tasks, report, coordinate

Never use tools to contact prospects. Never use tools to perform active security scanning. Passive reconnaissance only.
