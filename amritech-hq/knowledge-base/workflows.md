# Рабочие процессы AmriTech

## Главная воронка продаж

```
Hunter находит компанию
    ↓
Оценивает ICP score (0-100)
    ↓
Score 60+ с email → SDR получает автоматом
    ↓
SDR пишет персонализированный email
    ↓
Alex подтверждает время отправки
    ↓
SDR отправляет (Пн-Чт, 8-10 AM ET)
    ↓
Day 3 → SDR шлёт follow-up #1 (автоматом)
    ↓
Day 7 → SDR шлёт follow-up #2 (автоматом)
    ↓
Лид ответил?
    ├── ДА (положительно) → SDR уведомляет → Alex подтверждает → Sam intro call + Closer briefing → Alex pricing → Sam closing call
    ├── ДА (вопрос) → SDR готовит ответ → Alex подтверждает → SDR отправляет
    ├── ДА (отказ) → SDR закрывает вежливо → архив
    └── НЕТ → Day 14 → финальное письмо → nurture (вернёмся через 90 дней)
```

## Что происходит когда лид ответил положительно

1. **SDR** видит ответ в IMAP
2. **SDR** классифицирует: "positive interest"
3. **SDR** обновляет CRM: `outreachStatus → replied_interested`
4. **SDR** пишет в TG: "📧 Лид ответил! Ждём решения @founder_handle"
5. **Alex** видит в TG → одобряет: "звоните"
6. **SDR** создаёт 2 задачи: **Closer** (briefing) + **Sam** (intro call)
7. **Sam** звонит клиенту — знакомство, потребности, rapport. Записывает в CRM.
8. **Closer** готовит briefing с учётом заметок Sam (BANT, конкуренты, pricing)
9. **Closer** пишет в TG: "Briefing готов. @cofounder_handle — closing call. Pricing и условия согласованы с @founder_handle."
10. **Alex** согласовывает pricing/условия (в TG или CRM)
11. **Sam** делает closing call — презентует цену, условия, закрывает сделку
12. Если закрыли → **Onboarding** + **Contract Manager** + **Finance** запускаются автоматом

**Правило:** Sam = ВСЕ звонки (intro, closing, check-in, renewal). Alex = решения (pricing, одобрения, стратегия).

## Что происходит при renewal

1. **Contract Manager** видит что контракт через 90 дней
2. 60 дней → performance review
3. 30 дней → создаёт задачу SDR (email) + demand Sam (звонок)
4. **Sam** звонит клиенту, записывает в CRM
5. 15 дней → если нет ответа → эскалация к Alex
6. 7 дней → КРИТИЧНО → все тегнуты в TG

## Что происходит при просрочке оплаты

1. **Finance Tracker** видит overdue invoice
2. 7 дней → SDR шлёт friendly reminder email
3. 14 дней → demand к Alex: "Решение?"
4. 30 дней → demand к Sam: "Позвони!"
5. 45 дней → повторный demand если Sam не записал результат в CRM
6. 60 дней → КРИТИЧНО: "Formal notice? Pause service?"

## Что происходит при новом клиенте

1. Alex закрыл сделку → **Closer** обновляет CRM: `closed_won`
2. **Closer** автоматом создаёт задачи:
   - `[ONBOARD]` для Onboarding Agent
   - `[CONTRACT]` для Contract Manager
3. **Onboarding** отправляет welcome email + IT audit checklist
4. **Sam** делает check-in звонок на Day 3
5. 30 дней → Onboarding завершён → **Finance** создаёт первый invoice

## Demand система (агенты гоняют людей)

Агенты не ждут молча. Если нужно действие от человека — они напоминают:

### SDR → Alex (одобрение по лидам)
| Прошло | Сообщение |
|--------|----------|
| 2ч | "Лид ответил 2ч назад. @founder_handle, решение — звоним?" |
| 4ч | "⚠️ Лид остывает! @founder_handle одобри — @cofounder_handle ждёт" |
| 8ч | "🔴 СРОЧНО @founder_handle @cto_handle!" |

### Closer → Sam (closing calls)
| Прошло | Сообщение |
|--------|----------|
| 24ч после одобрения Alex | "@cofounder_handle, pricing согласован. Позвони {company}!" |
| 48ч | "⚠️ @cofounder_handle, {company} ждёт 2 дня!" |
| 72ч | "🔴 @cofounder_handle @founder_handle @cto_handle — closing call не сделан 3 дня" |

### Contract Manager → Sam (renewals)
| До истечения | Сообщение |
|-------------|----------|
| 30 дней | "@cofounder_handle, позвони клиенту" |
| 15 дней | "⚠️ SDR outreach без ответа" |
| 7 дней | "🔴 КРИТИЧНО!" |

### Finance → все (оплата)
| Просрочка | Сообщение |
|-----------|----------|
| 14 дней | "@founder_handle, решение?" |
| 30 дней | "@cofounder_handle, позвони!" |
| 60 дней | "🔴 Formal notice?" |

## Саморазвитие агентов

Агенты замечают паттерны и предлагают улучшения:

1. Агент создаёт `[IMPROVEMENT]` задачу
2. IT Chef ревьюит
3. Если безопасно — применяет
4. Если рискованно — передаёт Tim'у

Пример: "SDR: dental ниша даёт 3x больше ответов чем law. Предлагаю сфокусировать Hunter."
