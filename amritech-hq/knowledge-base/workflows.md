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
Berik подтверждает время отправки
    ↓
SDR отправляет (Пн-Чт, 8-10 AM ET)
    ↓
Day 3 → SDR шлёт follow-up #1 (автоматом)
    ↓
Day 7 → SDR шлёт follow-up #2 (автоматом)
    ↓
Лид ответил?
    ├── ДА (положительно) → SDR уведомляет → Berik подтверждает → Ula intro call + Closer briefing → Berik pricing → Ula closing call
    ├── ДА (вопрос) → SDR готовит ответ → Berik подтверждает → SDR отправляет
    ├── ДА (отказ) → SDR закрывает вежливо → архив
    └── НЕТ → Day 14 → финальное письмо → nurture (вернёмся через 90 дней)
```

## Что происходит когда лид ответил положительно

1. **SDR** видит ответ в IMAP
2. **SDR** классифицирует: "positive interest"
3. **SDR** обновляет CRM: `outreachStatus → replied_interested`
4. **SDR** пишет в TG: "📧 Лид ответил! Ждём решения @ikberik"
5. **Berik** видит в TG → одобряет: "звоните"
6. **SDR** создаёт 2 задачи: **Closer** (briefing) + **Ula** (intro call)
7. **Ula** звонит клиенту — знакомство, потребности, rapport. Записывает в CRM.
8. **Closer** готовит briefing с учётом заметок Ula (BANT, конкуренты, pricing)
9. **Closer** пишет в TG: "Briefing готов. @UlaAmri — closing call. Pricing и условия согласованы с @ikberik."
10. **Berik** согласовывает pricing/условия (в TG или CRM)
11. **Ula** делает closing call — презентует цену, условия, закрывает сделку
12. Если закрыли → **Onboarding** + **Contract Manager** + **Finance** запускаются автоматом

**Правило:** Ula = ВСЕ звонки (intro, closing, check-in, renewal). Berik = решения (pricing, одобрения, стратегия).

## Что происходит при renewal

1. **Contract Manager** видит что контракт через 90 дней
2. 60 дней → performance review
3. 30 дней → создаёт задачу SDR (email) + demand Ula (звонок)
4. **Ula** звонит клиенту, записывает в CRM
5. 15 дней → если нет ответа → эскалация к Berik
6. 7 дней → КРИТИЧНО → все тегнуты в TG

## Что происходит при просрочке оплаты

1. **Finance Tracker** видит overdue invoice
2. 7 дней → SDR шлёт friendly reminder email
3. 14 дней → demand к Berik: "Решение?"
4. 30 дней → demand к Ula: "Позвони!"
5. 45 дней → повторный demand если Ula не записал результат в CRM
6. 60 дней → КРИТИЧНО: "Formal notice? Pause service?"

## Что происходит при новом клиенте

1. Berik закрыл сделку → **Closer** обновляет CRM: `closed_won`
2. **Closer** автоматом создаёт задачи:
   - `[ONBOARD]` для Onboarding Agent
   - `[CONTRACT]` для Contract Manager
3. **Onboarding** отправляет welcome email + IT audit checklist
4. **Ula** делает check-in звонок на Day 3
5. 30 дней → Onboarding завершён → **Finance** создаёт первый invoice

## Demand система (агенты гоняют людей)

Агенты не ждут молча. Если нужно действие от человека — они напоминают:

### SDR → Berik (одобрение по лидам)
| Прошло | Сообщение |
|--------|----------|
| 2ч | "Лид ответил 2ч назад. @ikberik, решение — звоним?" |
| 4ч | "⚠️ Лид остывает! @ikberik одобри — @UlaAmri ждёт" |
| 8ч | "🔴 СРОЧНО @ikberik @tr00x!" |

### Closer → Ula (closing calls)
| Прошло | Сообщение |
|--------|----------|
| 24ч после одобрения Berik | "@UlaAmri, pricing согласован. Позвони {company}!" |
| 48ч | "⚠️ @UlaAmri, {company} ждёт 2 дня!" |
| 72ч | "🔴 @UlaAmri @ikberik @tr00x — closing call не сделан 3 дня" |

### Contract Manager → Ula (renewals)
| До истечения | Сообщение |
|-------------|----------|
| 30 дней | "@UlaAmri, позвони клиенту" |
| 15 дней | "⚠️ SDR outreach без ответа" |
| 7 дней | "🔴 КРИТИЧНО!" |

### Finance → все (оплата)
| Просрочка | Сообщение |
|-----------|----------|
| 14 дней | "@ikberik, решение?" |
| 30 дней | "@UlaAmri, позвони!" |
| 60 дней | "🔴 Formal notice?" |

## Саморазвитие агентов

Агенты замечают паттерны и предлагают улучшения:

1. Агент создаёт `[IMPROVEMENT]` задачу
2. IT Chef ревьюит
3. Если безопасно — применяет
4. Если рискованно — передаёт Tim'у

Пример: "SDR: dental ниша даёт 3x больше ответов чем law. Предлагаю сфокусировать Hunter."
