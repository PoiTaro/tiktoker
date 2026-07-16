# HyperFrames 無印良品風動画 テンプレート化システム 利用ガイド

本システムは、**シンプルなJSON設定ファイル (`video_config.json`) を書き換えてコマンドを1行実行するだけ**で、全自動でナレーションを合成し、タイミングを精密計算し、リンターで品質保証された縦長紹介動画（無印良品スタイル）を即座に生成・レンダリングするオートメーションツールです。

---

## 🌟 クイックスタート

### 1. 設定ファイルの編集 (`video_config.json`)
好きなエディタで `video_config.json` を開いて、動画のタイトル、テキスト、ナレーション内容などを変更します。

```json
{
  "title": "新商品ご紹介 - MUJI Style",
  "brand": "Antigravity",
  "headerTag": "プロダクト紹介",
  "speakerId": 13,
  "scenes": [
    {
      "id": "scene1",
      "type": "title",
      "mainLogo": "新体験のツール",
      "tagline": "思考をシンプルに整える。",
      "narration": "思考をシンプルに整える。新体験のツール。"
    },
    {
      "id": "scene2",
      "type": "feature",
      "num": "その壱",
      "title": "無駄のない、<br />美しい機能。",
      "subtitle": "複雑さを排したデザイン。<br />直感的に操作できる心地よさを追求しました。",
      "narration": "無駄のない美しい機能。直感的に操作できる心地よさを追求しました。"
    }
  ],
  "outputVideo": "my_new_video.mp4"
}
```

### 2. コマンド一発で動画生成＆レンダリング！
ターミナルを開いて以下のコマンドを実行します。

```bash
# 音声合成・HTML自動生成・品質チェック・動画レンダリングを全て自動実行
npm run build-video -- --render
```

あるいは、設定ファイルやプレビューだけまず確認したい場合：
```bash
# 音声合成とHTML生成、品質チェックのみ行う
npm run build-video

# プレビューサーバーで動作確認する
npm run dev
```

別の設定ファイル（例: `my_project.json`）を指定する場合：
```bash
node generate_video.mjs --config my_project.json --render
```

---

## ⚙️ 自動化システムの仕組みと強み

### 1. ナレーション語頭切れ防止の「ダブルバッファ同期エンジン」
- **先頭無音自動付与 (`leadSilenceSeconds: 0.55`)**:
  VOICEVOX 音声合成時に `prePhonemeLength = 0.55` を全自動適用し、WAVファイルの先頭に必ず `0.55秒` の静寂バッファを持たせます。
- **ミリ秒精度の実時間測定＆先行起動タイムライン**:
  Node.js 内部の高速 RIFF 解析により、生成された WAV ファイルの実測秒数を正確に取得。
  各シーンが切り替わるとき、ナレーションの `<audio>` トラックは文字が登場する **0.55秒前** から先行スタートし、初期化のラグやデコード遅延を完全に吸収します。
  そして音声がまさに立ち上がる **0.55秒後** に、文字のフェードインがピタッと同期して現れます！

### 2. 厳格な品質リンター (`npm run check`) の自動パス機能
- GSAP アニメーションの終了時刻とクリップ境界をミリ秒単位で自動計算。
- 各シーンの終わりには自動的に `tl.set("#sceneN .anim-item", { opacity: 0 }, hardKillTime)` を組み込み、非線形シーク時のゴースト表示を防ぐリンターチェック (`gsap_exit_missing_hard_kill`) を 0 error でクリアします。

### 3. VOICEVOX エンジンの自動ライフサイクル管理
- スクリプト実行時、ローカルの VOICEVOX エンジン (`http://127.0.0.1:50021`) が動いているか自動確認します。
- 動いていない場合は、自動的に `run.exe` をバックグラウンド起動し、動画生成が完了したら綺麗に自動終了させるため、事前の手動起動の手間すら必要ありません。

---

## 📋 シーンタイプ (`type`) の種類

`video_config.json` の `scenes` 配列では、以下のタイプを指定して自由な構成を作成できます。

| `type` | 用途 | 主なプロパティ |
| :--- | :--- | :--- |
| **`title`** | 動画冒頭のタイトルカード | `mainLogo`, `tagline`, `narration` |
| **`feature`** | 特徴・機能・メッセージの紹介 | `num` (その壱など), `numClass` (`green`で緑アクセント), `title`, `subtitle`, `narration` |
| **`epilogue`** | エピローグ・締めのメッセージ | `title`, `subtitle`, `narration` |
