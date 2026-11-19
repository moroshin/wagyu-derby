// 和牛ダービー — レースのシミュレーション（ブラウザでも Node でも動く）
(function (root) {
  'use strict';

  // 出走牛。みかわ牛は「ちょっとだけ」有利（base と grassRate で調整）。
  const COWS = [
    { id: 'mikawa',  brand: 'みかわ牛', name: 'ミカワノヒカリ', color: '#e60033', base: 1.008, grassRate: 0.7, dashRate: 1.2, star: true,
      intro: '愛知・三河の誇り。きめ細かいサシと末脚が武器！' },
    { id: 'kuro',    brand: '黒毛和牛', name: 'クロゲノカゼ',   color: '#333333', base: 1.0, grassRate: 1, dashRate: 1,
      intro: '黒光りする馬体ならぬ牛体。安定感はピカイチ。' },
    { id: 'aka',     brand: 'あか牛',   name: 'アカベコダッシュ', color: '#c46a2b', base: 1.0, grassRate: 1, dashRate: 1,
      intro: 'スタートダッシュが得意。でも気分屋。' },
    { id: 'tanka',   brand: '短角牛',   name: 'タンカクファイター', color: '#8b5a2b', base: 1.0, grassRate: 1, dashRate: 1,
      intro: '山育ちのスタミナ自慢。坂に強い（坂はない）。' },
    { id: 'mukaku',  brand: '無角牛',   name: 'ツノナシジェット', color: '#5b6b7a', base: 1.0, grassRate: 1, dashRate: 1,
      intro: '角がないぶん空気抵抗が少ない…らしい。' },
    { id: 'wagyu',   brand: '交雑牛',   name: 'ハーフアンドハーフ', color: '#2f8f4e', base: 1.0, grassRate: 1, dashRate: 1,
      intro: 'いいとこ取りのハイブリッド。大穴の香り。' },
  ];

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

  root.WagyuRace = { COWS, TRACK, CONDITIONS, mulberry32, rollConditions, createRace, step, ranking, estimateOdds };
  if (typeof module !== 'undefined') module.exports = root.WagyuRace;
})(typeof window !== 'undefined' ? window : globalThis);
