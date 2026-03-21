# Sales & Marketing Knowledge Synthesis

Extracted from 9 GTM skills. Reference for agent upgrades.

---

## 1. ICP Scoring Matrix (positioning-icp + lead-enrichment + lead-scoring)

### Three Signal Layers

| Layer | Weight | What It Measures |
|---|---|---|
| Firmographic | 30-40% | Company size, revenue, industry, geography, funding stage |
| Technographic | 30-35% | Tech stack, complexity, migration signals |
| Intent/Behavioral | 25-40% | Content consumption, job postings, funding events, first-party signals |

### Composite Formula

```
ICP Score = (Firmographic Fit x 0.30) + (Technographic Fit x 0.30) + (Intent Score x 0.40)
```

Intent weighted highest because timing beats targeting.

### Prioritization Matrix

- **ACTIVATE** (High Fit + High Intent): Route to sales immediately. <4 hours response.
- **NURTURE** (High Fit + Low Intent): Content sequences until trigger event.
- **MONITOR** (Low Fit + High Intent): Watch for ICP drift.
- **DISQUALIFY** (Low Fit + Low Intent): Do not pursue.

### Score-to-Action Tiers

| Score | Tier | Action |
|---|---|---|
| 80-100 | Hot | Immediate outreach within 4 hours |
| 60-79 | Warm | Prioritized sequence within 24 hours |
| 40-59 | Nurture | Automated drip |
| <40 | Cold/Disqualify | Archive |

---

## 2. Lead Enrichment Framework (lead-enrichment)

### Enrichment Priority Order

1. Verified work email (bounce <2%)
2. Title and seniority
3. Company size and revenue
4. Recent company news
5. Tech stack
6. LinkedIn profile URL
7. Hiring signals
8. Social posts or articles

### Waterfall Architecture

```
Input -> Pre-qualify (reject bad domains, wrong ICP)
  -> Step 1: Primary provider
  -> Step 2: Email specialist
  -> Step 3: Deep search
  -> Step 4: LinkedIn/AI enrichment
  -> Verification (bounce check, catch-all flag, dedup)
  -> Score + Route
```

Single-provider: 55-65% coverage. Full waterfall: 85-95%.

---

## 3. Cold Outreach Frameworks (ai-cold-outreach)

### The 3-Line Cold Email Framework

```
Line 1 (PAIN): Specific observation about their situation.
Line 2 (PROOF): One sentence of credibility. Specific result for similar company.
Line 3 (CTA): Low-friction ask. "Worth a quick look?" not "Book 30 minutes."
```

### Cold Email Rules

| Element | Rule |
|---|---|
| Subject line | 2-5 words, lowercase, no punctuation |
| Word count | 50-125 words |
| Links | Zero in first email |
| Images | Zero in first email |
| CTA | One per email |

### First Line Frameworks

| Framework | Best For |
|---|---|
| Observation + Implication | Expansion signals |
| Trigger + Question | Hiring/IT job signals |
| Timeline Narrative | Highest reply rate (10% vs 4.4%) |

### Personalization Formula

```
[Signal observation] + [Relevance to their role] + [Bridge to your value]
```

---

## 4. Email Sequence Structure (sales-email-sequences)

### Optimal Sequence

```
Day 0:  Email 1 -- The Hook (personalized opener)
Day 3:  Email 2 -- Value Add (case study, data point)
Day 7:  Email 3 -- Social Proof OR New Angle
Day 12: Email 4 -- Breakup (permission-based close)
```

### Rules

- Gap: 2-4 business days (3 is sweet spot)
- Total duration: 14-25 days
- Best send times: Tuesday-Thursday 8-10 AM local
- Each email introduces a NEW angle
- Body under 120 words

---

## 5. GTM Metrics Framework (gtm-metrics)

### Pipeline Metrics

| Metric | Formula | Target |
|---|---|---|
| Pipeline Coverage | Pipeline / Quota | 3-4x |
| Pipeline Velocity | (Opps * Deal Size * Win Rate) / Cycle Length | Increasing QoQ |
| Speed-to-Lead | Time to first response | <5 minutes |

### Sales-Led Funnel

```
Signal -> Outreach (3-5% reply) -> Meeting (50%) -> Demo (60%) -> Close (30%)
```

### Weekly Scorecard

| Metric | This Week | Last Week | 4-Wk Avg | Target | Status |
|---|---|---|---|---|---|
| Pipeline created ($) | | | | | G/Y/R |
| Meetings booked | | | | | |
| Emails sent | | | | | |
| Reply rate | | | | >5% | |
| Leads generated | | | | | |

### Leading-to-Lagging Chain

```
Revenue <- Win Rate <- ICP Fit Score (leading)
  <- Pipeline Volume <- Meetings Booked <- Outreach + Reply Rate (leading)
```

---

## 6. Competitive Battlecard Framework (competitive-battlecard-creation)

### Structure

1. Competitor Snapshot (size, recent moves, review themes)
2. Feature Comparison (strong advantage / slight / parity / disadvantage)
3. Objection Handlers: Acknowledge -> Reframe -> Counter with proof -> Bridge
4. Win Themes (3-4) with talk tracks
5. Landmine Questions to steer evaluation

### Update Cadence

- Weekly: competitor pricing, changelog, job postings
- Quarterly: full competitive audit

---

## 7. Social Selling Signals (social-selling)

### LinkedIn Buying Intent Signals

| Signal | Intent Level |
|---|---|
| Changed jobs last 90 days | High |
| Posted on LinkedIn in 30 days | Medium (active, will see outreach) |
| Company posting IT jobs | High |
| Engaged with competitor content | High |
| Company growth spike | Medium |

---

## 8. Anti-Patterns

### Email
- "Hope this finds you well" -- spam trigger
- "We're the leading..." -- unverifiable
- "Book 30 minutes" -- too high friction
- Links/images in first email -- spam filters
- Multiple CTAs -- reduces response

### Scoring
- Single score collapsing fit + intent
- No score decay on old signals
- No negative scoring for disqualifiers

### Pipeline
- 50+ metrics on one dashboard
- Vanity metrics without trends
- Not separating leading from lagging
