# AmriTech AI HQ - MCP Servers

MCP (Model Context Protocol) servers that provide AI agents with access to external tools and services.

## Server Overview

| Server | Package | Purpose | Status |
|--------|---------|---------|--------|
| twenty-crm | twenty-mcp-server | CRM data access (29 tools) - contacts, companies, deals, notes | Configured |
| word-docs | office-word-mcp-server | Create and edit DOCX documents | Configured |
| pandoc | mcp-pandoc | Convert between document formats (MD, DOCX, PDF) | Configured |
| telegram | @parthj/telegram-notify-mcp | Bot notifications to team group chat | Configured |
| email | @codefuturist/email-mcp | IONOS SMTP/IMAP - send and read emails (agent@amritech.us) | Configured |

## Prerequisites

- Node.js v22+ (for npm-based MCP servers)
- uv/uvx (for Python-based MCP servers)
- pandoc binary (`brew install pandoc`) - required by mcp-pandoc

## Start Commands

### Twenty CRM MCP
```bash
# Registered in Claude Code project scope with env vars
# Starts automatically when Claude Code uses twenty-crm tools
npx twenty-mcp-server start
```
Requires: `TWENTY_API_KEY`, `TWENTY_BASE_URL=http://localhost:5555`

### Office-Word-MCP (word-docs)
```bash
uvx --from office-word-mcp-server word_mcp_server
```
No credentials needed - stateless document operations.

### mcp-pandoc (pandoc)
```bash
uvx mcp-pandoc
```
Requires: `pandoc` binary in PATH (installed via `brew install pandoc`).

### Telegram Notify MCP
```bash
npx @parthj/telegram-notify-mcp
```
Requires: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_USERNAME` or `TELEGRAM_CHAT_ID`

### Email MCP
```bash
npx @codefuturist/email-mcp stdio
```
Requires: `MCP_EMAIL_ADDRESS`, `MCP_EMAIL_PASSWORD`, IMAP/SMTP hosts.
Uses IONOS SMTP (port 587 STARTTLS) and IMAP (port 993 TLS) for agent@amritech.us.

## Configuration

Environment files are stored in each server's subdirectory:
- `twenty-crm/.env` - Twenty CRM API key and base URL
- `telegram/.env` - Telegram bot token and chat ID
- `email/.env` - IONOS SMTP/IMAP config
- `docs/.env` - Pandoc path notes (stateless, no secrets)

**Security:** All `.env` files in `mcp-servers/` are gitignored. Never commit API keys or tokens.

## Verification

```bash
# Check all registered MCP servers
claude mcp list

# Verify pandoc
pandoc --version

# Verify twenty-mcp-server installed
npm list -g twenty-mcp-server
```

## Agent Usage Matrix

| Agent | twenty-crm | word-docs | pandoc | telegram | email |
|-------|-----------|-----------|--------|----------|-------|
| CEO | x | | | x | |
| Hunter | x | | | | |
| SDR | x | | | | x |
| Closer | x | | | | |
| Gov Scout | x | | | | |
| Proposal Writer | x | x | x | | |
| Contract Manager | x | x | | | |
| Finance Tracker | x | | | | |
| Legal Assistant | | x | x | | |
| Onboarding | x | x | | | x |
