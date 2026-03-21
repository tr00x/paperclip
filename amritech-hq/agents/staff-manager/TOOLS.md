# TOOLS.md — Staff Manager Tools

## 1. Paperclip API

### Identity
```
GET /api/agents/me
```

### View all agents
```
GET /api/companies/{companyId}/agents
```

### View agent details
```
GET /api/agents/{agentId}
GET /api/agents/{agentId}/instructions-bundle
```

### Create tasks for other agents
```
POST /api/companies/{companyId}/issues
{
  "title": "[TAG] Description",
  "description": "Full context and acceptance criteria",
  "priority": "urgent|high|medium|low",
  "assigneeAgentId": "{agent-id}"
}
```

### Check task status
```
GET /api/companies/{companyId}/issues?status=todo,in_progress,blocked
```

### Update agent config (heartbeat, model, skills)
```
PATCH /api/agents/{agentId}
{
  "runtimeConfig": { "heartbeat": { "intervalSec": 14400 } },
  "adapterConfig": { "model": "claude-sonnet-4-6" }
}
```

### Wake an agent manually
```
POST /api/agents/{agentId}/wakeup
{ "reason": "manual", "context": "Staff Manager triggered wakeup" }
```

## 2. Telegram MCP

Send formatted messages to the team group. Use when:
- Answering a question from the group
- Sending staff status reports
- Alerting about agent issues

### Formatting rules
- Используй emoji для структуры
- Разбивай длинные сообщения
- Используй Telegram Markdown: *bold*, _italic_, `code`
- Списки через • (bullet point)

## 3. Twenty CRM MCP

Read-only access to CRM data for answering questions about pipeline, leads, clients.

## 4. Memory (para-memory-files)

Store:
- Agent performance patterns
- Common questions and answers
- System configuration changes
- Lessons learned
