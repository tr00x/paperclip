---
name: amritech-tender-scoring
description: "Score and evaluate government tenders for YourCompany LLC. Use when analyzing RFPs from SAM.gov, NJ/NY procurement portals, or any government solicitation. Produces fit scores, risk assessments, and go/no-go recommendations based on NAICS codes, company capabilities, and deal economics."
---

# AmriTech Tender Scoring Skill

Evaluate government tenders for YourCompany LLC. Produce structured fit scores and go/no-go recommendations.

## Company Profile for Scoring

**YourCompany LLC**
- Location: Brooklyn, NY (serving NJ/NY/PA)
- Team size: 3 key + contractors
- Services: Full spectrum IT (managed, cyber, cloud, dev, VoIP, networking, consulting)
- Sweet spot contracts: $15k - $100k
- Max capacity contracts: ~$250k (with subcontractors)

## NAICS Codes (AmriTech registered)

### Primary
| Code | Description | Fit |
|------|------------|-----|
| 541512 | Computer Systems Design Services | PRIMARY |
| 541513 | Computer Facilities Management | Strong |
| 541519 | Other Computer Related Services | Strong |

### Secondary
| Code | Description | Fit |
|------|------------|-----|
| 518210 | Data Processing & Hosting | Moderate |
| 541511 | Custom Computer Programming | Moderate |
| 541611 | Admin Management Consulting | Moderate |
| 561621 | Security Systems Services | Moderate |
| 517311 | Wired Telecommunications | Weak |
| 611420 | Computer Training | Weak |

## Scoring Framework

### Overall Score = Weighted Average of 6 Factors (0-100)

| Factor | Weight | Scoring Criteria |
|--------|--------|-----------------|
| **Contract Size** | 20% | $15-50k = 100, $50-100k = 85, $100-250k = 60, $250k+ = 30, <$15k = 50 |
| **Submission Timeline** | 15% | >20 days = 100, 14-20 days = 80, 10-14 days = 50, <10 days = 20 |
| **Technical Complexity** | 20% | Standard IT services = 100, Moderate specialization = 70, Heavy specialization = 40, Exotic requirements = 10 |
| **Competition Level** | 15% | Sole source = 100, Small business set-aside = 80, Full & open <$100k = 60, Full & open >$100k = 30 |
| **Geographic Advantage** | 15% | NJ on-site required = 100, NY on-site = 90, PA on-site = 80, Remote OK = 70, Other state = 20 |
| **Track Record Match** | 15% | Identical past work = 100, Similar work = 75, Related work = 50, No match = 20 |

### Score Interpretation

| Score Range | Verdict | Action |
|-------------|---------|--------|
| **85-100** | HOT | Рекомендовать CEO немедленно. Начать подготовку сразу |
| **70-84** | STRONG | Рекомендовать CEO. Хорошие шансы |
| **50-69** | MODERATE | Упомянуть CEO с оговорками. Подавать если нет лучших вариантов |
| **30-49** | WEAK | Пропустить. Упомянуть только если CEO спросит |
| **0-29** | NO-GO | Не подходит. Не упоминать |

## Capability Assessment

### What AmriTech CAN deliver (score HIGH)
- IT helpdesk & support contracts
- Network installation, configuration, management
- Endpoint management (MDM, patching, AV/EDR)
- Cybersecurity services (assessment, monitoring, incident response)
- Cloud migration (M365, Azure, AWS)
- VoIP deployment and management
- Custom software development
- Backup & disaster recovery
- IT consulting & assessment
- Data center management (small/medium)
- Structured cabling & low-voltage

### What AmriTech CANNOT deliver (score LOW or NO-GO)
- Contracts requiring >20 FTE on-site simultaneously
- Federal classified / security clearance required
- Large ERP implementations (SAP, Oracle, Workday)
- Contracts >$500k (no track record at this scale)
- Specialized hardware manufacturing
- Mainframe / legacy system maintenance (AS/400, etc.)
- Contracts requiring CMMC Level 3+ certification
- Contracts in states outside NJ/NY/PA (no local presence)

## Set-Aside Eligibility Check

| Set-Aside Type | AmriTech Eligible? | Notes |
|---------------|-------------------|-------|
| Small Business (SB) | ✅ Yes | Under SBA size standard for NAICS 541512 ($34M) |
| 8(a) Business Development | ❓ Check | Requires SBA 8(a) certification |
| HUBZone | ❓ Check | Requires HUBZone certification + principal office in HUBZone |
| SDVOSB | ❌ No | Requires service-disabled veteran owner |
| WOSB | ❌ No | Requires woman-owned majority |
| Sole Source <$250K | ✅ Eligible | If AmriTech is the only qualified vendor |

## Required Documents Checklist

For each recommended tender, verify these are ready:

- [ ] SAM.gov registration active (UEI number valid)
- [ ] Capability Statement (1-2 pages, current)
- [ ] Past Performance references (minimum 3, relevant to this NAICS)
- [ ] Technical approach template (adaptable to RFP requirements)
- [ ] Pricing template (T&M rates or fixed-price by service type)
- [ ] Key personnel resumes (Alex, Sam, Tim + relevant contractors)
- [ ] Proof of insurance (general liability, cyber, workers comp)
- [ ] Relevant certifications (CompTIA, Microsoft Partner, etc.)
- [ ] Small business self-certification
- [ ] State business registrations (NJ, NY, PA as applicable)

## Output Format

For each evaluated tender, produce:

```
## Tender Evaluation: {RFP Number}

**Portal:** {SAM.gov / NJ Treasury / NYC PASSPort / etc.}
**Title:** {Solicitation title}
**NAICS:** {Code} — {Description}
**Value:** ${estimated amount}
**Deadline:** {date} ({N} business days remaining)

### Scoring

| Factor | Score | Rationale |
|--------|-------|-----------|
| Contract Size | {0-100} | {why} |
| Timeline | {0-100} | {why} |
| Complexity | {0-100} | {why} |
| Competition | {0-100} | {why} |
| Geography | {0-100} | {why} |
| Track Record | {0-100} | {why} |
| **WEIGHTED TOTAL** | **{0-100}** | |

### Verdict: {HOT / STRONG / MODERATE / WEAK / NO-GO}

### Key Requirements
- {Requirement 1}
- {Requirement 2}
- {Requirement 3}

### Risks
- {Risk 1}
- {Risk 2}

### Recommendation
{What to do: pursue / skip / monitor for recompete}

### Documents Needed
- {Specific documents for this RFP}
```

## Rules
- ALWAYS check deadline first — if <10 business days and score <70, auto-skip
- ALWAYS verify NAICS code match before deep analysis
- NEVER recommend tenders requiring certifications AmriTech doesn't have
- If unsure about eligibility, flag with ❓ and recommend CEO verify
- Track recompete opportunities — note contract end dates for future monitoring
- Compare pricing against similar past awards (use USAspending.gov data if available)
