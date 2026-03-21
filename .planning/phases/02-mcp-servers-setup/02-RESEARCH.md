# Phase 2: MCP Servers Setup - Research

**Researched:** 2026-03-21
**Domain:** MCP (Model Context Protocol) server installation and configuration
**Confidence:** HIGH

## Summary

Phase 2 installs four MCP servers that AI agents will use later: Twenty CRM (for Hunter, SDR, Closer, Gov Scout, Contract Manager, Finance, Onboarding), Telegram (CEO only), Gmail/Email (SDR, Onboarding), and Docs DOCX/PDF (Proposal Writer, Legal). The agents themselves are configured in later phases -- this phase only ensures the MCP servers are installed, configured, and responding.

All four MCP server categories have mature, installable packages. Twenty MCP and Email MCP are Node.js-based (npm/npx). Telegram notification MCP is Node.js-based (npm/npx). Office-Word-MCP and mcp-pandoc are Python-based (uvx). The machine already has Node.js v22, pnpm, and uv/uvx installed. Pandoc binary needs to be installed via Homebrew.

**Primary recommendation:** Install all MCP servers locally, verify each with a smoke test, and store configurations in a central `mcp-servers/` directory within the project for documentation and reproducibility.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-02 | MCP servers installed and working (Telegram, Gmail, Twenty CRM, Docs) | All four MCP server packages identified, installation commands documented, verification procedures defined |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| twenty-mcp-server | 1.2.0 | Twenty CRM MCP integration (29 tools) | Only maintained MCP server for Twenty CRM, recommended by jezweb |
| @parthj/telegram-notify-mcp | 1.0.1 | Telegram bot notifications (send messages/photos/docs) | Bot-token based (matches design: BotFather bot), Node.js, simple 3-tool interface |
| @codefuturist/email-mcp | 0.2.1 | Gmail IMAP/SMTP email (read, search, send) | Node.js, 47 tools, supports Gmail App Passwords, interactive setup wizard |
| office-word-mcp-server | latest (PyPI) | Create/edit DOCX documents | Python/uvx, rich document editing (headings, tables, formatting) |
| mcp-pandoc | latest (PyPI) | Convert between document formats (MD->DOCX->PDF) | Wraps pandoc, supports all needed conversions |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pandoc | latest (Homebrew) | Document conversion engine | Required by mcp-pandoc, must be installed first |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @parthj/telegram-notify-mcp | chigwell/telegram-mcp | chigwell uses Telethon (user accounts, Python, session strings) -- overkill for bot notifications. Design spec says "send messages to bot with @mentions" which is a simple bot use case |
| @codefuturist/email-mcp | modelcontextprotocol/servers SMTP | Official MCP servers repo has SMTP-only, no IMAP read. We need both read and send |
| @codefuturist/email-mcp | ai-zerolab/mcp-email-server | Python-based, fewer features. Node.js preferred for consistency |

**CRITICAL: Telegram MCP Choice**

The design spec references `chigwell/telegram-mcp` but that server uses **Telethon (user accounts)**, requires Python, API_ID/API_HASH from my.telegram.org, and session string generation. It does NOT support bot accounts.

The actual use case from the design is: CEO sends notifications to a group chat via a Telegram **bot** with @mentions. `@parthj/telegram-notify-mcp` is the correct fit:
- Uses BotFather bot tokens (matches the design: "Configure Telegram bot (@BotFather, group chat)")
- Node.js/npx (consistent with other MCP servers)
- Three tools: send_message, send_photo, send_document
- Supports HTML/Markdown formatting for @mentions

**Installation:**
```bash
# Node.js MCP servers
npm install -g twenty-mcp-server
npm install -g @codefuturist/email-mcp

# Python MCP servers (via uvx, no global install needed)
# uvx handles these at runtime

# Pandoc binary (required for mcp-pandoc)
brew install pandoc
```

## Architecture Patterns

### Recommended Project Structure
```
mcp-servers/
├── README.md            # Overview of all MCP servers, how to start
├── twenty-crm/          # Twenty MCP config
│   └── .env             # TWENTY_API_KEY, TWENTY_BASE_URL
├── telegram/            # Telegram bot config
│   └── .env             # TELEGRAM_BOT_TOKEN, TELEGRAM_USERNAME/CHAT_ID
├── email/               # Gmail config
│   └── .env             # MCP_EMAIL_ADDRESS, MCP_EMAIL_PASSWORD, etc.
└── docs/                # Notes on Office-Word + Pandoc setup
    └── .env             # (none needed, stateless)
```

### Pattern 1: MCP Server Configuration for Claude Code
**What:** Each MCP server is registered as a project-level MCP server in Claude Code
**When to use:** When agents need access to MCP tools during heartbeats
**Example:**
```bash
# Register MCP server in Claude Code project scope
claude mcp add twenty-crm \
  -e TWENTY_API_KEY=<key> \
  -e TWENTY_BASE_URL=http://localhost:5555 \
  -- npx twenty-mcp-server start

claude mcp add telegram \
  -e TELEGRAM_BOT_TOKEN=<token> \
  -e TELEGRAM_USERNAME=<username> \
  -- npx @parthj/telegram-notify-mcp

claude mcp add email \
  -e MCP_EMAIL_ADDRESS=<address> \
  -e MCP_EMAIL_PASSWORD=<app-password> \
  -e MCP_EMAIL_IMAP_HOST=imap.gmail.com \
  -e MCP_EMAIL_SMTP_HOST=smtp.gmail.com \
  -- npx @codefuturist/email-mcp stdio

claude mcp add word-docs -- uvx --from office-word-mcp-server word_mcp_server

claude mcp add pandoc -- uvx mcp-pandoc
```

### Pattern 2: Paperclip Agent Adapter MCP Config
**What:** When agents are created in Paperclip (later phases), MCP servers are referenced in adapter config
**When to use:** Phase 5+ when creating agents
**Note:** This phase just ensures MCP servers work. Agent-to-MCP binding happens in agent build phases.

### Anti-Patterns to Avoid
- **Installing chigwell/telegram-mcp for bot use:** That package requires user account auth (Telethon). Use telegram-notify-mcp for bot-based notifications.
- **Hardcoding credentials in config files:** Use environment variables, not inline secrets.
- **Using Gmail regular password:** Gmail requires App Passwords when 2FA is enabled. Regular passwords will fail.
- **Skipping verification:** Each MCP server must be tested individually before moving on.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Telegram bot messaging | Custom bot script with node-telegram-bot-api | @parthj/telegram-notify-mcp | Already MCP-compatible, handles chat ID resolution |
| Email send/receive | Custom IMAP/SMTP client | @codefuturist/email-mcp | 47 tools, Gmail auto-detection, App Password support |
| DOCX generation | Custom docx library wrapper | office-word-mcp-server | Full Word document manipulation, tables, formatting |
| Format conversion | Custom pandoc wrapper | mcp-pandoc | Already MCP-wrapped, supports all format pairs |
| CRM API calls | Custom Twenty REST client | twenty-mcp-server | 29 tools, schema discovery, typed responses |

**Key insight:** All these MCP servers already wrap complex APIs into MCP tool interfaces. Building custom wrappers defeats the purpose of the MCP protocol.

## Common Pitfalls

### Pitfall 1: Twenty CRM Base URL Mismatch
**What goes wrong:** twenty-mcp-server defaults to `https://api.twenty.com` (cloud). Local instance is at `http://localhost:5555`.
**Why it happens:** Default config assumes Twenty Cloud.
**How to avoid:** Explicitly set `TWENTY_BASE_URL=http://localhost:5555` in env.
**Warning signs:** Connection refused or 404 errors from twenty-mcp.

### Pitfall 2: Telegram Bot Not in Group Chat
**What goes wrong:** Bot can DM users but can't post to group.
**Why it happens:** Bot hasn't been added to the group chat, or Group Privacy is still on.
**How to avoid:** (1) Create bot via @BotFather, (2) Turn off Group Privacy via BotFather, (3) Add bot to the group chat, (4) Send `/start` in the group, (5) Get chat_id via getUpdates API.
**Warning signs:** `send_message` works for DM but fails for group.

### Pitfall 3: Gmail App Password Not Created
**What goes wrong:** IMAP/SMTP auth fails with "Invalid credentials."
**Why it happens:** Gmail requires App Passwords when 2FA is enabled, regular password won't work.
**How to avoid:** Go to Google Account > Security > 2-Step Verification > App Passwords > Generate for "Mail."
**Warning signs:** Login failed errors from email MCP.

### Pitfall 4: Pandoc Not Installed Before mcp-pandoc
**What goes wrong:** mcp-pandoc starts but conversion tools fail.
**Why it happens:** mcp-pandoc is a wrapper; it needs the `pandoc` binary in PATH.
**How to avoid:** `brew install pandoc` before using mcp-pandoc.
**Warning signs:** "pandoc: command not found" in mcp-pandoc logs.

### Pitfall 5: Twenty API Key Format
**What goes wrong:** Twenty MCP can't authenticate.
**Why it happens:** The API key is a JWT token. It must be passed as-is, not base64-encoded or wrapped.
**How to avoid:** Copy the exact key from `twenty-crm/.env` (already exists: `TWENTY_API_KEY=eyJ...`).
**Warning signs:** 401 Unauthorized from Twenty API.

### Pitfall 6: Python Version for uvx MCP Servers
**What goes wrong:** Office-Word-MCP or mcp-pandoc fails to start.
**Why it happens:** System Python is 3.9.6 but some packages may need 3.10+. uv manages its own Python so this should be fine, but worth verifying.
**How to avoid:** uvx automatically manages Python versions. If issues arise, `uv python install 3.12`.
**Warning signs:** Import errors or version mismatch messages.

## Code Examples

### Verify Twenty MCP Server
```bash
# Start and test
npx twenty-mcp-server test
# Or manually:
TWENTY_API_KEY="eyJ..." TWENTY_BASE_URL="http://localhost:5555" npx twenty-mcp-server start
```

### Verify Telegram Bot Setup
```bash
# 1. Create bot via @BotFather -> get TELEGRAM_BOT_TOKEN
# 2. Message /start to the bot from your account
# 3. Get chat updates to find chat_id:
curl "https://api.telegram.org/bot<TOKEN>/getUpdates"
# 4. Test send:
curl -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" \
  -d "chat_id=<CHAT_ID>&text=Test from MCP setup"
```

### Verify Email MCP Setup
```bash
# Interactive setup wizard (auto-detects Gmail settings)
npx @codefuturist/email-mcp setup
# This tests IMAP and SMTP connections automatically
```

### Verify Office-Word-MCP
```bash
# Start server (uvx handles Python env)
uvx --from office-word-mcp-server word_mcp_server
# Server should start without errors on stdio
```

### Verify mcp-pandoc
```bash
# First install pandoc
brew install pandoc
pandoc --version

# Then test mcp-pandoc
uvx mcp-pandoc
# Server should start on stdio
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom API wrappers per service | MCP servers with standardized tool interface | 2024-2025 | Agents use unified MCP protocol instead of per-service SDKs |
| Telegram user account bots (Telethon) | Simple Bot API via MCP | 2025 | No need for Telegram API credentials, just BotFather token |
| Gmail OAuth2 flows | App Passwords + IMAP/SMTP | Ongoing | Simpler setup for server-side access, no OAuth refresh token management |

## Open Questions

1. **Telegram group chat ID**
   - What we know: CEO needs to send to a shared group chat with @Berik, @Ula, @Timur mentions
   - What's unclear: The group chat doesn't exist yet, needs to be created
   - Recommendation: Create the group in Telegram, add the bot, get chat_id via getUpdates API. Store chat_id in config.

2. **Gmail account for agents**
   - What we know: SDR and Onboarding need to send HTML emails
   - What's unclear: Which Gmail account to use (personal? business? dedicated agent account?)
   - Recommendation: Create a dedicated Gmail (e.g., ai@amritech.com or agents@amritech.com) with App Password. This is a user decision.

3. **MCP server lifecycle in Paperclip**
   - What we know: MCP servers run as stdio processes spawned by Claude Code
   - What's unclear: How Paperclip agent adapters reference MCP servers at heartbeat time
   - Recommendation: For now, register MCP servers at project level. Agent-specific MCP binding happens in later phases.

4. **telegram-notify-mcp group chat support**
   - What we know: telegram-notify-mcp resolves username -> chat_id via getUpdates. It's designed for 1:1 notifications.
   - What's unclear: Whether it supports sending to group chats directly or needs TELEGRAM_CHAT_ID override.
   - Recommendation: Test group chat support during setup. If it doesn't support groups natively, the bot can still send via Telegram Bot API directly (curl), or we may need to set TELEGRAM_CHAT_ID to the group chat ID. LOW confidence -- needs validation.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual smoke tests (no automated test framework for MCP servers) |
| Config file | none -- infrastructure verification |
| Quick run command | `claude mcp list` (verify registered servers) |
| Full suite command | Manual: start each MCP server, send test request, verify response |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-02a | Twenty MCP responds | smoke | `npx twenty-mcp-server test` | n/a |
| INFRA-02b | Telegram bot sends message | smoke | `curl Telegram Bot API sendMessage` | n/a |
| INFRA-02c | Email MCP connects to Gmail | smoke | `npx @codefuturist/email-mcp setup` (test mode) | n/a |
| INFRA-02d | Office-Word-MCP starts | smoke | `uvx --from office-word-mcp-server word_mcp_server` | n/a |
| INFRA-02e | mcp-pandoc starts | smoke | `uvx mcp-pandoc` | n/a |

### Sampling Rate
- **Per task commit:** Verify the specific MCP server just installed
- **Per wave merge:** All 5 MCP servers start and respond
- **Phase gate:** All servers registered in Claude Code project scope, all smoke tests pass

### Wave 0 Gaps
- [ ] `brew install pandoc` -- required before mcp-pandoc can work
- [ ] Telegram bot creation via @BotFather -- manual step, requires Telegram app
- [ ] Gmail App Password generation -- manual step, requires Google Account
- [ ] Telegram group chat creation + bot added -- manual step

## Sources

### Primary (HIGH confidence)
- [GitHub: jezweb/twenty-mcp](https://github.com/jezweb/twenty-mcp) -- installation, configuration, 29 tools
- [GitHub: ParthJadhav/telegram-notify-mcp](https://github.com/ParthJadhav/telegram-notify-mcp) -- bot-based Telegram notifications
- [GitHub: codefuturist/email-mcp](https://github.com/codefuturist/email-mcp) -- IMAP/SMTP email, 47 tools
- [GitHub: GongRzhe/Office-Word-MCP-Server](https://github.com/GongRzhe/Office-Word-MCP-Server) -- DOCX creation/editing
- [GitHub: vivekVells/mcp-pandoc](https://github.com/vivekVells/mcp-pandoc) -- document format conversion

### Secondary (MEDIUM confidence)
- npm registry: twenty-mcp-server@1.2.0, @parthj/telegram-notify-mcp@1.0.1, @codefuturist/email-mcp@0.2.1
- Design spec: `docs/superpowers/specs/2026-03-20-amritech-ai-staff-design.md` -- MCP server matrix

### Tertiary (LOW confidence)
- telegram-notify-mcp group chat support -- needs runtime validation
- Office-Word-MCP Python 3.9 compatibility -- uv should handle but unverified

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages verified on npm/PyPI, versions confirmed
- Architecture: HIGH -- MCP protocol is standardized, config patterns well-documented
- Pitfalls: HIGH -- identified from official docs and known Gmail/Telegram constraints

**Key facts from Phase 1:**
- Twenty CRM runs on `localhost:5555` (not default 3000)
- API key exists in `twenty-crm/.env` as `TWENTY_API_KEY`
- Node.js v22.22.1, pnpm v10.32.1, uv 0.10.7 all installed
- pandoc NOT installed (needs `brew install pandoc`)
- System Python is 3.9.6 but uv manages its own Python

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable infrastructure, 30-day validity)
