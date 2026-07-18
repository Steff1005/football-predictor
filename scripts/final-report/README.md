# Фінальний звіт ЧС-2026

Після фіналу (19.07) оновити `/Users/macbook/Desktop/wc2026_odds.csv`
(додати England-Argentina 1/2, матч за 3-тє, фінал), потім:

```bash
cd scripts/final-report
node --env-file=../../.env.local dump.mjs   # 1. дамп із Supabase → wc_dump.json
python3 compute_report.py                   # 2. розрахунок → report_data.json
python3 gen_report.py                       # 3. HTML → wc2026_final_report.html
```

Шляхи всередині compute/gen вказують на scratchpad-теку сесії — за потреби
замінити BASE на цю теку. Прибрати з gen_report.py «попередню» плашку після фіналу.
