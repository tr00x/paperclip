---
name: amritech-html-email
description: "ЕДИНСТВЕННЫЙ шаблон для ВСЕХ исходящих email AmriTech. Загружай ПЕРЕД каждой отправкой. Cold outreach, follow-up, welcome, invoice — ВСЁ через этот шаблон."
---

# AmriTech Email Template

**ПРАВИЛО: КАЖДЫЙ исходящий email использует ЭТОТ шаблон. Без исключений.**
Cold, follow-up Day 3, Day 7, welcome, invoice, renewal — ВСЁ с header, logo, gold accent, подписью.

## Шаблон (КОПИРУЙ ЦЕЛИКОМ)

Замени только `{{SUBJECT}}`, `{{BODY_CONTENT}}`, и CTA секцию.

```html
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{SUBJECT}}</title>
</head>
<body style="margin:0; padding:0; background-color:#F7F8FA; font-family:Arial,Helvetica,sans-serif; -webkit-font-smoothing:antialiased;">

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F7F8FA;">
  <tr>
    <td align="center" style="padding:24px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px; background-color:#FFFFFF; border-radius:8px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.08);">

        <!-- HEADER (ВСЕГДА) -->
        <tr>
          <td style="background-color:#003D8F; background:linear-gradient(to bottom right,#003D8F,#1474C4); padding:28px 36px; text-align:left;">
            <img src="https://amritech.us/assets/images/Main_logo-email.png" alt="AmriTech" width="160" height="30" style="display:block; border:0; outline:none;" />
          </td>
        </tr>

        <!-- GOLD LINE (ВСЕГДА) -->
        <tr>
          <td style="background-color:#EC9F00; height:3px; font-size:1px; line-height:1px;">&nbsp;</td>
        </tr>

        <!-- BODY (замени {{BODY_CONTENT}}) -->
        <tr>
          <td style="padding:36px 36px 28px 36px; color:#2D2D2D; font-size:15px; line-height:1.7; font-family:Arial,Helvetica,sans-serif;">
            {{BODY_CONTENT}}
          </td>
        </tr>

        <!-- CTA BUTTON (ВСЕГДА ОСТАВЛЯЙ) -->
        <tr>
          <td style="padding:0 36px 32px 36px;" align="left">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background-color:#003D8F; background:linear-gradient(to bottom right,#003D8F,#1474C4); border-radius:6px; padding:13px 32px;">
                  <a href="https://calendly.com/amritech/15-min-it-discovery-call" style="color:#FFFFFF; text-decoration:none; font-size:15px; font-weight:bold; font-family:Arial,Helvetica,sans-serif; display:inline-block;"><span style="color:#FFFFFF;">Book a 15-min Phone Call</span></a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- DIVIDER (ВСЕГДА) -->
        <tr>
          <td style="padding:0 36px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr><td style="border-top:1px solid #E8ECF1; height:1px; font-size:1px; line-height:1px;">&nbsp;</td></tr>
            </table>
          </td>
        </tr>

        <!-- SIGNATURE (ВСЕГДА, НЕ МЕНЯТЬ) -->
        <tr>
          <td style="padding:24px 36px 32px 36px; font-family:Arial,Helvetica,sans-serif;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding-right:16px; vertical-align:top;">
                  <div style="width:3px; height:48px; background-color:#EC9F00; border-radius:2px;"></div>
                </td>
                <td style="vertical-align:top; font-size:13px; color:#555555; line-height:1.5;">
                  <strong style="color:#2D2D2D; font-size:14px;">Berik Izmaganov</strong><br />
                  CEO, AmriTech IT Solutions<br />
                  <a href="tel:+19295005955" style="color:#1474C4; text-decoration:none;">(929) 500-5955</a> &middot;
                  <a href="https://amritech.us" style="color:#1474C4; text-decoration:none;">amritech.us</a><br />
                  <span style="color:#999999;">Brooklyn, NY &middot; Serving NYC / NJ / PA</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- REPLY PROMPT (ВСЕГДА) -->
        <tr>
          <td style="padding:0 36px 24px 36px; text-align:center;">
            <p style="margin:0; font-size:12px; color:#999999; font-family:Arial,Helvetica,sans-serif;">
              Have a question? Just reply to this email — we read and respond to every message.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>
```

## Как использовать

**Копируй шаблон ЦЕЛИКОМ. Замени только `{{SUBJECT}}` и `{{BODY_CONTENT}}`. ВСЁ ОСТАЛЬНОЕ НЕ ТРОГАЙ.**

### Cold Outreach (SDR)
- Body: 5-7 предложений, первое — о НИХ
- BCC: `tr00x@proton.me, ikberik@gmail.com, ula.amri@icloud.com`

### Follow-up Day 3
- Body: 2-3 предложения, новый угол/факт
- Тот же тред (reply)

### Follow-up Day 7 (Final)
- Body: 2-3 предложения, вежливое закрытие

### Welcome (Onboarding)
- Body: спасибо, что дальше (3 шага), Account Manager Ula

### Renewal / Invoice
- Body: краткая информация, без давления

## Body Content Rules

Каждый `<p>` в body ОБЯЗАН иметь inline style:
```html
<p style="margin:0 0 14px 0;">Text here</p>
```

Каждый `<a>` ОБЯЗАН:
```html
<a href="..." style="color:#1474C4; text-decoration:none;">link text</a>
```

## Пример body (Cold Outreach)

```html
<p style="margin:0 0 14px 0;">Hi Sarah,</p>

<p style="margin:0 0 14px 0;">Your SSL certificate on gardenstatedental.com expired 3 days ago — every visitor sees a browser warning right now.</p>

<p style="margin:0 0 14px 0;">We handle IT for dental practices across NJ. Fixing this is usually a 30-minute job for us.</p>

<p style="margin:0 0 14px 0;">Worth a quick call to see what else might need attention?</p>
```

## Пример body (Follow-up Day 3)

```html
<p style="margin:0 0 14px 0;">Hi Sarah,</p>

<p style="margin:0 0 14px 0;">Quick follow-up — we just helped a 3-location dental practice in Bergen County cut their IT response time from 4 hours to 15 minutes. Their old MSP was missing critical patches too.</p>

<p style="margin:0 0 14px 0;">Happy to share what we found if it's useful for your team.</p>
```

## ЗАПРЕЩЕНО

- Plain text emails (без HTML)
- `<div>` layout (только `<table>`)
- `<style>` блок без inline styles (email клиенты его вырезают)
- Своя подпись (она в шаблоне)
- Email без header/logo
- Email без gold accent line
- Email без BCC team

## BCC (ОБЯЗАТЕЛЬНО на КАЖДОМ email)

```
tr00x@proton.me, ikberik@gmail.com, ula.amri@icloud.com
```
