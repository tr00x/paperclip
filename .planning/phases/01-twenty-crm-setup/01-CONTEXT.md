# Phase 1: Twenty CRM Setup - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Deploy Twenty CRM locally via Docker with 4 pipelines configured for AmriTech AI HQ agents.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Paperclip already running locally on Mac
- Docker available on the machine

### Established Patterns
- Company Package approach (agentcompanies/v1)
- Twenty CRM MCP server: jezweb/twenty-mcp (29 tools)

### Integration Points
- Twenty API key needed for MCP server in Phase 2
- Pipelines: Leads, Tenders, Clients, Invoices

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
