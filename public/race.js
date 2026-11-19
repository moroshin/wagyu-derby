// 和牛ダービー — レースのシミュレーション（ブラウザでも Node でも動く）
(function (root) {
  'use strict';

  // 推し牛。毎レース必ず出走し、「ちょっとだけ」有利（base / grassRate / dashRate / 末脚）。
  const MIKAWA = { id: 'mikawa', brand: 'みかわ牛', origin: '愛知県', color: '#e60033',
    base: 1.008, grassRate: 0.7, dashRate: 1.2, star: true, intro: '愛知県・三河の黒毛和牛。今日の本命！' };

  // 出走候補（実在のブランド牛 + 交雑牛）。毎レースここからランダムに選ぶ。
  const POOL = [
    ['shiraoi', '白老牛', '北海道'], ['biratori', 'びらとり和牛', '北海道'],
    ['akita', '秋田牛', '秋田県'], ['maesawa', '前沢牛', '岩手県'], ['tankaku', 'いわて短角和牛', '岩手県'],
    ['sendai', '仙台牛', '宮城県'], ['yonezawa', '米沢牛', '山形県'], ['yamagata', '山形牛', '山形県'],
    ['hitachi', '常陸牛', '茨城県'], ['murakami', '村上牛', '新潟県'],
    ['noto', '能登牛', '石川県'], ['wakasa', '若狭牛', '福井県'],
    ['hida', '飛騨牛', '岐阜県'], ['matsusaka', '松阪牛', '三重県'], ['iga', '伊賀牛', '三重県'],
    ['omi', '近江牛', '滋賀県'], ['kyoto', '京都肉', '京都府'],
    ['kobe', '神戸ビーフ', '兵庫県'], ['tajima', '但馬牛', '兵庫県'], ['sanda', '三田牛', '兵庫県'], ['awaji', '淡路ビーフ', '兵庫県'],
    ['kumano', '熊野牛', '和歌山県'], ['chiya', '千屋牛', '岡山県'],
    ['olive', 'オリーブ牛', '香川県'], ['awa', '阿波牛', '徳島県'], ['tosa', '土佐あかうし', '高知県'],
    ['hakata', '博多和牛', '福岡県'], ['saga', '佐賀牛', '佐賀県'], ['imari', '伊万里牛', '佐賀県'],
    ['nagasaki', '長崎和牛', '長崎県'], ['iki', '壱岐牛', '長崎県'], ['bungo', '豊後牛', '大分県'],
    ['kumaaka', 'くまもとあか牛', '熊本県'], ['miyazaki', '宮崎牛', '宮崎県'], ['ozaki', '尾崎牛', '宮崎県'],
    ['kagoshima', '鹿児島黒牛', '鹿児島県'], ['ishigaki', '石垣牛', '沖縄県'], ['motobu', 'もとぶ牛', '沖縄県'],
    ['kozatsu', '交雑牛', '国産'],
  ].map(([id, brand, origin]) => ({ id, brand, origin }));

  // レースごとに付くキャラ（ゲーム上の性格づけ。実際の品質とは関係なし）
  const TRAITS = [
    'スタートダッシュが得意。', '終盤の追い込みに注目。', '気分屋で読めない一頭。', '道草ぐせがちょっと心配。',
    '大声援で燃えるタイプ。', '今日は落ち着いている。', 'パドックで鼻息が荒い。', '大穴の香りがする。',
    '観客にサービス精神旺盛。', 'マイペースに走る。', '連打されると本気を出す。', '今日はやる気満々！',
  ];
  const LANE_COLORS = ['#333333', '#1f5fa8', '#c46a2b', '#6a4c93', '#2f8f4e', '#8b8b3a', '#0e8a8a', '#b0306f'];
  const FIELD_SIZE = 7;

  // 今レースの出走表（中身はレースごとに差し替え、参照は同じ配列のまま）
  const COWS = [];
  let lastIds = [];

  function shuffle(arr, rand) {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }

  // みかわ牛 + 候補からランダムに6頭。前のレースに出た牛はなるべく外す。枠順もランダム。
  function drawField(rand) {
    rand = rand || Math.random;
    const fresh = shuffle(POOL.filter((c) => !lastIds.includes(c.id)), rand);
    const used = shuffle(POOL.filter((c) => lastIds.includes(c.id)), rand);
    const others = fresh.concat(used).slice(0, FIELD_SIZE - 1);
    lastIds = others.map((c) => c.id);
    const traits = shuffle(TRAITS.slice(), rand);
    const colors = shuffle(LANE_COLORS.slice(), rand);
    const field = shuffle([MIKAWA].concat(others), rand).map((c, i) => c.star ? Object.assign({}, c) : Object.assign({
      color: colors[i], base: 1.0, grassRate: 1, dashRate: 1,
      intro: `${c.origin}の${c.id === 'kozatsu' ? '交雑種' : 'ブランド牛'}。${traits[i]}`,
    }, c));
    COWS.length = 0;
    field.forEach((c) => COWS.push(c));
    return COWS;
  }
  drawField(mulberry32(1));

  const TRACK = 1000;           // ゴールまでの距離
  const BASE_SPEED = 52;        // 単位/秒 → だいたい 19〜20 秒で決着

  const CONDITIONS = [
    { label: '絶好調', mod: 1.03 },
    { label: '好調',   mod: 1.015 },
    { label: '普通',   mod: 1.0 },
    { label: 'ねむい', mod: 0.985 },
  ];

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // レースごとの調子を決める。みかわ牛は「ねむい」になりにくい。
  function rollConditions(rand) {
    return COWS.map((c) => {
      let r = rand();
      if (c.star) r *= 0.8;
      const idx = r < 0.2 ? 0 : r < 0.45 ? 1 : r < 0.8 ? 2 : 3;
      return CONDITIONS[idx];
    });
  }

  function createRace(conditions, rand) {
    return {
      t: 0,
      finished: [],
      runners: COWS.map((c, i) => ({
        cow: c,
        idx: i,
        cond: conditions[i],
        pos: 0,
        speed: 0,
        state: 'run',      // run | dash | grass | moo
        stateTime: 0,
        cheer: 0,          // 応援ブースト（0〜1）
        finishTime: null,
        wobble: rand() * 10,
      })),
    };
  }

  // dt 秒進める。発生したイベントを配列で返す（実況用）
  function step(race, dt, rand) {
    const events = [];
    race.t += dt;
    for (const r of race.runners) {
      if (r.finishTime !== null) continue;
      const c = r.cow;

      if (r.stateTime > 0) {
        r.stateTime -= dt;
        if (r.stateTime <= 0) r.state = 'run';
      } else if (race.t > 1.2) {
        const p = rand();
        const grassP = 0.05 * c.grassRate * dt;
        const dashP = 0.09 * c.dashRate * dt;
        if (p < grassP) {
          r.state = 'grass'; r.stateTime = 0.7 + rand() * 0.6;
          events.push({ type: 'grass', r });
        } else if (p < grassP + dashP) {
          r.state = 'dash'; r.stateTime = 0.9 + rand() * 0.7;
          events.push({ type: 'dash', r });
        } else if (p < grassP + dashP + 0.03 * dt) {
          r.state = 'moo'; r.stateTime = 0.5;
          events.push({ type: 'moo', r });
        }
      }

      let mult = 1;
      if (r.state === 'dash') mult = 1.55;
      else if (r.state === 'grass') mult = 0.15;
      else if (r.state === 'moo') mult = 0.75;

      // 終盤の末脚（みかわ牛はちょっと強い）
      const progress = r.pos / TRACK;
      if (progress > 0.75) mult *= c.star ? 1.015 : 1.0;

      const noise = 0.92 + 0.16 * (0.5 + 0.5 * Math.sin(race.t * 1.7 + r.wobble)) + (rand() - 0.5) * 0.12;
      const target = BASE_SPEED * c.base * r.cond.mod * mult * noise * (1 + r.cheer * 0.06);
      r.speed += (target - r.speed) * Math.min(1, dt * 4);
      r.pos += r.speed * dt;
      r.cheer = Math.max(0, r.cheer - dt * 1.5);

      if (r.pos >= TRACK) {
        r.pos = TRACK;
        r.finishTime = race.t;
        race.finished.push(r);
        events.push({ type: 'finish', r, place: race.finished.length });
      }
    }
    return events;
  }

  function ranking(race) {
    const done = race.finished.slice();
    const rest = race.runners.filter((r) => r.finishTime === null).sort((a, b) => b.pos - a.pos);
    return done.concat(rest);
  }

  // 調子込みで勝率を見積もってオッズにする（控除率 20%）
  function estimateOdds(conditions, trials) {
    const wins = new Array(COWS.length).fill(0);
    const rand = mulberry32(12345);
    for (let k = 0; k < trials; k++) {
      const race = createRace(conditions, rand);
      while (race.finished.length === 0) step(race, 1 / 15, rand);
      wins[race.finished[0].idx]++;
    }
    return wins.map((w) => {
      const p = (w + 1) / (trials + COWS.length);
      return Math.max(1.1, Math.round((0.8 / p) * 10) / 10);
    });
  }

  root.WagyuRace = { COWS, POOL, drawField, TRACK, CONDITIONS, mulberry32, rollConditions, createRace, step, ranking, estimateOdds };
  if (typeof module !== 'undefined') module.exports = root.WagyuRace;
})(typeof window !== 'undefined' ? window : globalThis);
