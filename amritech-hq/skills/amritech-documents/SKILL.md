---
name: amritech-documents
description: "Create professional documents (guides, reports, proposals) as DOCX/PDF and send via Email or Telegram. Use when agent needs to create a formatted document and deliver it to team or client."
---

# AmriTech Document Creation & Delivery

Создавай профессиональные документы и доставляй их команде/клиентам через email или Telegram.

## Доступные инструменты

### Создание документов
- **Word MCP** (`word-docs`) — создание `.docx` файлов с форматированием
- **Pandoc MCP** (`pandoc`) — конвертация между форматами (MD → DOCX → PDF)

### Доставка
- **Email MCP** (`email`) — отправка файлов вложением или HTML в теле
- **Telegram MCP** (`telegram`) — отправка уведомлений и ссылок

## Workflow: Создание документа

### 1. Выбери формат

| Тип документа | Формат | Инструмент |
|---|---|---|
| Гайд / инструкция | DOCX | Word MCP |
| Отчёт (weekly, monthly) | DOCX или HTML email | Word MCP или Email MCP |
| Proposal / КП | DOCX | Word MCP |
| Контракт / MSA / NDA | DOCX | Word MCP |
| Быстрая заметка | Markdown → DOCX | Pandoc MCP |
| Презентация | DOCX (пока нет PPTX) | Word MCP |

### 2. Структура документа AmriTech

Каждый документ включает:

**Header:**
- Логотип: `YourCompany LLC`
- Дата документа
- Тип: [GUIDE], [REPORT], [PROPOSAL], [CONTRACT], [MEMO]

**Body:**
- Чёткая структура с заголовками (H1, H2, H3)
- Numbered lists для шагов
- Таблицы для данных
- Bold для ключевых терминов

**Footer:**
- YourCompany LLC
- (555) 000-0000 | yourcompany.example.com
- Brooklyn, NY · Serving NYC / NJ / PA
- Confidential (если применимо)

### 3. Брендирование

| Элемент | Стиль |
|---------|-------|
| Заголовки | Bold, #025ADD blue |
| Подзаголовки | Bold, #2D2D2D |
| Body text | Regular, #2D2D2D, 11pt |
| Акценты | #EC9F00 gold (borders, highlights) |
| Font | Calibri (DOCX) или Arial (HTML) |

### 4. Создание через Word MCP

```
1. create_document — создай новый .docx
2. add_heading — заголовки (level 1, 2, 3)
3. add_paragraph — текст
4. add_table — таблицы с данными
5. format_text — bold, italic, color
```

**Пример — создание гайда:**
```
create_document: "/tmp/amritech-guide-crm.docx"
add_heading: "CRM Quick Start Guide", level=1
add_paragraph: "Этот гайд поможет вам начать работу с AmriTech CRM..."
add_heading: "1. Вход в систему", level=2
add_paragraph: "Откройте crm.yourcompany.example.com в браузере..."
add_table: [["Шаг", "Действие"], ["1", "Откройте CRM"], ["2", "Введите логин"]]
```

## Workflow: Доставка документа

### Вариант A: Email с вложением

```
1. Создай документ через Word MCP → сохрани в /tmp/
2. Отправь через Email MCP:
   - to: "cofounder@example.com"
   - subject: "[GUIDE] CRM Quick Start — AmriTech"
   - body: "Привет Sam! Вот гайд по CRM. Детали в документе."
   - attachment: "/tmp/amritech-guide-crm.docx"
```

### Вариант B: Email с HTML контентом

Если документ короткий (< 1 страницы) — отправь как HTML email используя `amritech-html-email` skill.

### Вариант C: Telegram уведомление

После создания документа — уведоми в TG:
```
📄 Создан документ: {название}
Тип: {GUIDE/REPORT/PROPOSAL}
Для: @cofounder_handle / @founder_handle
Отправлен на: cofounder@example.com

Краткое содержание: {2-3 строки}
```

## Типы документов

### 1. Гайд / Инструкция
**Для кого:** Alex, Sam (новые процессы)
**Формат:** DOCX с пошаговыми инструкциями + скриншоты (если доступны)
**Структура:**
1. Цель гайда
2. Необходимые инструменты
3. Пошаговая инструкция
4. FAQ / типичные ошибки
5. Контакт для вопросов

### 2. Еженедельный отчёт
**Для кого:** Alex (Co-Founder & CEO)
**Формат:** HTML email (используй `amritech-html-email`) ИЛИ DOCX для архива
**Структура:**
1. Ключевые метрики
2. Что сделано
3. Проблемы
4. План на следующую неделю

### 3. Proposal / КП
**Для кого:** Клиент (через Alex)
**Формат:** DOCX — профессиональный, branded
**Структура:**
1. Executive Summary
2. Understanding Your Needs (их проблемы)
3. Proposed Solution (наш план)
4. Pricing
5. Timeline
6. About AmriTech
7. Next Steps

### 4. Контракт / MSA
**Для кого:** Клиент (через Legal → Alex)
**Формат:** DOCX — юридический
**Обязательно:** пройти через Legal Assistant для review

### 5. Onboarding Package
**Для кого:** Новый клиент
**Формат:** DOCX + email
**Содержит:** welcome letter, IT audit checklist, credentials form, emergency contacts

## Правила

1. **Язык:** Внутренние документы — русский. Клиентские — английский.
2. **BCC:** Клиентские документы — обязательно BCC cto@example.com, founder@example.com, cofounder@example.com
3. **Confidential:** На proposals и contracts добавляй `CONFIDENTIAL` в footer
4. **Версионирование:** В имени файла: `amritech-{type}-{client}-{date}.docx`
5. **Сохранение:** Документы → `/tmp/` (для отправки) + комментарий в Paperclip task

## Контакты для доставки

| Кому | Email | Telegram |
|------|-------|----------|
| Alex | founder@example.com | @founder_handle |
| Sam | cofounder@example.com | @cofounder_handle |
| Tim | cto@example.com | @cto_handle |
