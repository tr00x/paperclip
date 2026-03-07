Use this exact checklist.

1. Start Paperclip in auth mode.
```bash
cd <paperclip-repo-root>
pnpm dev --tailscale-auth
```
Then verify:
```bash
curl -sS http://127.0.0.1:3100/api/health | jq
```

2. Start a clean/stock OpenClaw Docker.
```bash
OPENCLAW_RESET_STATE=1 OPENCLAW_BUILD=1 ./scripts/smoke/openclaw-docker-ui.sh
```
Open the printed `Dashboard URL` (includes `#token=...`) in your browser.

3. In Paperclip UI, go to `http://127.0.0.1:3100/CLA/company/settings`.

4. Use the agent snippet flow.
- Copy the snippet from company settings.
- Paste it into OpenClaw main chat as one message.
- If it stalls, send one follow-up: `How is onboarding going? Continue setup now.`

5. Approve the join request in Paperclip UI, then confirm the OpenClaw agent appears in CLA agents.

6. Case A (manual issue test).
- Create an issue assigned to the OpenClaw agent.
- Put instructions: “post comment `OPENCLAW_CASE_A_OK_<timestamp>` and mark done.”
- Verify in UI: issue status becomes `done` and comment exists.

7. Case B (message tool test).
- Create another issue assigned to OpenClaw.
- Instructions: “send `OPENCLAW_CASE_B_OK_<timestamp>` to main webchat via message tool, then comment same marker on issue, then mark done.”
- Verify both:
  - marker comment on issue
  - marker text appears in OpenClaw main chat

8. Case C (new session memory/skills test).
- In OpenClaw, start `/new` session.
- Ask it to create a new CLA issue in Paperclip with unique title `OPENCLAW_CASE_C_CREATED_<timestamp>`.
- Verify in Paperclip UI that new issue exists.

9. Watch logs during test (optional but helpful):
```bash
docker compose -f /tmp/openclaw-docker/docker-compose.yml -f /tmp/openclaw-docker/.paperclip-openclaw.override.yml logs -f openclaw-gateway
```

10. Expected pass criteria.
- Case A: `done` + marker comment.
- Case B: `done` + marker comment + main-chat message visible.
- Case C: original task done and new issue created from `/new` session.

If you want, I can also give you a single “observer mode” command that runs the stock smoke harness while you watch the same steps live in UI.
