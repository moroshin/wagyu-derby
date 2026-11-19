# 🐄 和牛ダービー

みんなで予想して、連打で応援する、パーティー向けの競牛ゲームです。

## 遊び方
出走するのは実在の和牛ブランド（みかわ牛・松阪牛・神戸ビーフ・近江牛・米沢牛・飛騨牛）と交雑牛の7頭です。

1. 参加者の名前を追加し、それぞれ勝つと思う牛（1〜7番）を選ぶ
2. 「出走！」でレース開始。レース中は自分の牛のボタンを**連打で応援**（少しだけ速くなる）
3. 的中した人には「オッズ × 100」ポイント。通算ランキングで競う

1台のスマホ/PC/プロジェクターをみんなで囲んで遊ぶ想定です。ビルド不要の静的サイトです。

## みかわ牛はちょっと有利
`public/race.js` の `COWS` で調整しています。

| 項目 | みかわ牛 | 他の牛 |
|---|---|---|
| 基礎スピード `base` | 1.008 | 1.0 |
| 道草を食べる確率 `grassRate` | 0.7倍 | 1倍 |
| ダッシュ確率 `dashRate` | 1.2倍 | 1倍 |
| 終盤の末脚 | +1.5% | なし |
| 「ねむい」調子になる確率 | やや低い | 標準 |

7頭立てで、みかわ牛の勝率は **約28%**（他は各12%前後、平等なら14.3%）。
勝ちやすいけれど、負けることも普通にあるバランスです。

勝率の確認:
```bash
node -e 'const W=require("./public/race.js");let w=0,N=5000;for(let k=0;k<N;k++){const r=W.createRace(W.rollConditions(Math.random),Math.random);while(!r.finished.length)W.step(r,1/60,Math.random);w+=r.finished[0].cow.id==="mikawa"}console.log((100*w/N).toFixed(1)+"%")'
```

## ローカルで動かす
`public/index.html` をブラウザで開くだけ。

## Cloudflare にデプロイ
```bash
npx wrangler login
npx wrangler deploy
```
`https://wagyu-derby.<サブドメイン>.workers.dev` で公開されます。
GitHub Actions（`.github/workflows/deploy.yml`）でも自動デプロイできます。

## 共有
- 予想画面の「📣 友だちにも教える」：URLのコピー、LINE、X、スマホの共有メニュー
- 結果画面の「📣 結果をシェア」：「第◯レースは◯◯が優勝！的中：◯◯」という文とURLを共有
- SNSのプレビュー画像は `public/og.png`（1200×630）。`index.html` の `og:image` / `twitter:image` は絶対URLが必要なので、
  いまはGitHub上の画像を指しています。Cloudflareの公開URLが決まったらそちらに差し替えると確実です。
