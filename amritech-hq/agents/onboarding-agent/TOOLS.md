# TOOLS.md -- Onboarding Agent, AmriTech IT Solutions

## Skills

### paperclip

The core Paperclip platform skill. Use for all task management, agent communication, and workflow operations.

**You use it for:**
- Reading your assigned [ONBOARD] tasks
- Creating sub-tasks for Contract Manager and Finance Tracker
- Adding comments to tasks (team notifications)
- Updating task status and checklist items
- Querying company and agent information

**Key operations:**

| Operation | Endpoint | When |
|---|---|---|
| Get my info | `GET /api/agents/me` | On wake, to confirm role and budget |
| Read task | `GET /api/companies/{companyId}/issues/{taskId}` | Step 2 -- read the [ONBOARD] task |
| Comment on task | `POST /api/companies/{companyId}/issues/{taskId}/comments` | Step 8 -- notify team |
| Create sub-task | `POST /api/companies/{companyId}/issues` | Step 9 -- Contract Manager, Finance Tracker tasks |
| Update task status | `PATCH /api/companies/{companyId}/issues/{taskId}` | Step 10 -- mark done |

---

### amritech-html-email

HTML email template skill for AmriTech branded emails. Provides responsive, professional email templates with AmriTech branding.

**You use it for:**
- Generating the welcome email HTML
- Ensuring consistent branding (colors, fonts, layout)
- Responsive design that works across email clients

**Brand parameters to pass:**

| Parameter | Value |
|---|---|
| Primary Blue (dark) | `#003D8F` |
| Primary Blue (light) | `#1474C4` |
| Gold Accent | `#EC9F00` |
| Background | `#F7F8FA` |
| Content background | `#FFFFFF` |
| Font family | Arial, Helvetica, sans-serif |
| Logo URL | `https://amritech.us/assets/images/Main_logo-email.png` |
| Max width | 600px |

---

## MCP Servers

### Gmail MCP

Send HTML emails on behalf of Berik Amri. This is your primary delivery channel for onboarding packages.

**You use it for:**
- Sending the welcome email to the client
- CC'ing Ula on all onboarding emails

**Typical call:**

```json
{
  "account": "amritech",
  "to": ["{clientContactEmail}"],
  "subject": "Welcome to AmriTech IT Solutions, {clientName}!",
  "bcc": ["tr00x@proton.me", "ikberik@gmail.com", "ula.amri@icloud.com"],
  "body": "<HTML from amritech-html-email skill>",
  "isHtml": true
}
```

**Rules:**
- `account` ВСЕГДА `"amritech"`. Никогда `"default"`.
- `to` и `bcc` — МАССИВЫ, не строки.
- Всегда `isHtml: true`. Никогда plain text.
- BCC обязателен на каждом письме — Tim и Berik видят всё.
- Verify the `To` address is valid before sending. A bounced welcome email is a bad start.
- If send fails, retry once. If it fails again, save as draft and report in task comment.

---

### Twenty CRM

Customer relationship management system. Track client status, log activities, and manage follow-ups.

**You use it for:**
- Updating company record status to "Onboarding"
- Logging the welcome package send as an activity
- Creating a Day 3 follow-up task for Ula

**Typical operations:**

| Operation | When |
|---|---|
| Find company by name | After sending email -- locate or create client record |
| Update company status | Set to "Onboarding" |
| Create activity | Log "Welcome onboarding package sent" with details |
| Create task | "Day 3 check-in call" assigned to Ula, due in 3 days |

**Rules:**
- Always search before creating -- don't create duplicate company records.
- If company not found, create it with all available data from the [ONBOARD] task.
- Activity notes should include: what was sent, to whom, which niche checklist.
- Follow-up task must have a specific due date, not "soon" or "this week."

---

### Paperclip API

Agent orchestration and task management platform. Already covered under the `paperclip` skill, but the MCP server provides the transport layer.

**You use it for:**
- All Paperclip skill operations (see above)
- Agent identity verification (`GET /api/agents/me`)

**Rules:**
- Always check budget on wake. If > 80%, notify CEO after completing current onboarding.
- Always set `parentId` when creating sub-tasks -- link back to the [ONBOARD] task.
- Always set `assigneeAgentId` -- never create unassigned tasks.

---

## Tool Priority

When multiple tools are needed for a single onboarding, execute in this order:

```
1. Paperclip API  -- read task, get context         (MUST succeed to proceed)
2. amritech-html  -- generate email HTML             (MUST succeed to proceed)
3. Gmail MCP      -- send email to client            (MUST succeed to proceed)
4. Twenty CRM     -- update records, create follow-up (best effort, continue if down)
5. Paperclip API  -- sub-tasks, comments, mark done  (best effort, continue if down)
```

Steps 1-3 are critical path. If any fail, do not mark the onboarding as complete.
Steps 4-5 are important but recoverable. If CRM or Paperclip is temporarily down, note it in a comment and the work can be done on next wake or manually.

---

## Tool Failure Handling

| Tool | Failure | Action |
|---|---|---|
| Paperclip API | Cannot read task | Exit. Cannot onboard without task data. |
| amritech-html-email | Template error | Fall back to clean HTML manually. Do not send plain text. |
| Gmail MCP | Auth error | Stop. Return checkpoint for human action (re-auth needed). |
| Gmail MCP | Send error | Retry once. If fails, save draft, report in task comment. |
| Twenty CRM | Unreachable | Skip CRM updates. Note in task comment. Continue. |
| Twenty CRM | Company not found | Create new company record with available data. |
| Paperclip API | Cannot create sub-task | Note in task comment. CEO or human will create manually. |
