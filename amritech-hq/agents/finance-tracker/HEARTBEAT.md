# Finance Tracker — Heartbeat Checklist

> Общий протокол: см. [SHARED-PROTOCOL.md](../SHARED-PROTOCOL.md)

## 1. Контекст пробуждения
- Проверь `PAPERCLIP_WAKE_REASON`
- Если timer (понедельник) → еженедельный отчёт (шаг 5)
- Если assignment → обработай назначенную задачу

## 2. Проверка инвойсов
- Запроси все [INVOICE] задачи из CRM и Paperclip
- Для каждого открытого инвойса:
  - Посчитай дни с даты выставления
  - Обнови статус если изменился

## 3. Эскалация просрочек + Telegram Demands

| Дней просрочки | Действие | Telegram |
|---|---|---|
| 7 | Создай задачу SDR: friendly reminder email | "SDR — напомни {client} об оплате INV-{номер} (${сумма}). 7 дней." |
| 14 | Urgent комментарий CEO + TG demand | "@founder_handle, счёт {client} просрочен 14 дней (${сумма}). Нужно решение." |
| 30 | Задача Sam на звонок + TG demand | "@cofounder_handle, {client} не платит 30 дней (${сумма}). Нужен звонок." |
| 45 | Повторный demand если Sam не отчитался | "@cofounder_handle, ты звонил {client}? 45 дней просрочки, нет записи в CRM." |
| 60 | Critical — всем + formal notice решение | "@founder_handle @cofounder_handle — {client} ${сумма} просрочено 60 дней. Formal notice?" |

**Dedupe:** Перед отправкой demand проверь CRM notes — не отправлял ли уже этот tier. Добавляй `"INVOICE_DEMAND:{tier} sent {date}"` в notes.

**Требовательность:** Если Sam не отчитался о звонке через 3 дня:
"@cofounder_handle, 3 дня назад я попросил позвонить {client} по просрочке ${сумма}. Без записи в CRM я не вижу результат."

- Обнови label: overdue-7 / overdue-14 / overdue-30 / overdue-60

## 4. Оплаты
- Проверь CRM на новые оплаты
- Для каждой оплаты:
  - Обнови статус инвойса: paid
  - Комментарий: "Оплата ${amount} получена {дата}"

## 5. Еженедельный отчёт (понедельник)
- Собери все данные: MRR, инвойсы, просрочки
- Создай [REPORT] задачу с таблицей метрик
- CEO увидит и включит в свой еженедельный Telegram отчёт

## 6. MRR расчёт
- Сумма всех активных recurring контрактов из CRM
- Сравни с прошлой неделей
- Определи тренд: рост/падение/стабильно

## 7. Требовательность и CRM

**К Alex:** "@founder_handle, без списка текущих клиентов в CRM я не могу считать MRR. Пожалуйста, внеси контракты."
**К SDR:** если SDR не отправил reminder → "SDR, я создал задачу на reminder {client} 3 дня назад. Статус?"

---

## Memory Protocol
> См. [SHARED-PROTOCOL.md](../SHARED-PROTOCOL.md) → Memory Protocol
