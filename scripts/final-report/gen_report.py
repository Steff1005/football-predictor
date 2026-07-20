#!/usr/bin/env python3
"""Генерує фінальний HTML-звіт ЧС-2026 із report_data.json"""
import json, html
import os; BASE = os.path.dirname(os.path.abspath(__file__))
d = json.load(open(f'{BASE}/report_data.json'))
U, N = d['users'], d['names']
uids = list(U)

PLAYER_COLORS = ['#2fae6e', '#4d8fe0', '#e0a23f', '#d95f5f', '#9a6fe0', '#3fbfbf', '#e07b3f', '#d060a8']
# стабільні кольори: за офіційним місцем
# бали → правильні результати (вкл. точні) → точні рахунки
by_official = sorted(uids, key=lambda u: (-U[u]['official'],
                                          -(U[u]['n_result'] + U[u]['n_exact']), -U[u]['n_exact']))
COLOR = {u: PLAYER_COLORS[i % 8] for i, u in enumerate(by_official)}

def esc(s): return html.escape(str(s))
def short(name):
    parts = name.split(' ')
    return name if len(name) <= 14 else parts[0][0] + '. ' + ' '.join(parts[1:])
def fmt(x, dec=1):
    if isinstance(x, float) and not x.is_integer():
        s = f'{x:,.{dec}f}'
    else:
        s = f'{int(x):,}'
    return s.replace(',', ' ')
def money(x):
    cls = 'pos' if x > 0 else ('neg' if x < 0 else '')
    sign = '+' if x > 0 else ('−' if x < 0 else '')
    return f'<span class="{cls}">{sign}{fmt(abs(x))}</span>'

def medal(i): return ['🥇', '🥈', '🥉'][i] if i < 3 else str(i + 1)

def table(rows_html, head_html):
    return f'<div class="tblwrap"><table><thead><tr>{head_html}</tr></thead><tbody>{rows_html}</tbody></table></div>'

def name_cell(u):
    return (f'<td class="pl"><span class="dot" style="background:{COLOR[u]}"></span>{esc(N[u])}</td>')

# ── 1. Офіційна ──────────────────────────────────────────────
rows = ''
for i, u in enumerate(by_official):
    t = U[u]
    rows += (f'<tr><td class="rk">{medal(i)}</td>{name_cell(u)}'
             f'<td class="num b">{t["official"]}</td>'
             f'<td class="num">{t["n_exact"]}</td><td class="num">{t["n_result"]}</td>'
             f'<td class="num dim">{d["n_matches"] - t["n_exact"] - t["n_result"]}</td></tr>')
t_official = table(rows, '<th></th><th>Гравець</th><th class="num">Бали</th><th class="num">Точні</th><th class="num">Результати</th><th class="num">Промахи</th>')

# ── 2. Майже ─────────────────────────────────────────────────
by_maybe = sorted(uids, key=lambda u: (-U[u]['maybe'], -U[u]['n_maybe']))
rows = ''
for i, u in enumerate(by_maybe):
    t = U[u]
    delta = i - by_official.index(u)
    dl = '' if delta == 0 else (f'<span class="up">▲{-delta}</span>' if delta < 0 else f'<span class="dn">▼{delta}</span>')
    rows += (f'<tr><td class="rk">{medal(i)}</td>{name_cell(u)}'
             f'<td class="num b">{fmt(t["maybe"])}</td>'
             f'<td class="num">{t["n_maybe"]}</td><td class="num">{dl or "<span class=dim>=</span>"}</td></tr>')
t_maybe = table(rows, '<th></th><th>Гравець</th><th class="num">Бали</th><th class="num">«Майже»</th><th class="num">vs офіц.</th>')

# ── 3. Цінність ──────────────────────────────────────────────
by_value = sorted(uids, key=lambda u: -U[u]['value'])
rows = ''
for i, u in enumerate(by_value):
    t = U[u]
    delta = i - by_official.index(u)
    dl = '' if delta == 0 else (f'<span class="up">▲{-delta}</span>' if delta < 0 else f'<span class="dn">▼{delta}</span>')
    rows += (f'<tr><td class="rk">{medal(i)}</td>{name_cell(u)}'
             f'<td class="num b">{fmt(t["value"])}</td>'
             f'<td class="best">{esc(t["best_cs"] or "—")}</td>'
             f'<td class="num">{dl or "<span class=dim>=</span>"}</td></tr>')
t_value = table(rows, '<th></th><th>Гравець</th><th class="num">Бали×кф</th><th>Найдорожчий точний</th><th class="num">vs офіц.</th>')

# ── 4. Гроші ─────────────────────────────────────────────────
by_money = sorted(uids, key=lambda u: -U[u]['money_both'])
best_res = max(uids, key=lambda u: U[u]['money_res'])
best_cs = max(uids, key=lambda u: U[u]['money_cs'])
rows = ''
for i, u in enumerate(by_money):
    t = U[u]
    star_r = ' ★' if u == best_res else ''
    star_c = ' ★' if u == best_cs else ''
    rows += (f'<tr><td class="rk">{medal(i)}</td>{name_cell(u)}'
             f'<td class="num b">{money(t["money_both"])}</td>'
             f'<td class="num">{money(t["money_res"])}{star_r}</td>'
             f'<td class="num">{money(t["money_cs"])}{star_c}</td></tr>')
t_money = table(rows, '<th></th><th>Гравець</th><th class="num">Разом</th><th class="num">Лише результат</th><th class="num">Лише точний</th>')

# ── Bump chart SVG ───────────────────────────────────────────
rounds = d['rounds']; R = len(rounds); NP = len(uids)
CW, RH, LX, TY = 92, 46, 8, 30
W = LX * 2 + R * CW; H = TY + NP * RH + 14
def x(ri): return LX + (ri + 0.5) * CW
def y(rk): return TY + (rk - 0.5) * RH
svg = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Динаміка позицій" style="width:100%;min-width:{W * 0.72:.0f}px;display:block">']
for rk in range(1, NP + 1):
    svg.append(f'<line x1="{LX}" y1="{y(rk)}" x2="{W - LX}" y2="{y(rk)}" class="grid"/>')
for ri, r in enumerate(rounds):
    svg.append(f'<text x="{x(ri)}" y="16" class="rlab" text-anchor="middle">{esc(r)}</text>')
for u in by_official:
    pts = ' '.join(f'{x(ri):.0f},{y(c["rank"]):.0f}' for ri, c in enumerate(d['bump'][u]))
    svg.append(f'<polyline points="{pts}" fill="none" stroke="{COLOR[u]}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.9"/>')
for u in by_official:
    for ri, c in enumerate(d['bump'][u]):
        svg.append(f'<circle cx="{x(ri):.0f}" cy="{y(c["rank"]):.0f}" r="11" fill="{COLOR[u]}" class="dotc"/>'
                   f'<text x="{x(ri):.0f}" y="{y(c["rank"]):.0f}" class="dnum" text-anchor="middle" dominant-baseline="central">{c["rank"]}</text>')
svg.append('</svg>')
legend = ''.join(f'<span class="lg"><span class="dot" style="background:{COLOR[u]}"></span>{esc(short(N[u]))}</span>' for u in by_official)
bump_html = f'<div class="tblwrap">{"".join(svg)}</div><div class="legend">{legend}</div>'

# ── Перегони по днях (анімація) ──────────────────────────────
race_data = dict(
    days=[dd[8:10] + '.' + dd[5:7] for dd in d['day_list']],
    players=[dict(name=short(N[u]), color=COLOR[u], pts=d['day_pts'][u], rank=d['day_rank'][u])
             for u in by_official],
)
race_html = f'''
<div class="tblwrap race">
  <div class="rc-head">
    <button id="rc-play" aria-label="Відтворити">▶ Грати</button>
    <input id="rc-slider" type="range" min="0" max="{len(d['day_list']) - 1}" value="0" aria-label="День турніру">
    <span id="rc-day" class="rc-day"></span>
  </div>
  <div id="rc-bars" class="rc-bars" style="height:{len(uids) * 44}px"></div>
</div>
<script>
(function() {{
  const D = {json.dumps(race_data, ensure_ascii=False)};
  const bars = document.getElementById('rc-bars'), slider = document.getElementById('rc-slider'),
        play = document.getElementById('rc-play'), dayEl = document.getElementById('rc-day');
  const rows = D.players.map((p, i) => {{
    const r = document.createElement('div');
    r.className = 'rc-row';
    r.innerHTML = '<span class="rc-name">' + p.name + '</span>' +
      '<div class="rc-track"><div class="rc-bar" style="background:' + p.color + '"></div></div>' +
      '<span class="rc-pts"></span>';
    bars.appendChild(r);
    return r;
  }});
  const maxPts = Math.max(...D.players.map(p => p.pts[p.pts.length - 1]));
  function draw(di) {{
    dayEl.textContent = D.days[di] + ' · день ' + (di + 1) + '/' + D.days.length;
    slider.value = di;
    // Порядок = місце з тайбрейкерами (бали → результати → точні → к-сть прогнозів)
    D.players.forEach((p, i) => {{
      const r = rows[i];
      r.style.transform = 'translateY(' + (p.rank[di] - 1) * 44 + 'px)';
      r.querySelector('.rc-bar').style.width = (maxPts ? p.pts[di] / maxPts * 100 : 0) + '%';
      r.querySelector('.rc-pts').textContent = p.pts[di];
    }});
  }}
  let timer = null, di = 0;
  function stop() {{ clearInterval(timer); timer = null; play.textContent = '▶ Грати'; }}
  play.addEventListener('click', () => {{
    if (timer) return stop();
    if (di >= D.days.length - 1) di = -1;
    play.textContent = '⏸ Пауза';
    timer = setInterval(() => {{
      di++; draw(di);
      if (di >= D.days.length - 1) stop();
    }}, 1300);
  }});
  slider.addEventListener('input', () => {{ stop(); di = +slider.value; draw(di); }});
  draw(0);
}})();
</script>'''

# ── Матриця днів на місцях ───────────────────────────────────
maxd = max(v for u in uids for v in d['days_at_pos'][u].values())
rows = ''
for u in by_official:
    cells = ''
    for pos in range(1, NP + 1):
        v = d['days_at_pos'][u].get(str(pos), 0)
        a = 0 if v == 0 else 0.14 + 0.86 * (v / maxd)
        style = f'background:color-mix(in srgb, var(--acc) {a * 100:.0f}%, transparent)' if v else ''
        cells += f'<td class="num hm" style="{style}">{v or "·"}</td>'
    rows += f'<tr>{name_cell(u)}{cells}</tr>'
head = '<th>Гравець</th>' + ''.join(f'<th class="num">{p}</th>' for p in range(1, NP + 1))
t_days = table(rows, head)

# ── Улюблені рахунки ─────────────────────────────────────────
rows = ''
for u in by_official:
    cells = ''
    for k in range(3):
        fs = d['fav_score'][u]
        if k < len(fs):
            sc, cnt = fs[k]
            cells += (f'<td class="num"><span class="b">{esc(sc)}</span>'
                      f' <span class="dim">×{cnt}</span></td>')
        else:
            cells += '<td class="num dim">—</td>'
    rows += f'<tr>{name_cell(u)}{cells}</tr>'
real_row = ''.join(f'<td class="num"><span class="b">{esc(sc)}</span> <span class="dim">×{cnt}</span></td>'
                   for sc, cnt in d['real_scores'][:3])
rows += f'<tr><td class="pl dim">⚽ А насправді було…</td>{real_row}</tr>'
t_fav = ('<div class="plain">'
         + table(rows, '<th>Гравець</th><th class="num">№1</th><th class="num">№2</th><th class="num">№3</th>')
         + '</div>')

# ── Цікавинки ────────────────────────────────────────────────
smax = lambda k: max(uids, key=lambda u: d['streaks'][u][k])
se, sr = smax('exact'), smax('result')
miss_max = max(d['streaks'][u]['miss'] for u in uids)
miss_holders = [N[u] for u in uids if d['streaks'][u]['miss'] == miss_max]
top1 = max(uids, key=lambda u: d['days_at_pos'][u].get('1', 0))
tw = d['twins'][0]
fav_all = {u: d['fav_score'][u][0] for u in uids}
fav_top = max(uids, key=lambda u: fav_all[u][1])
best_cs_u = max(uids, key=lambda u: U[u]['best_cs_odds'])

best_exact = max(uids, key=lambda u: U[u]['n_exact'])
best_result = max(uids, key=lambda u: U[u]['n_result'] + U[u]['n_exact'])
cards = [
    ('🎯', 'Снайпер турніру', f'Найбільше точних рахунків у <b>{esc(N[best_exact])}</b> — '
                    f'{U[best_exact]["n_exact"]} із {d["n_matches"]} матчів.'),
    ('🧭', 'Майстер результату', f'Найбільше вгаданих результатів у <b>{esc(N[best_result])}</b> — '
                    f'{U[best_result]["n_result"] + U[best_result]["n_exact"]} матчів '
                    f'({(U[best_result]["n_result"] + U[best_result]["n_exact"]) * 100 // d["n_matches"]}%).'),
    ('🔥', 'Серії', f'<b>{esc(N[se])}</b> — {d["streaks"][se]["exact"]} точні поспіль (єдиний із серією 3). '
                    f'<b>{esc(N[sr])}</b> — {d["streaks"][sr]["result"]} результатів поспіль. '
                    f'Антирекорд ділять аж {["", "", "двоє", "троє", "четверо"][len(miss_holders)] if len(miss_holders) <= 4 else len(miss_holders)}: '
                    f'<b>{esc(", ".join(miss_holders))}</b> — по {miss_max} промахів поспіль. '
                    f'Причому обидва Олександри — це останні 6 матчів турніру: від чвертьфіналів до фіналу жодного вгаданого результату.'),
    ('🎪', 'Матчі-легенди', f'У <b>{d["all_missed_n"]}</b> матчах не вгадав ніхто (перший — {esc(d["all_missed"][0])}). '
                    f'У <b>{d["all_result_n"]}</b> — результат вгадали всі. '
                    f'Рекорд — <b>{d["max_exact"][0]} точних</b> в одному матчі: {esc(" та ".join(d["max_exact"][1]))}.'),
    ('💎', 'Найдорожчий точний', f'<b>{esc(N[best_cs_u])}</b>: {esc(U[best_cs_u]["best_cs"])} — '
                    f'кф {fmt(U[best_cs_u]["best_cs_odds"])} на точний рахунок!'),
    ('🎯', 'Звички', f'Улюблений рахунок турніру — <b>2:1</b> (найчастіше ставив {esc(N[fav_top])}: {fav_all[fav_top][1]}×). '
                    f'А реальність любила <b>{esc(d["real_scores"][0][0])}</b> — {d["real_scores"][0][1]} матчів.'),
    ('👯', 'Близнюки', f'<b>{esc(tw[0])}</b> і <b>{esc(tw[1])}</b> поставили однаково у {tw[2]} матчах із {d["n_matches"]}.'),
    ('👑', 'Король таблиці', f'<b>{esc(N[top1])}</b> провів на 1-му місці {d["days_at_pos"][top1].get("1", 0)} '
                    f'із {d["n_days"]} ігрових днів.'),
]
cards_html = ''.join(f'<div class="card"><div class="ci">{i}</div><h3>{t}</h3><p>{b}</p></div>' for i, t, b in cards)

# ── Подіум ───────────────────────────────────────────────────
podium = [
    (N[by_official[0]], f'{U[by_official[0]]["official"]} балів', 'Офіційна таблиця', COLOR[by_official[0]]),
    (N[by_maybe[0]], f'{fmt(U[by_maybe[0]]["maybe"])} балів · {U[by_maybe[0]]["n_maybe"]} «майже»', 'Таблиця «Майже»', COLOR[by_maybe[0]]),
    (N[by_value[0]], f'{fmt(U[by_value[0]]["value"])} балів×кф', 'Таблиця цінності', COLOR[by_value[0]]),
]
podium_html = ''.join(
    f'<div class="champ"><div class="ctag">{tag}</div><div class="cname" style="color:{c}">{esc(n)}</div><div class="cpts">{p}</div></div>'
    for n, p, tag, c in podium)

def section(id_, kick, title, note, body):
    return (f'<section id="{id_}"><div class="kick">{kick}</div><h2>{title}</h2>'
            f'<p class="note">{note}</p>{body}</section>')

page = f'''<meta charset="utf-8">
<title>ЧС-2026 · Фінальний звіт Kickoff</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root {{
  --bg:#eef2ee; --card:#ffffff; --ink:#1a241d; --dim:#6b7a70; --line:#d8e0d8;
  --acc:#16a34a; --gold:#b07f1a; --pos:#15803d; --neg:#c2453f; --grid:#dfe6df;
}}
@media (prefers-color-scheme: dark) {{ :root {{
  --bg:#0c1210; --card:#141c17; --ink:#e8efe9; --dim:#8fa295; --line:#243128;
  --acc:#2fbf71; --gold:#d9a441; --pos:#4ade80; --neg:#f87171; --grid:#222d26;
}} }}
:root[data-theme="dark"] {{
  --bg:#0c1210; --card:#141c17; --ink:#e8efe9; --dim:#8fa295; --line:#243128;
  --acc:#2fbf71; --gold:#d9a441; --pos:#4ade80; --neg:#f87171; --grid:#222d26;
}}
:root[data-theme="light"] {{
  --bg:#eef2ee; --card:#ffffff; --ink:#1a241d; --dim:#6b7a70; --line:#d8e0d8;
  --acc:#16a34a; --gold:#b07f1a; --pos:#15803d; --neg:#c2453f; --grid:#dfe6df;
}}
* {{ box-sizing:border-box }}
body {{ background:var(--bg); color:var(--ink); font:16px/1.55 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif; margin:0 }}
.wrap {{ max-width:960px; margin:0 auto; padding:28px 18px 64px }}
header {{ text-align:left; padding:34px 0 10px }}
.eyebrow {{ text-transform:uppercase; letter-spacing:.18em; font-size:12px; font-weight:700; color:var(--acc) }}
h1 {{ font-size:clamp(30px,6vw,52px); font-weight:800; letter-spacing:-.02em; line-height:1.05; margin:.25em 0 .3em; text-wrap:balance }}
.sub {{ color:var(--dim); max-width:60ch }}
.pill {{ display:inline-block; margin-top:14px; padding:4px 12px; border:1px solid var(--gold); color:var(--gold);
  border-radius:999px; font-size:13px; font-weight:600 }}
.podium {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:12px; margin:30px 0 8px }}
.champ {{ background:var(--card); border:1px solid var(--line); border-radius:14px; padding:18px 18px 16px; position:relative }}
.champ::before {{ content:'🏆'; position:absolute; top:14px; right:16px; font-size:20px }}
.ctag {{ font-size:11px; text-transform:uppercase; letter-spacing:.14em; color:var(--dim); font-weight:700 }}
.cname {{ font-size:21px; font-weight:800; margin:6px 0 2px; letter-spacing:-.01em }}
.cpts {{ color:var(--dim); font-variant-numeric:tabular-nums }}
section {{ margin-top:46px }}
.kick {{ font-size:12px; text-transform:uppercase; letter-spacing:.16em; font-weight:700; color:var(--acc) }}
h2 {{ font-size:26px; font-weight:800; letter-spacing:-.015em; margin:.2em 0 .25em; text-wrap:balance }}
.note {{ color:var(--dim); font-size:14px; margin:0 0 14px; max-width:75ch }}
.tblwrap {{ background:var(--card); border:1px solid var(--line); border-radius:14px; overflow-x:auto }}
table {{ border-collapse:collapse; width:100%; font-size:15px }}
th {{ font-size:11px; text-transform:uppercase; letter-spacing:.1em; color:var(--dim); font-weight:700;
  text-align:left; padding:12px 12px 9px; border-bottom:1px solid var(--line); white-space:nowrap }}
td {{ padding:9px 12px; border-bottom:1px solid var(--line); white-space:nowrap }}
tr:last-child td {{ border-bottom:0 }}
tr:first-child td {{ background:color-mix(in srgb, var(--gold) 9%, transparent) }}
.plain tr:first-child td {{ background:none }}
.plain tr:last-child td {{ background:color-mix(in srgb, var(--acc) 8%, transparent) }}
.num {{ text-align:right; font-variant-numeric:tabular-nums }}
.rk {{ width:2.2em; text-align:center; font-variant-numeric:tabular-nums; color:var(--dim) }}
.b {{ font-weight:800 }}
.dim {{ color:var(--dim) }}
.pl {{ font-weight:600 }}
.best {{ font-size:13px; color:var(--dim) }}
.dot {{ display:inline-block; width:9px; height:9px; border-radius:99px; margin-right:8px; vertical-align:1px }}
.pos {{ color:var(--pos); font-weight:700 }} .neg {{ color:var(--neg); font-weight:700 }}
.up {{ color:var(--pos); font-size:13px; font-weight:700 }} .dn {{ color:var(--neg); font-size:13px; font-weight:700 }}
.grid {{ stroke:var(--grid); stroke-width:1 }}
.rlab {{ font:700 11px system-ui; letter-spacing:.08em; text-transform:uppercase; fill:var(--dim) }}
.dnum {{ font:800 11px system-ui; fill:#fff; pointer-events:none }}
.dotc {{ stroke:var(--card); stroke-width:1.5 }}
svg {{ padding:6px 0 10px }}
.legend {{ display:flex; flex-wrap:wrap; gap:6px 16px; margin-top:10px; font-size:13px; color:var(--dim) }}
.lg {{ white-space:nowrap }}
.hm {{ min-width:3em; text-align:center }}
.cards {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:12px }}
.card {{ background:var(--card); border:1px solid var(--line); border-radius:14px; padding:16px 18px }}
.card h3 {{ margin:2px 0 6px; font-size:16px; font-weight:800 }}
.card p {{ margin:0; font-size:14px; color:var(--dim) }}
.card p b {{ color:var(--ink) }}
.ci {{ font-size:20px }}
.race {{ padding:14px 16px 16px }}
.rc-head {{ display:flex; align-items:center; gap:12px; margin-bottom:14px; flex-wrap:wrap }}
#rc-play {{ background:var(--acc); color:#fff; border:0; border-radius:8px; padding:7px 14px;
  font:700 14px system-ui; cursor:pointer }}
#rc-play:focus-visible, #rc-slider:focus-visible {{ outline:2px solid var(--acc); outline-offset:2px }}
#rc-slider {{ flex:1; min-width:120px; accent-color:var(--acc) }}
.rc-day {{ font-variant-numeric:tabular-nums; font-weight:700; font-size:14px; color:var(--dim); white-space:nowrap }}
.rc-bars {{ position:relative }}
.rc-row {{ position:absolute; left:0; right:0; height:38px; display:flex; align-items:center; gap:10px;
  transition:transform .7s ease }}
.rc-name {{ width:150px; flex-shrink:0; font-size:13px; font-weight:600; text-align:right;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis }}
.rc-track {{ flex:1; height:22px; border-radius:6px; background:color-mix(in srgb, var(--line) 45%, transparent) }}
.rc-bar {{ height:100%; border-radius:6px; width:0; transition:width .7s ease; min-width:2px }}
.rc-pts {{ width:2.6em; flex-shrink:0; font-variant-numeric:tabular-nums; font-weight:800; font-size:14px }}
@media (max-width:520px) {{ .rc-name {{ width:104px; font-size:11px }} }}
@media (prefers-reduced-motion: reduce) {{ .rc-row, .rc-bar {{ transition:none }} }}
footer {{ margin-top:52px; padding-top:18px; border-top:1px solid var(--line); color:var(--dim); font-size:13px; max-width:75ch }}
@media (prefers-reduced-motion: no-preference) {{
  section, .champ {{ animation:in .5s ease both }}
  @keyframes in {{ from {{ opacity:0; transform:translateY(6px) }} to {{ opacity:1; transform:none }} }}
}}
</style>
<div class="wrap">
<header>
  <div class="eyebrow">Kickoff · Чемпіонат світу 2026</div>
  <h1>Фінальний звіт турніру</h1>
  <p class="sub">Вісім гравців, {d['n_matches']} матчі прогнозів, чотири системи підрахунку — і три різні чемпіони.
  Один турнір, а погляньте, як по-різному можна виграти.</p>
  <div class="pill">🏁 Турнір завершено · фінал: Spain 0:0 Argentina (за 90 хвилин) · 11.06 – 19.07.2026</div>
</header>

<div class="podium">{podium_html}</div>

{section('official', 'Система 1 · чинні правила', 'Офіційна таблиця',
  'Точний рахунок — 4 бали (3 за рахунок + 1 за результат), правильний результат — 1 бал.', t_official)}

{section('maybe', 'Система 2 · чисті бали, без кф', 'Таблиця «Майже»',
  'Та сама гра, але близькі промахи теж чогось варті. Кожен прогноз оцінюється двома частинами. '
  'За рахунок: вгадав точно — 3, помилився лише на один гол (ставив 2:1, а було 1:1 чи 2:0) — 2. '
  'За результат: вгадав переможця чи нічию — 1; не вгадав, але різниця голів розійшлась лише на гол — 0.5. '
  'Разом: точний рахунок 4 · «майже» з правильним результатом 3 · просто «майже» 2.5 · '
  'лише результат 1. При рівності виграє той, у кого більше «майже».', t_maybe)}

{section('value', 'Система 3 · зважено на коефіцієнти', 'Таблиця цінності',
  f'Вгаданий результат = 1 × кф результату (відкриття), вгаданий точний = ще +3 × кф точного рахунку. '
  f'Сміливість окупається: сенсаційний прогноз важить більше за очевидний. Кф Sbobet, {d["n_odds"]} матчів.', t_value)}

{section('money', 'Система 4 · якби ставили гроші', 'Таблиця доходу',
  'По 10 у.о. на результат і 10 у.о. на точний рахунок у кожному матчі (кф відкриття). '
  'Виграш = 10×кф − 10, програш = −10. ★ — найкращий у колонці.', t_money)}

{section('dynamics', 'Хід турніру', 'Динаміка позицій',
  'Місце в офіційній таблиці після кожного туру. При рівності балів місця розводяться за '
  'тайбрейкерами: правильні результати → точні рахунки → кількість прогнозів.', bump_html)}

{section('race', 'Хід турніру', 'Перегони по днях',
  f'Накопичені бали після кожного з {d["n_days"]} ігрових днів. Натисніть «Грати» або тягніть повзунок.', race_html)}

{section('days', 'Хід турніру', 'Дні на місцях',
  f'Скільки ігрових днів (із {d["n_days"]}) кожен гравець завершував на кожній позиції.', t_days)}

{section('favs', 'Поза таблицями', 'Улюблені рахунки',
  'Топ-3 рахунки, які кожен ставив найчастіше, — і топ-3 рахунки, якими турнір відповідав.', t_fav)}

{section('fun', 'Поза таблицями', 'Цікавинки турніру', '', f'<div class="cards">{cards_html}</div>')}

<footer>
  Дані: Kickoff (прогнози і результати за 90 хвилин основного часу) + коефіцієнти Sbobet (лінія відкриття).
  Дякуємо всім за турнір — до зустрічі в Лізі чемпіонів! ⚽
</footer>
</div>
'''
open(f'{BASE}/wc2026_final_report.html', 'w').write(page)

# Версія для додатку: плаваюча кнопка «Назад» (повернення з повноекранного
# перегляду на мобільному/PWA — інакше з статичної сторінки нема шляху назад)
TOURNAMENT_URL = '/tournaments/c4da2f76-0013-4e09-8863-dccd900864aa?tab=report'
back_btn = f'''<a href="{TOURNAMENT_URL}"
  onclick="if(history.length>1){{history.back();return false}}"
  style="position:fixed;top:12px;right:14px;z-index:99;display:inline-flex;align-items:center;gap:6px;
  background:var(--card);border:1px solid var(--line);color:var(--ink);border-radius:999px;
  padding:7px 14px;font:600 13px system-ui;text-decoration:none;box-shadow:0 2px 10px rgba(0,0,0,.15)">← Назад</a>
'''
app_page = page.replace('<div class="wrap">', back_btn + '<div class="wrap">', 1)
open(f'{BASE}/wc2026_final_report_app.html', 'w').write(app_page)
print('OK', len(page), 'chars (+app variant)')
