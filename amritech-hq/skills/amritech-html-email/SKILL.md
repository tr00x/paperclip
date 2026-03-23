---
name: amritech-html-email
description: "Generate branded HTML emails for AmriTech IT Solutions. Use when writing cold outreach, follow-up, welcome, renewal, or invoice reminder emails. Produces email-safe HTML with table layout, inline styles, logo, and mobile support."
---

# AmriTech HTML Email Skill

Email-safe HTML с table layout, inline styles, logo AmriTech. Работает в Gmail, Outlook, Apple Mail, Yahoo, мобильных клиентах.

## Brand Guidelines

| Элемент | Значение |
|---------|----------|
| Primary Blue (dark) | `#003D8F` |
| Primary Blue (light) | `#1474C4` |
| Header Gradient | `#003D8F` → `#1474C4` (bottom-right) |
| Gold Accent | `#EC9F00` |
| Dark Text | `#2D2D2D` |
| Secondary Text | `#555555` |
| Light BG | `#F7F8FA` |
| Border | `#E8ECF1` |
| White | `#FFFFFF` |
| Font | Arial, Helvetica, sans-serif |
| Logo URL | `https://amritech.us/assets/images/Main_logo-email.png` |
| Company | AmriTech IT Solutions & Business Services |
| CEO | Berik Izmaganov |
| Phone | (929) 500-5955 |
| Website | amritech.us |
| Location | Brooklyn, NY · Serving NYC / NJ / PA |

## Email-Safe Rules (КРИТИЧНО)

1. **Только `<table>` layout** — никаких `<div>` для структуры. Email клиенты ломают div-based layout.
2. **Только inline styles** — `style="..."` на каждом элементе. `<style>` блок — только как fallback, не полагайся на него.
3. **Никакого JavaScript** — запрещён во всех email клиентах.
4. **Никаких background-image в CSS** — используй `background` атрибут на `<td>` если нужен фон.
5. **Ширина: 600px max** — стандарт для email. Используй `width="600"` на главной таблице.
6. **Картинки:** всегда `alt`, `width`, `height`, `style="display:block"`. Outlook без этого ломает layout.
7. **Ссылки:** всегда `style="color:#025ADD"` inline — email клиенты игнорируют CSS для ссылок.
8. **Размер:** < 100KB total HTML.

## Основной шаблон (Cold Outreach / Full Email)

```html
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{SUBJECT}}</title>
</head>
<body style="margin:0; padding:0; background-color:#F7F8FA; font-family:Arial,Helvetica,sans-serif; -webkit-font-smoothing:antialiased;">

<!-- Wrapper -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F7F8FA;">
  <tr>
    <td align="center" style="padding:24px 16px;">

      <!-- Container 600px -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px; background-color:#FFFFFF; border-radius:8px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.08);">

        <!-- Header with Logo -->
        <tr>
          <td style="background-color:#003D8F; background:linear-gradient(to bottom right,#003D8F,#1474C4); padding:28px 36px; text-align:left;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="vertical-align:middle;">
                  <img src="https://amritech.us/assets/images/Main_logo-email.png" alt="AmriTech" width="160" height="30" style="display:block; border:0; outline:none;" />
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Gold Accent Line -->
        <tr>
          <td style="background-color:#EC9F00; height:3px; font-size:1px; line-height:1px;">&nbsp;</td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 36px 28px 36px; color:#2D2D2D; font-size:15px; line-height:1.7; font-family:Arial,Helvetica,sans-serif;">
            {{BODY_CONTENT}}
          </td>
        </tr>

        <!-- CTA Button (если нужен) -->
        <!--
        <tr>
          <td style="padding:0 36px 32px 36px;" align="left">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background-color:#003D8F; background:linear-gradient(to bottom right,#003D8F,#1474C4); border-radius:6px; padding:13px 32px;">
                  <a href="{{CTA_URL}}" style="color:#FFFFFF; text-decoration:none; font-size:15px; font-weight:bold; font-family:Arial,Helvetica,sans-serif; display:inline-block;">{{CTA_TEXT}}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        -->

        <!-- Divider -->
        <tr>
          <td style="padding:0 36px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr><td style="border-top:1px solid #E8ECF1; height:1px; font-size:1px; line-height:1px;">&nbsp;</td></tr>
            </table>
          </td>
        </tr>

        <!-- Signature -->
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

        <!-- Reply Prompt -->
        <tr>
          <td style="padding:0 36px 24px 36px; text-align:center;">
            <p style="margin:0; font-size:12px; color:#999999; font-family:Arial,Helvetica,sans-serif;">
              Have a question? Just reply to this email — we read and respond to every message.
            </p>
          </td>
        </tr>

      </table>
      <!-- /Container -->

    </td>
  </tr>
</table>
<!-- /Wrapper -->

</body>
</html>
```

## CTA Button — как вставить

Раскомментируй секцию CTA и замени `{{CTA_URL}}` и `{{CTA_TEXT}}`:

```html
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
```

## Шаблон для Follow-up (Day 3/7) — Plain Reply Style

Follow-up НЕ использует полный шаблон. Это reply в том же треде — простой текст без header/logo:

```html
<div style="font-family:Arial,Helvetica,sans-serif; font-size:15px; color:#2D2D2D; line-height:1.7;">
  <p style="margin:0 0 14px 0;">{{FOLLOW_UP_TEXT}}</p>
  <p style="margin:0 0 14px 0;">{{VALUE_ADD_OR_CLOSE}}</p>
  <p style="margin:0; color:#555555; font-size:13px;">—<br/>
  Berik Izmaganov<br/>
  AmriTech &middot; <a href="tel:+19295005955" style="color:#1474C4;">(929) 500-5955</a></p>
</div>
```

## Email Types

### 1. Cold Outreach (SDR)
- **Шаблон:** Полный (header + logo + CTA + signature)
- **Max body:** 5-7 предложений
- **Первое предложение:** О НИХ, не об AmriTech
- **CTA:** Один button — "Book a 15-min Phone Call"
- **Tone:** Helpful, direct, zero bullshit
- **BANNED:** "I noticed your company...", "As a leading MSP...", "We offer comprehensive...", "Dear Sir/Madam"

**Пример body content:**
```html
<p style="margin:0 0 14px 0;">Hi {{FIRST_NAME}},</p>

<p style="margin:0 0 14px 0;">Your SSL certificate on {{DOMAIN}} expired 3 days ago — every visitor sees a browser warning right now.</p>

<p style="margin:0 0 14px 0;">We handle IT for {{NICHE}} across NJ. Fixing this is usually a 30-minute job for us.</p>

<p style="margin:0 0 14px 0;">Worth a quick call to see what else might need attention?</p>
```

### 2. Follow-up Day 3
- **Шаблон:** Plain reply (no header)
- **Length:** 2-3 предложения
- **New angle:** stat, case study, или industry insight
- **Без нового CTA** — ссылка на оригинал

### 3. Follow-up Day 7 (Final)
- **Шаблон:** Plain reply (no header)
- **Length:** 2-3 предложения
- **Tone:** Gracious close, door open
- **Offer:** "Happy to chat on the phone anytime — (929) 500-5955"

### 4. Welcome (Onboarding)
- **Шаблон:** Полный + extra sections
- **Tone:** Warm, excited, professional
- **Sections:**
  1. Спасибо за выбор AmriTech
  2. Что дальше (numbered: IT аудит → настройка доступа → выделенная поддержка)
  3. Ваш Account Manager: Ula + контакты
  4. Emergency contact
- **CTA:** "Complete Your IT Profile"

### 5. Renewal Reminder
- **Шаблон:** Полный
- **Tone:** Appreciative, professional
- **Sections:** дата renewal, summary работы, next steps
- **CTA:** "Review Your Renewal"

### 6. Invoice Reminder
- **Шаблон:** Plain reply style (не formal)
- **Tone:** "Just checking in" — friendly, zero pressure
- **Include:** номер invoice, сумма, дата
- **Offer:** "Если вопросы по счёту — пишите"

## Golden Rules

1. **Каждый `<p>` — inline style.** `style="margin:0 0 14px 0;"` минимум.
2. **Каждый `<a>` — inline color.** `style="color:#1474C4; text-decoration:none;"`
3. **Table layout только.** `<table role="presentation">` — для accessibility.
4. **Logo всегда с fallback.** `alt="AmriTech"` + `width` + `height`.
5. **Тестируй мысленно:** "Это будет работать в Outlook 2016?" Если сомневаешься — упрости.
6. **BCC ОБЯЗАТЕЛЬНО** на каждый клиентский email: `tr00x@proton.me, ikberik@gmail.com, ula.amri@icloud.com`
