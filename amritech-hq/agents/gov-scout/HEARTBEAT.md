# Gov Scout -- Daily Heartbeat

Frequency: once per day (morning).
Timeout: 20 minutes.

---

## Pre-scan Setup

1. Read `$AGENT_HOME/AGENTS.md` -- refresh portal list, NAICS codes, scoring criteria.
2. Read `$AGENT_HOME/SOUL.md` -- calibrate judgment.
3. Read `$AGENT_HOME/TOOLS.md` -- confirm available tools.
4. Check Paperclip inbox for any CEO directives, priority changes, or specific search requests.

---

## Daily Scan Cycle

Execute these steps in order. Do not skip portals. Track time -- you have 20 minutes total.

### Phase 1: Federal (3 min)

**SAM.gov**
- Search active opportunities for NAICS 541512, 541513, 541519, 518210, 541511.
- Filter: place of performance NY, NJ, PA. Active status only.
- Apply keyword filters: "managed IT", "cybersecurity", "cloud", "help desk", "network infrastructure", "endpoint management."
- Check set-aside filters: small business, 8(a), HUBZone, WOSB.
- Note any new postings since last scan.

### Phase 2: State Level (4 min)

**NY Empire State Development**
- Check new IT service solicitations.
- Filter for MWBE opportunities and OGS centralized contracts.
- Look for technology modernization, cybersecurity, cloud migration categories.

**NJ Treasury (NJSTART)**
- Review new bid solicitations under IT services and telecommunications.
- Check for IT blanket P.O. opportunities (recurring revenue potential).
- Look for small business subcontracting opportunities on larger contracts.

### Phase 3: City Level (3 min)

**NYC PASSPort**
- Search technology and IT services categories.
- Focus on DoITT, DCAS, HRA, DOE, NYPD technology office solicitations.
- Check for managed services, cybersecurity assessments, network upgrades.

### Phase 4: Local Government (4 min)

**NJ Local Government**
- Scan Bergen, Essex, Hudson, Middlesex, Union county procurement pages.
- Check NJ School Boards Association for district IT RFPs.
- Look for E-Rate eligible projects (schools, libraries).
- Check NJ Cooperative Purchasing for state contract ride-alongs.

### Phase 5: Authorities (3 min)

**Port Authority NY/NJ**
- Review current solicitations for IT and technology categories.
- Check for network, cybersecurity, endpoint management RFPs.

**NJ Transit**
- Check for IT, technology, telecommunications RFPs.
- Focus on communications infrastructure, cybersecurity.

### Phase 6: Score and Report (3 min)

For each new opportunity found:

1. **Score it** using the 6-factor weighted scoring system from AGENTS.md.
2. **If score >70%:** Create a [TENDER] task for CEO with full details and GO recommendation.
3. **If score 50--70%:** Create a [TENDER] task for CEO with GO WITH CAVEATS recommendation. Clearly state the risks.
4. **If score <50%:** Log in CRM as reviewed/skipped. Do not escalate unless it has unusual strategic value.
5. **Update CRM:** Log all reviewed opportunities with portal, solicitation number, score, and disposition.

---

## Deadline Tracking

After scanning for new opportunities, check existing tracked opportunities:

- Any deadlines within 5 business days? Alert CEO immediately with a comment on the existing task.
- Any deadlines passed? Mark as expired in CRM, close Paperclip task if open.
- Any amendments or addenda posted? Update the existing task with changes and re-score if scope changed.

---

## Daily Summary Comment

At the end of the heartbeat, post a summary comment to your standing task or the CEO's inbox:

```
[GOV-SCOUT] Daily Scan -- {date}

Portals scanned: {count}/7
New opportunities found: {count}
Scored >70%: {count} (tasks created)
Scored 50-70%: {count} (tasks created with caveats)
Scored <50%: {count} (logged, skipped)
Deadlines within 5 days: {count}
Amendments/updates: {count}

Top opportunity: {title} -- {score}% -- {portal}
```

If zero new opportunities found, still post the summary. The CEO needs to know you scanned.

---

## Exit

- Verify all new tasks are created and assigned to CEO.
- Verify CRM is updated with all reviewed opportunities.
- Exit heartbeat cleanly.
