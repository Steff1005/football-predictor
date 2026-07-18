#!/usr/bin/env python3
"""Обчислює всі дані фінального звіту ЧС-2026 Kickoff → report_data.json"""
import csv, json, re, unicodedata
from collections import defaultdict, Counter
from datetime import datetime, timedelta, timezone

import os; BASE = os.path.dirname(os.path.abspath(__file__))
d = json.load(open(f'{BASE}/wc_dump.json'))
matches = [m for m in d['matches'] if m['status'] == 'finished']
preds = [p for p in d['preds'] if p['is_calculated']]
profiles = {p['id']: p for p in d['profiles']}

def canon(s):
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r'[^a-z]', '', s)
    if 'bosnia' in s: return 'bosnia'
    if 'capeverde' in s or 'caboverde' in s: return 'capeverde'
    if 'congo' in s: return 'congo'
    if 'curacao' in s: return 'curacao'
    if s in ('czechrepublic', 'czechia'): return 'czech'
    if s in ('usa', 'unitedstates', 'unitedstatesofamerica'): return 'usa'
    return s

# Два акаунти «Олександр Шляхтюк» — розрізняємо як на сайті: (В) і (П)
USERNAME_SUFFIX = {'oleksandr_shliakhtiuk': ' (В)', 'oleksandr_shliakhtiuk2106': ' (П)'}
def pname(uid):
    p = profiles[uid]
    full = ' '.join(x for x in [p.get('first_name'), p.get('last_name')] if x)
    name = re.sub(r'\s+', ' ', full).strip() or p.get('username') or 'Гравець'
    return name + USERNAME_SUFFIX.get(p.get('username'), '')

# ── odds CSV join ─────────────────────────────────────────────
odds = {}
for r in csv.DictReader(open('/Users/macbook/Desktop/wc2026_odds.csv')):
    key = (r['date'][:10], canon(r['home']), canon(r['away']))
    odds[key] = r

def match_odds(m):
    # CSV dates близькі до kickoff (можлива різниця через часовий пояс) — шукаємо ±1 день
    ko = datetime.fromisoformat(m['kickoff_at'])
    for delta in (0, 1, -1):
        day = (ko + timedelta(days=delta)).strftime('%Y-%m-%d')
        r = odds.get((day, canon(m['home_team']), canon(m['away_team'])))
        if r: return r
    return None

matched, mismatch = 0, []
for m in matches:
    r = match_odds(m)
    if r:
        matched += 1
        sh, sa = map(int, r['score'].split('-'))
        if sh != m['home_score'] or sa != m['away_score']:
            mismatch.append((m['home_team'], m['away_team']))
    else:
        mismatch.append(('NO_ODDS', m['home_team'], m['away_team']))
print(f'odds matched: {matched}/{len(matches)}; issues: {mismatch}')

# ── scoring ───────────────────────────────────────────────────
def sign(x): return (x > 0) - (x < 0)

def score_all(ph, pa, rh, ra):
    exact = ph == rh and pa == ra
    manh = abs(ph - rh) + abs(pa - ra)
    dir_ok = sign(ph - pa) == sign(rh - ra)
    rnear = abs((ph - pa) - (rh - ra)) == 1
    official = 4 if exact else (1 if dir_ok else 0)
    # майже: score-комп (3 точний / 2 майже) + result-комп (1 напрям / 0.5 рез-майже)
    sc = 3 if exact else (2 if manh == 1 else 0)
    rc = 1 if dir_ok else (0.5 if rnear else 0)
    return dict(exact=exact, manh=manh, dir_ok=dir_ok, rnear=rnear,
                official=official, maybe=sc + rc, is_maybe=(not exact and manh == 1))

mby = {m['id']: m for m in matches}
users = sorted({p['user_id'] for p in preds}, key=pname.__call__ if False else lambda u: pname(u))

# per-user accumulators
T = {u: dict(name=pname(u), official=0, maybe=0.0, n_exact=0, n_maybe=0, n_result=0,
             value=0.0, money_both=0.0, money_res=0.0, money_cs=0.0,
             n_odds_matches=0, best_cs=None, best_cs_odds=0) for u in users}

preds_by_match = defaultdict(list)
for p in preds:
    if p['match_id'] in mby:
        preds_by_match[p['match_id']].append(p)

user_match_pts = defaultdict(dict)   # для динаміки/днів
for m in matches:
    o = match_odds(m)
    rh, ra = m['home_score'], m['away_score']
    for p in preds_by_match[m['id']]:
        u = p['user_id']
        s = score_all(p['predicted_home'], p['predicted_away'], rh, ra)
        t = T[u]
        t['official'] += s['official']
        t['maybe'] += s['maybe']
        t['n_exact'] += s['exact']
        t['n_maybe'] += s['is_maybe']
        t['n_result'] += (s['dir_ok'] and not s['exact'])
        user_match_pts[u][m['id']] = s['official']
        if o:
            t['n_odds_matches'] += 1
            ro, cs = float(o['res_odds_open']), float(o['cs_odds'])
            if s['dir_ok']:
                t['value'] += 1 * ro
                t['money_res'] += 10 * ro - 10
            else:
                t['money_res'] -= 10
            if s['exact']:
                t['value'] += 3 * cs
                t['money_cs'] += 10 * cs - 10
                if cs > t['best_cs_odds']:
                    t['best_cs_odds'] = cs
                    t['best_cs'] = f"{m['home_team']} {rh}:{ra} {m['away_team']} @{cs}"
            else:
                t['money_cs'] -= 10
for t in T.values():
    t['money_both'] = round(t['money_res'] + t['money_cs'], 2)
    t['money_res'] = round(t['money_res'], 2); t['money_cs'] = round(t['money_cs'], 2)
    t['value'] = round(t['value'], 2); t['maybe'] = round(t['maybe'], 2)

# ── серії та цікавинки ────────────────────────────────────────
matches_sorted = sorted(matches, key=lambda m: m['kickoff_at'])
streaks = {u: dict(exact=0, result=0, miss=0) for u in users}
cur = {u: dict(exact=0, result=0, miss=0) for u in users}
for m in matches_sorted:
    for p in preds_by_match[m['id']]:
        u = p['user_id']
        s = score_all(p['predicted_home'], p['predicted_away'], m['home_score'], m['away_score'])
        for k, cond in (('exact', s['exact']), ('result', s['dir_ok']), ('miss', s['official'] == 0)):
            cur[u][k] = cur[u][k] + 1 if cond else 0
            streaks[u][k] = max(streaks[u][k], cur[u][k])

all_missed, all_result, max_exact = [], [], (0, [])
for m in matches_sorted:
    ps = preds_by_match[m['id']]
    if not ps: continue
    ss = [score_all(p['predicted_home'], p['predicted_away'], m['home_score'], m['away_score']) for p in ps]
    lbl = f"{m['home_team']} {m['home_score']}:{m['away_score']} {m['away_team']}"
    if all(x['official'] == 0 for x in ss): all_missed.append(lbl)
    if all(x['official'] >= 1 for x in ss): all_result.append(lbl)
    ne = sum(x['exact'] for x in ss)
    if ne > max_exact[0]: max_exact = (ne, [lbl])
    elif ne == max_exact[0] and ne > 0: max_exact[1].append(lbl)

fav_score = {u: Counter() for u in users}
real_scores = Counter(f"{m['home_score']}:{m['away_score']}" for m in matches)
for p in preds:
    if p['match_id'] in mby:
        fav_score[p['user_id']][f"{p['predicted_home']}:{p['predicted_away']}"] += 1

# близнюки: пари з максимумом однакових прогнозів
pair_same = Counter()
for m in matches_sorted:
    ps = preds_by_match[m['id']]
    for i in range(len(ps)):
        for j in range(i + 1, len(ps)):
            a, b = ps[i], ps[j]
            if (a['predicted_home'], a['predicted_away']) == (b['predicted_home'], b['predicted_away']):
                key = tuple(sorted([a['user_id'], b['user_id']]))
                pair_same[key] += 1

# ── ранжування: бали → результати → точні → к-сть прогнозів (місця унікальні) ──
def make_ranker():
    acc = {u: dict(pts=0, res=0, ex=0, np=0) for u in users}
    def feed(p, m):
        s = score_all(p['predicted_home'], p['predicted_away'], m['home_score'], m['away_score'])
        a = acc[p['user_id']]
        a['pts'] += s['official']; a['res'] += s['dir_ok']; a['ex'] += s['exact']; a['np'] += 1
    def ranks():
        order = sorted(users, key=lambda u: (-acc[u]['pts'], -acc[u]['res'], -acc[u]['ex'], -acc[u]['np']))
        return {u: i + 1 for i, u in enumerate(order)}, {u: acc[u]['pts'] for u in users}
    return feed, ranks

# ── дні на позиціях ───────────────────────────────────────────
day_of = {}
for m in matches_sorted:
    ko = datetime.fromisoformat(m['kickoff_at']) + timedelta(hours=3)  # UA
    day_of[m['id']] = ko.strftime('%Y-%m-%d')
days = sorted(set(day_of.values()))
days_at_pos = {u: Counter() for u in users}
day_pts = {u: [] for u in users}   # накопичені бали після кожного дня (для перегонів)
feed, get_ranks = make_ranker()
for day in days:
    for m in matches_sorted:
        if day_of[m['id']] == day:
            for p in preds_by_match[m['id']]: feed(p, m)
    rankmap, pts = get_ranks()
    for u in users:
        days_at_pos[u][rankmap[u]] += 1
        day_pts[u].append(pts[u])

# ── динаміка по турах (bump) ──────────────────────────────────
ROUND_ORDER = ['LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL']
def round_key(m):
    r = m['round'] or ''
    mm = re.search(r'(?:GROUP_STAGE_|Regular Season - )0*(\d+)', r, re.I)
    if mm: return (0, int(mm.group(1)))
    return (1, ROUND_ORDER.index(r)) if r in ROUND_ORDER else (2, 0)
rounds = sorted({m['round'] for m in matches}, key=lambda r: round_key({'round': r}))
def rlabel(r):
    mm = re.search(r'(?:GROUP_STAGE_|Regular Season - )0*(\d+)', r, re.I)
    if mm: return f'Тур {mm.group(1)}'
    return {'LAST_32': '1/16', 'LAST_16': '1/8', 'QUARTER_FINALS': '1/4',
            'SEMI_FINALS': '1/2', 'THIRD_PLACE': 'За 3-тє', 'FINAL': 'Фінал'}.get(r, r)
bump = {u: [] for u in users}
feed2, get_ranks2 = make_ranker()
for r in rounds:
    for m in matches_sorted:
        if m['round'] == r:
            for p in preds_by_match[m['id']]: feed2(p, m)
    rankmap, pts = get_ranks2()
    for u in users: bump[u].append(dict(rank=rankmap[u], pts=pts[u]))

# найкращий/найгірший тур кожного гравця
round_pts = {u: {} for u in users}
for r in rounds:
    for m in matches_sorted:
        if m['round'] == r:
            for p in preds_by_match[m['id']]:
                s = score_all(p['predicted_home'], p['predicted_away'], m['home_score'], m['away_score'])
                round_pts[p['user_id']][r] = round_pts[p['user_id']].get(r, 0) + s['official']

out = dict(
    generated=datetime.now(timezone.utc).isoformat(),
    n_matches=len(matches), n_odds=matched,
    users={u: T[u] for u in users},
    streaks={u: streaks[u] for u in users},
    fav_score={u: fav_score[u].most_common(3) for u in users},
    real_scores=real_scores.most_common(5),
    all_missed=all_missed, all_result_n=len(all_result), all_missed_n=len(all_missed),
    max_exact=max_exact,
    twins=[(pname(a), pname(b), c) for (a, b), c in pair_same.most_common(3)],
    days_at_pos={u: dict(days_at_pos[u]) for u in users},
    n_days=len(days), day_list=days, day_pts=day_pts,
    rounds=[rlabel(r) for r in rounds],
    bump={u: bump[u] for u in users},
    round_pts={u: {rlabel(k): v for k, v in round_pts[u].items()} for u in users},
    names={u: pname(u) for u in users},
)
json.dump(out, open(f'{BASE}/report_data.json', 'w'), ensure_ascii=False, indent=1)

# summary print
for key, fmt in [('official', '{official}'), ('maybe', '{maybe} (майже {n_maybe})'),
                 ('value', '{value}'), ('money_both', '{money_both}'),
                 ('money_res', '{money_res}'), ('money_cs', '{money_cs}')]:
    rank = sorted(users, key=lambda u: -T[u][key])
    print(f'\n== {key} ==')
    for u in rank: print(f"  {T[u]['name']:25s} {fmt.format(**T[u])}")
print('\nсерії точних:', {T[u]['name']: streaks[u]['exact'] for u in users})
print('серії результатів:', {T[u]['name']: streaks[u]['result'] for u in users})
print('серії промахів:', {T[u]['name']: streaks[u]['miss'] for u in users})
print('днів на 1-му:', {T[u]['name']: days_at_pos[u].get(1, 0) for u in users}, 'всього днів:', len(days))
print('всі промахнулись:', len(all_missed), '; всі вгадали рез:', len(all_result), '; макс точних/матч:', max_exact)
