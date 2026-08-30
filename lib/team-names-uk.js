/**
 * Українські назви команд для відображення.
 *
 * Навмисно НЕ перейменовуємо команди в базі:
 *   • sync-matches перезаписує home_team/away_team назвами з football-data.org,
 *     тож українські назви в БД затерлися б при першій же синхронізації;
 *   • live-scores зіставляє матчі з ESPN за англійськими назвами.
 * Тому база лишається англійською, а користувач бачить український варіант.
 *
 * Назви звірені зі стилем попередніх сезонів ЛЧ (там вони вже українською).
 * Невідома назва повертається без змін.
 */
const UK = {
  // ── Ліга чемпіонів 2026/27 ────────────────────────────────────────────────
  'Arsenal':           'Арсенал',
  'Aston Villa':       'Астон Вілла',
  'Atleti':            'Атлетіко',
  'Barça':             'Барселона',
  'Bayern':            'Баварія Мюнхен',
  'Bodø/Glimt':        'Буде/Глімт',
  'Club Brugge':       'Брюгге',
  'Como 1907':         'Комо',
  'Dortmund':          'Боруссія Д.',
  'Fenerbahçe':        'Фенербахче',
  'Feyenoord':         'Феєнорд',
  'Galatasaray':       'Галатасарай',
  'Inter':             'Інтер',
  'LASK':              'ЛАСК',
  'Lille':             'Лілль',
  'Liverpool':         'Ліверпуль',
  'Man City':          'Манчестер Сіті',
  'Man United':        'Манчестер Юнайтед',
  'Napoli':            'Наполі',
  'PAE AEK':           'АЕК',
  'PSG':               'ПСЖ',
  'PSV':               'ПСВ',
  'Porto':             'Порту',
  'RB Leipzig':        'РБ Лейпциг',
  'RC Lens':           'Ланс',
  'Real Betis':        'Бетіс',
  'Real Madrid':       'Реал Мадрид',
  'Roma':              'Рома',
  'Sabah FK':          'Сабах',
  'Shaktar':           'Шахтар Д.',
  'Sl. Bratislava':    'Слован Братислава',
  'Slavia Praha':      'Славія Прага',
  'Sporting CP':       'Спортінг',
  'Stuttgart':         'Штутгарт',
  'Viking':            'Вікінг',
  'Villarreal':        'Вільярреал',

  // ── Повні назви з football-data.org (на випадок, якщо синк принесе їх) ────
  'Arsenal FC':                   'Арсенал',
  'Aston Villa FC':               'Астон Вілла',
  'Club Atlético de Madrid':      'Атлетіко',
  'FC Barcelona':                 'Барселона',
  'FC Bayern München':            'Баварія Мюнхен',
  'FK Bodø/Glimt':                'Буде/Глімт',
  'Club Brugge KV':               'Брюгге',
  'Como 1907 S.r.l.':             'Комо',
  'Borussia Dortmund':            'Боруссія Д.',
  'Fenerbahçe SK':                'Фенербахче',
  'Feyenoord Rotterdam':          'Феєнорд',
  'Galatasaray SK':               'Галатасарай',
  'FC Internazionale Milano':     'Інтер',
  'LASK':                         'ЛАСК',
  'LOSC Lille':                   'Лілль',
  'Liverpool FC':                 'Ліверпуль',
  'Manchester City FC':           'Манчестер Сіті',
  'Manchester United FC':         'Манчестер Юнайтед',
  'SSC Napoli':                   'Наполі',
  'AEK Athens FC':                'АЕК',
  'Paris Saint-Germain FC':       'ПСЖ',
  'PSV':                          'ПСВ',
  'FC Porto':                     'Порту',
  'RB Leipzig':                   'РБ Лейпциг',
  'RC Lens':                      'Ланс',
  'Real Betis Balompié':          'Бетіс',
  'Real Madrid CF':               'Реал Мадрид',
  'AS Roma':                      'Рома',
  'FC Shakhtar Donetsk':          'Шахтар Д.',
  'ŠK Slovan Bratislava':         'Слован Братислава',
  'SK Slavia Praha':              'Славія Прага',
  'Sporting Clube de Portugal':   'Спортінг',
  'VfB Stuttgart':                'Штутгарт',
  'Viking FK':                    'Вікінг',
  'Villarreal CF':                'Вільярреал',
}

/** Українська назва команди; невідома повертається без змін. */
export function tn(name) {
  return UK[name] ?? name ?? ''
}

export default UK
