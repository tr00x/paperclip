# Agent Prompt Audit — TODO

## Rules (confirmed by Tim)
- Agent instruction prompts = English
- ALL communication with team = Russian: Telegram, Paperclip comments, CEO reports, demands, status updates
- No $AGENT_HOME (doesn't exist in Paperclip)
- No "Read SOUL.md/TOOLS.md at runtime" (files already injected, can't re-read)
- Email: account="amritech", to/bcc=arrays, isHtml=true, BCC=tr00x/ikberik/ula

## Fake $AGENT_HOME references to remove/fix

### gov-scout/HEARTBEAT.md
- Lines 39-41: Remove "Read $AGENT_HOME/AGENTS.md", "Read $AGENT_HOME/SOUL.md", "Read $AGENT_HOME/TOOLS.md"
  → Delete entire Pre-scan Setup section (agent can't read its own files at runtime)

### contract-manager/HEARTBEAT.md
- Lines 38-39: Remove "Read $AGENT_HOME/SOUL.md", "Read $AGENT_HOME/TOOLS.md"
  → Delete Step 1 entirely

### contract-manager/TOOLS.md
- Lines 81-87: Remove entire "## File System" section with $AGENT_HOME references

### ceo/TOOLS.md
- Lines 121,145,150,160,173: $AGENT_HOME/life/, $AGENT_HOME/memory/, $AGENT_HOME/MEMORY.md, qmd index
  → Replace with para-memory-files skill usage (or delete if not confirmed)

### hunter/HEARTBEAT.md
- Line 332: "$AGENT_HOME/memory/YYYY-MM-DD.md"
  → Check if para-memory-files provides this path, fix accordingly

### it-chef/HEARTBEAT.md
- Line 167: "$AGENT_HOME/known-issues.md"
  → Delete or replace with CRM/Paperclip task reference

### it-chef/SOUL.md
- Line 119: "$AGENT_HOME/known-issues.md"
  → Delete or replace

## Wrong emails to fix

### onboarding-agent/HEARTBEAT.md
- Line 136: berik@amritechsolutions.com → agent@amritech.us
- Line 137: CC: ula@amritechsolutions.com → BCC: tr00x@proton.me, ikberik@gmail.com, ula.amri@icloud.com
- Line 184: CC: ula@amritechsolutions.com → same fix

### proposal-writer/SOUL.md
- Line 262: berik@amritechsolutions.com → agent@amritech.us
- Line 264: www.amritechsolutions.com → amritech.us

## After fixing: sync all to Paperclip + commit
