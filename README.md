# 🐄 和牛ダービー

みんなで予想して、連打で応援する、パーティー向けの競牛ゲームです。

## 遊び方
1. 参加者の名前を追加し、それぞれ勝つと思う牛（1〜6番）を選ぶ
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

6頭立てで、みかわ牛の勝率は **約33%**（他は各13%前後、平等なら16.7%）。
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
