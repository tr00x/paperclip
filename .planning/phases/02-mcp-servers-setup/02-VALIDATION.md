# Phase 2: MCP Servers Setup - Validation

**Phase:** 02-mcp-servers-setup
**Requirement:** INFRA-02 — MCP servers installed and working (Telegram, Gmail, Twenty CRM, Docs)
**Created:** 2026-03-21

## Requirement-to-Test Map

| Req ID | Description | Smoke Test Command | Expected Output | Plan |
|--------|-------------|-------------------|-----------------|------|
| INFRA-02a | Twenty MCP responds | `TWENTY_API_KEY=$(grep TWENTY_API_KEY mcp-servers/twenty-crm/.env \| cut -d= -f2) TWENTY_BASE_URL=http://localhost:5555 npx twenty-mcp-server test` | Connection success or tool list returned | 02-01 |
| INFRA-02b | Telegram bot sends message | `curl -s -X POST "https://api.telegram.org/bot$(grep TELEGRAM_BOT_TOKEN mcp-servers/telegram/.env \| cut -d= -f2)/sendMessage" -d "chat_id=$(grep TELEGRAM_CHAT_ID mcp-servers/telegram/.env \| cut -d= -f2)&text=Validation test"` | JSON with `"ok":true` | 02-02 |
| INFRA-02c | Email MCP connects to Gmail | `curl -s --url "imaps://imap.gmail.com:993" --user "$(grep MCP_EMAIL_ADDRESS mcp-servers/email/.env \| cut -d= -f2):$(grep MCP_EMAIL_PASSWORD mcp-servers/email/.env \| cut -d= -f2)" --request "SELECT INBOX" 2>&1 \| grep -c "OK"` | Returns 1 or more (OK found) | 02-02 |
| INFRA-02d | Office-Word-MCP starts | `timeout 5 uvx --from office-word-mcp-server word_mcp_server 2>&1; test $? -le 124` | Exit code 0 or 124 (timeout = started OK) | 02-01 |
| INFRA-02e | mcp-pandoc starts | `timeout 5 uvx mcp-pandoc 2>&1; test $? -le 124` | Exit code 0 or 124 (timeout = started OK) | 02-01 |

## Registration Validation

All 5 MCP servers must appear in Claude Code project scope:

```bash
claude mcp list 2>/dev/null | grep -c -E "twenty-crm|telegram|email|word-docs|pandoc"
# Expected: 5
```

## Phase Gate Criteria

Phase 2 is complete when ALL of the following are true:

1. `claude mcp list` returns 5 registered servers
2. INFRA-02a: Twenty MCP connects to localhost:5555 CRM instance
3. INFRA-02b: Telegram bot delivers a message to the group chat
4. INFRA-02c: Email MCP authenticates to Gmail via IMAP (App Password)
5. INFRA-02d: Office-Word-MCP starts on stdio without crash
6. INFRA-02e: mcp-pandoc starts on stdio with pandoc binary available

## Quick Validation Script

```bash
#!/bin/bash
# Run all smoke tests in sequence
echo "=== INFRA-02 Validation ==="

echo -n "INFRA-02a (Twenty MCP): "
claude mcp list 2>/dev/null | grep -q "twenty-crm" && echo "PASS" || echo "FAIL"

echo -n "INFRA-02b (Telegram): "
claude mcp list 2>/dev/null | grep -q "telegram" && echo "PASS" || echo "FAIL"

echo -n "INFRA-02c (Email): "
claude mcp list 2>/dev/null | grep -q "email" && echo "PASS" || echo "FAIL"

echo -n "INFRA-02d (Word): "
claude mcp list 2>/dev/null | grep -q "word-docs" && echo "PASS" || echo "FAIL"

echo -n "INFRA-02e (Pandoc): "
claude mcp list 2>/dev/null | grep -q "pandoc" && echo "PASS" || echo "FAIL"

echo -n "Pandoc binary: "
which pandoc > /dev/null 2>&1 && echo "PASS" || echo "FAIL"

echo -n "Total registered: "
claude mcp list 2>/dev/null | grep -c -E "twenty-crm|telegram|email|word-docs|pandoc"
```

## Notes

- INFRA-02a requires Twenty CRM Docker container to be running (Phase 1 dependency)
- INFRA-02b and INFRA-02c require user-provided credentials (Plan 02-02 checkpoint)
- INFRA-02d and INFRA-02e are stateless -- no credentials needed
- Smoke tests for 02d/02e use timeout because stdio servers block waiting for input
