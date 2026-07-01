@AGENTS.md

# Kickoff — football-predictor

Гра-прогнозувалка футбольних матчів серед друзів. Користувачі ставлять рахунки на майбутні
матчі турнірів (ЧС, Євро, УЛЧ…), після матчів нараховуються бали, ведуться рейтинги,
форма, зал слави та прогноз підсумкових місць.

Спілкування українською. Після значних дій — короткий структурований звіт (що зроблено,
числа, рішення).

## Деплой
НІКОЛИ не `npx vercel` / `vercel --prod`. Тільки `git add . && git commit && git push` —
Vercel деплоїть з GitHub автоматично. Прямого DDL-доступу до Supabase немає: міграції
(нові колонки, RLS) запускаються вручну в Supabase SQL Editor.

## Стек
- **Next.js 16** (App Router) + **React 19** + **Tailwind 4**
- **Supabase** — PostgreSQL + auth (`@supabase/ssr`)
- **Vercel** — хостинг
- **GROQ** — AI-аналіз (зараз авто-генерація по матчах вимкнена, див. нижче)
- **web-push** — пуш-сповіщення

## Правила нарахування балів (`lib/scoring.js`)
```
точний рахунок   → 4  (points_exact 3 + points_result 1)
вгаданий результат (1X2) → 1
інакше           → 0
```
**Рахується ТІЛЬКИ основний час (90' + компенсований).** Додатковий час і пенальті
НЕ враховуються. Гол на 90'+3' зараховується; гол на 105' — ні.

## Джерела даних
- **football-data.org** (`/api/sync-matches`) — розклад і результати. `league_id` —
  код competition (`WC`, `CL`, `PL`…). Матчі з невизначеними командами (TBD у плей-оф)
  у БД **не імпортуються** (фільтр по `homeTeam.name && awayTeam.name`).
  - Рахунок беремо з `score.regularTime` (90', з компенсованим), **не** `fullTime` —
    бо `fullTime` для плей-оф зліплює дод. час + пенальті (1:1 на пенальті = 4:5).
  - Статуси `IN_PLAY` і `PAUSED` (перерви) → `live`; `FINISHED` → `finished`.
- **ESPN** (`site.api.espn.com/.../soccer/fifa.world/...`) — живі рахунки, коефіцієнти
  (pickcenter, американський формат), хронологія подій (keyEvents). Без ключа.

## Логіка плей-оф (дод. час / пенальті) — `app/api/live-scores/route.js`
Матчі закриваються на **результаті основного часу**, щойно починається овертайм:
- «після основного часу» визначається за статусом (`OVERTIME`/`_AET`/`_PEN`) **або**
  за годинником `≥ 91'` (бо активний ET ESPN віддає як `STATUS_IN_PROGRESS`).
- рахунок 90' відновлюється з ESPN keyEvents: голи з base-хвилиною `≤ 90`
  (фільтр `scoringPlay === true` — ловить хедери/пенальті, не лише `type === 'goal'`).
  `"90'+1'"` рахується (база 90), `"103'"` — ні.
- `sync-matches` (через `regularTime`) — резервний фіналізатор.

## Прогноз підсумкових місць (`lib/probability.js`)
Монте-Карло: кожному гравцю на кожен матч, що залишився, випадково +0/+1/+4 (по ⅓).
- Кількість матчів, що залишились = `total − finished` (`remainingMatchCount`), де
  `total` з `tournaments.total_matches` → `TOTAL_MATCHES_BY_LEAGUE` (`WC: 104`) → к-сть
  рядків. Так враховуються TBD-матчі плей-оф, яких ще немає в БД, і число
  самокоригується при завершенні матчів.
- Кеш у `probability_cache` (50k семплів) пишеться сервісним ключем. **Читання анон-ключем
  блокує RLS** → сторінка standings рахує live через SSR-фолбек (`SAMPLES_FAST=5000`).

## Структура
```
app/
  page.js                      — головна: лідерборд, форма, аналітика, зал слави
  tournaments/[id]/            — турнір: matches/live/preds/standings/rounds/dynamics таби
  players/[id], profile, live, hall-of-fame, admin, auth
  api/
    sync-matches    — розклад+результати з fd.org (GET, Bearer CRON_SECRET, зовн. планувальник)
    live-scores     — живі рахунки з ESPN + авто-фіналізація (+ плей-оф логіка)
    recalculate/[matchId], update-results — перерахунок балів
    analyze-round, analyze-match, backfill-analyses — AI-аналіз (GROQ)
    push/*          — підписки та сповіщення
lib/
  scoring.js          — calculatePoints
  calc-predictions.js — нарахування балів + оновлення профілів + перебудова прогнозу місць
  probability.js      — Монте-Карло прогноз місць, remainingMatchCount
  generate-match-analysis.js, get-match-events.js — GROQ-аналіз (по матчах вимкнено)
```

## Основні таблиці Supabase
- `tournaments` (league_id, season, is_active; опц. total_matches)
- `matches` (external_id, home/away_team, home/away_score, status, kickoff_at, round, *_logo)
- `predictions` (user_id, match_id, predicted_home/away, points, points_exact, points_result,
  is_calculated) — `upsert` по `(user_id, match_id)`, історії змін немає (нема `updated_at`)
- `profiles` (total_points, total_predictions, avatar_url, notify_results…)
- `round_analyses`, `match_analyses`, `probability_cache`, push-таблиці

## Відомі нюанси / фікси
- **Рахунок плей-оф:** тільки `regularTime` (90'), не `fullTime` — інакше з'являється 4:5
  замість 1:1 (дод. час + пенальті).
- **Дод. час за годинником:** статус ESPN під час ET ненадійний (`IN_PROGRESS`), орієнтир — хвилина ≥91.
- **Голи з keyEvents:** фільтрувати по `scoringPlay`, не `type==='goal'` (інакше губляться хедери).
- **Прогноз місць:** рахувати `total − finished`, ділити Монте-Карло на фактичну к-сть семплів
  (`samples`, не константу `SAMPLES`). Ймовірність <1%, але >0, зберігати як `0.5` (маркер
  «<1%»), а не округляти в 0 — інакше дрібний шанс не відрізнити від «вибув» (показ «—»).
- **Лідерборд:** `.in('match_id', ...)` чанкувати (≤150 id) — інакше задовгий URL → `fetch failed` → порожня форма.
- **Одночасні матчі:** ESPN-події мапити масивом на хвилину старту + матч по назвах команд (інакше рахунок «перетікає»).
- **Авто-аналіз по матчах вимкнено** в `calc-predictions.js` (вивід `match_analyses` ніде не показується). Функція й роут `/api/analyze-match` лишились для on-demand.
- **Аналіз по турах** (`round_analyses`) — кнопка лише для адміна (`isAdmin`).

## Корисне
```bash
npm run dev          # локальний запуск
npx eslint <file>    # лінт (у проді деплоїться попри warning <img>/<a>)
# Тригер синку:  GET /api/sync-matches  з заголовком  Authorization: Bearer $CRON_SECRET
```
