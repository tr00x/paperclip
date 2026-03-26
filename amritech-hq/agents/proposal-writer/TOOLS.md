# Tools -- Proposal Writer

## MCP Servers

### 1. Office-Word-MCP

**Purpose:** Create and edit Microsoft Word (DOCX) documents programmatically.

**When to use:** Every document you generate. DOCX is your primary output format.

**Capabilities:**
- Create new DOCX files with structured content.
- Add headings, paragraphs, tables, lists, page breaks.
- Apply formatting: fonts, sizes, bold, italic, colors.
- Insert headers and footers (document title, page numbers, confidentiality notice).
- Set page margins and layout.
- Add table of contents for longer documents.

**Standard Document Setup:**
```
- Font: Calibri or Arial, 11pt body, 14pt headings
- Margins: 1 inch all sides
- Header: Document title (left), YourCompany LLC (right)
- Footer: "YourCompany LLC -- Confidential" (left), page number (right)
- Line spacing: 1.15
- Table style: header row bold with shading, alternating row colors
```

**Usage pattern:**
1. Create the DOCX file with all content and formatting.
2. Save to a temporary location or attach directly to the Paperclip task.
3. If PDF is also needed, pass the DOCX to mcp-pandoc for conversion.

---

### 2. mcp-pandoc

**Purpose:** Convert documents between formats using Pandoc.

**When to use:** When the task requires PDF output in addition to (or instead of) DOCX.

**Common conversions:**
- DOCX to PDF -- primary use case. Produces clean, print-ready PDFs.
- Markdown to DOCX -- if drafting in markdown first.
- Markdown to PDF -- for quick one-off documents.

**Usage notes:**
- Always generate DOCX first via Office-Word-MCP, then convert to PDF.
- Verify the PDF renders tables and formatting correctly after conversion.
- If PDF conversion fails or produces poor output, deliver the DOCX and note the issue in your task comment.

---

### 3. Paperclip API

**Purpose:** Task management, coordination, and communication with CEO and other agents.

**When to use:** Every heartbeat cycle -- for checking assignments, updating status, posting comments, attaching deliverables.

**Key endpoints you use:**

| Action | Method | Endpoint |
|---|---|---|
| Check identity | GET | `/api/agents/me` |
| Get assignments | GET | `/api/agents/me/inbox-lite` |
| Checkout task | POST | `/api/issues/{id}/checkout` |
| Get task context | GET | `/api/issues/{id}/heartbeat-context` |
| Read comments | GET | `/api/issues/{id}/comments` |
| Read specific comment | GET | `/api/issues/{id}/comments/{commentId}` |
| Post comment | POST | `/api/issues/{id}/comments` |
| Update task | PATCH | `/api/issues/{id}` |
| Release checkout | POST | `/api/issues/{id}/release` |

**Authentication:** All requests use `Authorization: Bearer $PAPERCLIP_API_KEY`.

**Run tracing:** All mutating requests must include `X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID` header.

**Comment format:** Use markdown in all comments. Structure delivery reports with headers, checklists, and clear placeholder callouts.

---

## Environment Variables

These are auto-injected by Paperclip at runtime:

| Variable | Description |
|---|---|
| `PAPERCLIP_AGENT_ID` | Your agent ID |
| `PAPERCLIP_COMPANY_ID` | AmriTech company ID |
| `PAPERCLIP_API_URL` | API base URL (never hardcode) |
| `PAPERCLIP_API_KEY` | Short-lived JWT for this run |
| `PAPERCLIP_RUN_ID` | Current heartbeat run ID |
| `PAPERCLIP_TASK_ID` | Task that triggered this wake (if any) |
| `PAPERCLIP_WAKE_REASON` | Why you were woken |
| `PAPERCLIP_WAKE_COMMENT_ID` | Comment that triggered this wake (if any) |
| `AGENT_HOME` | Your home directory path |

---

## Tools You Do NOT Have

- **No email access.** You do not send documents to clients. Deliver via Paperclip task; CEO or Closer handles distribution.
- **CRM: read-only.** You have `get_lead`, `get_company`, `get_contact` to look up client data for proposals. You cannot create or update CRM records.
- **No Telegram access.** Only CEO writes to Telegram. Communicate via Paperclip comments.
- **No web browsing.** If you need information from a URL (e.g., an RFP posted online), request it in your task comment. CEO or another agent will provide the content.
