# TOOLS.md -- Hunter Tools

## Web Search (Built-in MCP)

Your primary research tool. Use for all prospecting and signal validation.

### Usage Patterns

**Prospect discovery:**
- `"law firm" "NJ" site:google.com/maps` -- find businesses by niche and region
- `"auto dealer" "New Jersey"` -- broad niche search
- `site:linkedin.com/company "dental practice" "New York"` -- LinkedIn company search
- `site:indeed.com "IT support" "NJ"` -- job posting search
- `site:glassdoor.com "{company name}" reviews` -- employee reviews

**Signal validation:**
- `site:{prospect-domain}` -- check web presence, indexing issues
- `"{company name}" "data breach" OR "security incident"` -- breach history
- `"{company name}" BBB complaints` -- service quality signals
- `"{company name}" reviews technology OR computer OR IT` -- tech-related complaints

**Decision maker discovery:**
- `site:linkedin.com/in "{company name}" "office manager" OR "operations" OR "managing partner"` -- find contacts
- `"{company name}" "{city}" email` -- public email search
- `"{company name}" team OR about` -- about pages with staff listings

**Hands & Feet specific:**
- `site:indeed.com "desktop support" OR "IT technician" "NJ" OR "New Jersey"` -- local IT jobs
- `site:linkedin.com "{company name}" "offshore" OR "remote IT" OR "NOC"` -- offshore IT teams

### Rate Limiting

- Space searches by at least 2 seconds
- Do not run more than 30 searches per heartbeat cycle
- If a search returns no useful results, refine the query before retrying

---

## Twenty CRM (MCP)

Your system of record for all prospect data.

### Before Creating Any Lead

Always search first to prevent duplicates:

1. Search by company name (exact and partial match)
2. Search by domain/website
3. Search by decision maker name

### Company Records

**Required fields when creating:**
- Company name
- Industry/niche
- Location (city, state)
- Website URL
- Employee count (or estimate)
- Lead source: "Hunter Agent - {channel}" (e.g., "Hunter Agent - Google Maps")
- ICP score

**Optional but valuable:**
- Phone number
- Annual revenue estimate
- Technologies observed
- IT pain signals (in notes)

### Person Records (Decision Makers)

**Required fields:**
- Full name
- Title/role
- Company (linked)
- Confidence level: Verified / Likely / Unverified

**Optional:**
- Email (only if publicly available)
- LinkedIn URL
- Phone (only if publicly available)

### Notes and Activity

- Add detailed notes with all signals found, each with source URL
- Tag with niche: `law-firm`, `auto-dealer`, `accounting`, `cre`, `architecture`, `medical`, `dental`, `veterinary`, `hands-and-feet`
- Tag with signal count: `signals-2`, `signals-3`, `signals-5+`
- Update records when new intelligence is found -- do not create duplicate notes

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
