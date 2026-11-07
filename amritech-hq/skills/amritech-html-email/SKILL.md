---
name: amritech-html-email
description: "ЕДИНСТВЕННЫЙ шаблон для ВСЕХ email AmriTech. Копируй целиком, замени SUBJECT и BODY. Больше ничего не трогай."
---

# AmriTech Email Template

**Копируй шаблон. Замени `{{SUBJECT}}` и `{{BODY_CONTENT}}`. Больше НИЧЕГО не меняй.**

```html
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{{SUBJECT}}</title>
<style type="text/css">
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
  @media only screen and (max-width: 620px) {
    .wrapper { width: 100% !important; }
    .content-pad { padding: 28px 20px !important; }
    .header-pad { padding: 20px !important; }
    .cta-cell { padding: 0 20px 28px !important; }
    .sig-pad { padding: 20px !important; }
    .footer-pad { padding: 16px 20px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#F0F2F5; font-family:Arial,Helvetica,sans-serif; -webkit-font-smoothing:antialiased;">

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F0F2F5; min-width:100%;">
<tr><td align="center" style="padding:16px 8px;">

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="wrapper" style="max-width:600px; width:100%; background-color:#FFFFFF; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.06);">

  <!-- HEADER -->
  <tr>
    <td class="header-pad" style="background-color:#003D8F; background:linear-gradient(135deg,#003D8F 0%,#1474C4 100%); padding:32px 36px; text-align:left;">
      <img src="https://yourcompany.example.com/assets/images/Main_logo-email.png" alt="AmriTech" width="150" style="display:block; border:0; outline:none; max-width:150px; height:auto;" />
    </td>
  </tr>

  <!-- GOLD ACCENT -->
  <tr>
    <td style="background-color:#EC9F00; height:4px; font-size:1px; line-height:1px;">&nbsp;</td>
  </tr>

  <!-- BODY -->
  <tr>
    <td class="content-pad" style="padding:36px 36px 24px 36px; color:#1A1A1A; font-size:16px; line-height:1.75; font-family:Arial,Helvetica,sans-serif;">
      {{BODY_CONTENT}}
    </td>
  </tr>

  <!-- CTA BUTTON -->
  <tr>
    <td class="cta-cell" style="padding:0 36px 32px 36px;" align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td align="center" style="background-color:#003D8F; background:linear-gradient(135deg,#003D8F 0%,#1474C4 100%); border-radius:8px; padding:16px 24px;">
            <a href="https://calendly.com/amritech/15-min-it-discovery-call" style="color:#FFFFFF; text-decoration:none; font-size:16px; font-weight:bold; font-family:Arial,Helvetica,sans-serif; display:block; text-align:center;"><span style="color:#FFFFFF;">Book a 15-min Phone Call</span></a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- DIVIDER -->
  <tr>
    <td style="padding:0 36px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr><td style="border-top:1px solid #E8ECF1; height:1px; font-size:1px; line-height:1px;">&nbsp;</td></tr>
      </table>
    </td>
  </tr>

  <!-- SIGNATURE -->
  <tr>
    <td class="sig-pad" style="padding:28px 36px 32px 36px; font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="width:4px; vertical-align:top;">
            <div style="width:4px; background-color:#EC9F00; border-radius:2px; height:56px;"></div>
          </td>
          <td style="padding-left:16px; vertical-align:top; font-size:14px; color:#555555; line-height:1.6;">
            <strong style="color:#1A1A1A; font-size:15px;">Alex Founder</strong><br />
            CEO, YourCompany LLC<br />
            <a href="tel:+15550000000" style="color:#1474C4; text-decoration:none;">(555) 000-0000</a> &middot;
            <a href="https://yourcompany.example.com" style="color:#1474C4; text-decoration:none;">yourcompany.example.com</a><br />
            <span style="color:#999999; font-size:13px;">Brooklyn, NY &middot; Serving NYC / NJ / PA</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td class="footer-pad" style="padding:0 36px 24px 36px; text-align:center;">
      <p style="margin:0; font-size:13px; color:#999999; font-family:Arial,Helvetica,sans-serif;">
        Hit reply — we read every message.
      </p>
    </td>
  </tr>

</table>

</td></tr>
</table>

</body>
</html>
```

## Body Content Rules

Каждый `<p>`:
```html
<p style="margin:0 0 16px 0;">Text here</p>
```

Каждый `<a>`:
```html
<a href="..." style="color:#1474C4; text-decoration:none;">link</a>
```

## BCC (ОБЯЗАТЕЛЬНО)

```
cto@example.com, founder@example.com, cofounder@example.com
```

## ЗАПРЕЩЕНО

- Удалять/менять header, кнопку, подпись, footer
- Plain text email
- `<div>` layout
- Своя подпись
- Email без BCC
