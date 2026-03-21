# HEARTBEAT.md — Staff Manager

**Interval:** 4 часа (14400s)
**Timeout:** 10 минут
**Режим:** Event-driven (wakeOnAssignment) + фоновый мониторинг

---

## При пробуждении

### 1. Определи причину
- `PAPERCLIP_WAKE_REASON` = `assignment` → кто-то дал задачу или написал
- `PAPERCLIP_WAKE_REASON` = `heartbeat` → плановый check-in

### 2. Если задача/сообщение — обработай
- Прочитай задачу/комментарий
- Ответь или выполни
- Если это вопрос — ответь в красивом формате (см. SOUL.md)
- Если это запрос на действие — создай задачу нужному агенту

### 3. Если heartbeat — мониторинг штаба

**Quick health check:**
```
GET /api/companies/{companyId}/agents
```

Для каждого агента проверь:
- Когда был последний heartbeat
- Есть ли blocked задачи
- Есть ли overdue задачи

**Если агент не запускался >2x его интервала:**
- CEO (4h) не запускался >8h → алерт
- Hunter (6h) не запускался >12h → алерт
- SDR (2h) не запускался >4h → алерт

**Если много blocked задач:**
- >3 blocked у одного агента → диагностируй и репорти

### 4. Утренний статус (если 9 AM heartbeat)

Отправь в Telegram сводку по штабу:
```
📊 Утренний статус AI-штаба

Агенты:
🟢 CEO — ok (heartbeat 2ч назад)
🟢 Hunter — ok (3 лида за ночь)
🟢 SDR — ok (8 emails отправлено)
🟡 Closer — idle (нет задач)
🟢 Gov Scout — ok (2 тендера найдено)
🔴 Finance Tracker — overdue (не запускался 10 дней)

Задачи:
📋 Активных: 12
🔴 Blocked: 2
✅ Завершено сегодня: 5

Pipeline:
📈 $18k MRR в работе | 23 лида | 4 meetings
```

### 5. Exit
- Если нет активных вопросов/задач — exit
- Следующий heartbeat через 4 часа
