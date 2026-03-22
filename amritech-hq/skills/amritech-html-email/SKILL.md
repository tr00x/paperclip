---
name: amritech-html-email
description: "Generate branded HTML emails for AmriTech IT Solutions. Use when writing cold outreach, follow-up, welcome, renewal, or invoice reminder emails. Produces responsive HTML with AmriTech branding, professional typography, and mobile-first design."
---

# AmriTech HTML Email Skill

Generate beautiful, branded HTML emails for AmriTech IT Solutions. Every email must look professional, be mobile-responsive, and follow AmriTech brand guidelines.

## Brand Guidelines

- **Primary color:** #0066CC (AmriTech blue)
- **Secondary color:** #004999 (dark blue for hover/accents)
- **Text color:** #333333 (dark gray)
- **Light gray:** #F5F5F5 (background sections)
- **White:** #FFFFFF (main background)
- **Font stack:** Arial, Helvetica, sans-serif
- **Company name:** AmriTech IT Solutions & Business Services
- **CEO:** Berik Izmaganov
- **Phone:** (929) 500-5955
- **Website:** amritech.us
- **Location:** Brooklyn, NY | Serving NJ/NY/PA

## HTML Email Template Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{SUBJECT}}</title>
  <style>
    body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #F5F5F5; }
    .container { max-width: 600px; margin: 0 auto; background: #FFFFFF; }
    .header { background-color: #0066CC; padding: 24px 32px; }
    .header-text { color: #FFFFFF; font-size: 20px; font-weight: bold; margin: 0; }
    .header-sub { color: #CCE0FF; font-size: 12px; margin: 4px 0 0 0; }
    .body { padding: 32px; color: #333333; font-size: 16px; line-height: 1.6; }
    .body p { margin: 0 0 16px 0; }
    .cta-btn { display: inline-block; background: #0066CC; color: #FFFFFF; padding: 12px 28px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px; }
    .cta-btn:hover { background: #004999; }
    .footer { padding: 24px 32px; background: #F5F5F5; font-size: 13px; color: #666666; line-height: 1.5; }
    .footer a { color: #0066CC; text-decoration: none; }
    .divider { border: none; border-top: 1px solid #E0E0E0; margin: 16px 0; }
    @media (max-width: 480px) {
      .body { padding: 20px; font-size: 15px; }
      .header { padding: 16px 20px; }
      .footer { padding: 16px 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <p class="header-text">AmriTech</p>
      <p class="header-sub">IT Solutions & Business Services</p>
    </div>
    <div class="body">
      {{BODY_CONTENT}}
    </div>
    <div class="footer">
      <strong>Berik Izmaganov</strong><br>
      CEO, AmriTech IT Solutions & Business Services<br>
      (929) 500-5955 | <a href="https://amritech.us">amritech.us</a><br>
      Brooklyn, NY | Serving NYC/NJ/PA
    </div>
  </div>
</body>
</html>
```

## Email Types

### 1. Cold Outreach (SDR)
- **Max length:** 5-7 sentences in body
- **First sentence:** About THEM, not about AmriTech
- **Mention:** Specific pain point from Hunter's research
- **CTA:** Single button "Schedule a 15-min Call"
- **Tone:** Helpful, not salesy
- **BANNED phrases:** "I noticed your company...", "As a leading MSP...", "We offer comprehensive...", "Dear Sir/Madam", any generic BS

**Example body:**
```
<p>Hi {{FIRST_NAME}},</p>

<p>Your SSL certificate on {{DOMAIN}} expired 3 days ago — that's costing you trust with every visitor who sees the browser warning.</p>

<p>We handle IT for {{SIMILAR_COMPANY_TYPE}} across NJ, and fixing exposed infrastructure like this is usually a 30-minute job for us.</p>

<p>Worth a quick call to see what else might be exposed?</p>

<p><a href="{{CALENDAR_LINK}}" class="cta-btn">Schedule a 15-min Call</a></p>
```

### 2. Follow-up Day 3
- **Style:** Reply format (no header, plain text feel)
- **Length:** 2-3 sentences
- **Add value:** Case study stat, industry insight, or relevant news
- **No new CTA** — reference the original

### 3. Follow-up Day 7 (Final)
- **Style:** Reply format
- **Length:** 2-3 sentences
- **Tone:** Respectful close, leave door open
- **Offer alternative:** "If email isn't ideal, happy to chat on the phone at..."

### 4. Welcome (Onboarding)
- **Full HTML template with header**
- **Tone:** Warm, professional, excited
- **Sections:**
  - Thank you for choosing AmriTech
  - What happens next (numbered list: IT audit, access setup, dedicated support)
  - Your Account Manager: Ula + contact info
  - Getting Started: link to ScreenConnect, credentials form
  - Emergency contact
- **CTA:** "Complete Your IT Profile" (link to credentials form)

### 5. Renewal Reminder
- **Full HTML template**
- **Tone:** Professional, appreciative
- **Sections:**
  - Contract renewal coming up on {{DATE}}
  - Summary of what we've done (tickets resolved, uptime, etc.)
  - Updated terms (if any changes)
  - Next steps
- **CTA:** "Review Your Renewal" or "Schedule a Review Call"

### 6. Invoice Reminder (Gentle, Day 7)
- **Style:** Short, friendly, reply format
- **Mention:** Invoice number, amount, date sent
- **Tone:** "Just checking in" — no pressure
- **Offer:** "If there's an issue with the invoice, let us know"

## Rules
- ALWAYS use inline styles (email clients strip <style> tags)
- ALWAYS test with both the template and inline fallback
- NEVER use JavaScript in emails
- NEVER use background images (poor email client support)
- ALWAYS include alt text for any images
- Keep total email size under 100KB
- Use web-safe fonts only (Arial, Helvetica, Georgia, Times)
