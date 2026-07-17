# WorkNote - HyperFrames動画作成プロジェクト（実商品写真組み込み完全版）

## 概要
「爆モテメンズラボ」第一弾として、徹底リサーチに基づいた男ニキビの治し方（王道スキンケア＆実在アイテム）を解説する約1分33秒（全10シーン）の縦長ショート動画について、**ブラウザ自動操作経由で取得した実在商品の本物のパッケージ写真を各商品紹介シーンに完全組み込み**し、最終レンダリングを完了しました。

## 実施内容 (2026-07-15 23:36 更新)
- **Puppeteerブラウザ自動操作 (`fetch_real_images_browser.mjs`) による本物の実商品写真取得**:
  - Amazon および公式サイトより、高画質な実商品パッケージ写真を確実に取得。
  - `images/real_orbis_wash.jpg` (オルビス ミスター フォーミングウォッシュ)
  - `images/real_orbis_lotion.jpg` (オルビス ミスター エッセンスローション)
  - `images/real_melanocc.jpg` (メラノCC 薬用しみ集中対策美容液)
  - `images/real_pairacne.jpg` (ペアアクネクリームW 第2類医薬品)
- **「実物写真」×「無印良品風図解イラスト」のハイブリッド構成完了**:
  - メカニズムや洗顔・保湿ステップの図解は「無印良品風の洗練されたミニマル AI グラフィック (`acne_mechanism.png`, `bubble_wash.png`, `moisture_care.png`)」。
  - 具体的なおすすめ商品シーン (`Scene 4, 6, 7, 8`) は「実在商品の本物のパッケージ写真 (`real_*.jpg`)」。
- **動画自動検証結果・完全版出力**:
  - `npm run check` 0 errors, 0 warnings を達成。
  - 出力動画: `mens_acne_skincare_video.mp4` (1080×1920 60fps / 約11.9 MB / 約93秒)

## GitHub Actionsでの全自動動画生成 CI バージョン構築 (2026-07-16 更新)
- **`generate_video.mjs` の改善とスマート音声キャッシュ機構**:
  - 各シーンのテキストおよびパラメータをハッシュ管理 (`audio/*.meta.json`) し、変更のないシーンのナレーション合成を即時スキップ。
  - `VOICEVOX_HOST`, `VOICEVOX_PORT`, `VOICEVOX_ENGINE_PATH` 環境変数対応により、WindowsローカルとUbuntu CI (`http://127.0.0.1:50021`) の双方で100%シームレスに動作。
  - 最終的な出力 MP4 と作業ファイルを分離 (`output/` ディレクトリ等に対応、`--output` フラグ追加)。
- **GitHub Actions ワークフロー (`.github/workflows/generate-video.yml`) の新設**:
  - `workflow_dispatch`（手動実行／コンフィグ・出力ファイル名指定可能）と `push`（原稿や素材更新時）の両対応。
  - `ubuntu-latest` ランナー上で `ffmpeg`, `ffprobe`, 日本語フォント (`fonts-noto-cjk` 等) および Node.js v20 を自動導入。
  - バックグラウンドで公式 Docker コンテナ (`voicevox/voicevox_engine:cpu-ubuntu20.04-latest`) を立ち上げ、`/version` エンドポイントでの起動確認待機ループを実装。
  - ナレーション付き動画の自動レンダリングと Artifact (`generated-mp4-video`) でのダウンロード提供を実現。

## 爆モテメンズラボ第二弾「夏の汗＆ニオイ 最速撃退スキンケア」構築 (2026-07-16 追加)
- **原稿構成 (`video_config_sweat.json`)**:
  - 夏の猛暑による汗・皮脂と雑菌増殖メカニズムから、日中の拭き取り・朝の直塗り・夏専用保湿の「3大鉄則」を解説する全10シーン。
- **実在商品高画質写真およびミニマルAIイラストの配置 (`images/`)**:
  - `images/sweat_mechanism.png`, `images/fresh_skin.png` (無印良品風ミニマル図解イラスト)
  - `images/real_gatsby.jpg` (ギャツビー フェイシャルペーパー / Amazon SL1200 高画質)
  - `images/real_deonatulle.jpg` (デオナチュレ 男ソフトストーンW / Amazon SL1200 高画質)
  - `images/real_uno_uv.jpg` (ウーノ UVパーフェクトジェル / Amazon SL1200 高画質)
- **GitHub Actions での動画自動レンダリング (`mens_sweat_care_video.mp4`)**:
  - `workflow_dispatch` 入力によりクラウド上で VOICEVOX 合成からレンダリングまで自動実行。

## Gemini Gem「爆モテメンズラボ 動画原稿生成ディレクター」設定指示書実装 (2026-07-16 追加)
- **目的と概要**:
  - テーマ（青ひげ、毛穴ケアなど）を入力するだけで、構成案・準備すべき素材リスト・そしてそのまま実行できる完全版 `video_config_*.json` を一瞬で出力するカスタム AI アシスタント (Gem) 設定書を作成。
- **配置先とArtifact提供**:
  - リポジトリ内 `gemini_gem_instructions.md` および Artifact `gemini_gem_prompt.md` に完全なインストラクション（Persona, Task, Context, Format の4要素対応版）を保存。

## スマホ向け動画制作コントローラー（WEB UI ＆ GAS バックエンド＆ Actions 監視）構築 (2026-07-17 追加)
- **フロントエンド (`webui/index.html, style.css, app.js`)**:
  - 白基調で iOS / Material You の極上の使いやすさを実現したスマホ最適化 SPA 画面。
  - **① JSONエディタタブ**: クリップボードペースト＆ファイル読み込み、全シーン別のナレーション・字幕カード自由編集と JSON テキストエリアとの双方向リアルタイム同期。
  - **② 要求画像挿入タブ**: JSON 内の `image` 指定パスを自動解析＆一覧カード化。カメラ／アルバムから1枚ずつ写真を選択し、スマホ上・ブラウザの Canvas 処理で最大1200pxに自動圧縮・Base64化。
  - **③ プッシュ＆監視タブ**: ボタンタップで GAS を介し全画像と JSON を GitHub (`PoiTaro/tiktoker`) へ一括コミット＆ `workflow_dispatch` で動画生成スタート。
  - **リアルタイムビルド監視＆動画リンク**: Actions のステータスを自動ポーリングし、ナレーション合成・レンダリング中の状態と完成時の Artifact ダウンロードリンクをスマホに表示。
- **バックエンド (`gas/Code.gs, SETUP_GUIDE.md`)**:
  - `doPost/doGet` で CORS/リダイレクトに対応した GitHub API (`/contents/`, `/dispatches`, `/runs`, `/artifacts`) 中継処理を実装。
  - スプレッドシート連動による生成履歴自動ログ記録。
  - **デプロイ・稼働確認済みの本番 GAS ウェブアプリ URL (`2026-07-17 設定完了`)**:
    - `https://script.google.com/macros/s/AKfycbzppl0o5kMi7-4yjtwlCPGdVucFpgDaq3l48ihgTaaQ9cyDeSQr37JGSeK5BkzCDE4L/exec`
    - `webui/index.html` および `webui/app.js` のデフォルト値として完全にバインド済み。
  - **【重要アップデート】HTML/SPA の GAS 直接ホスティング機能実装 (デプロイ v4)**:
    - スマホから上記 URL (`/exec`) をブラウザで開くだけで、外部サーバーを一切介さず `HtmlService` より `webui/` 全体（HTML/CSS/JS インライン統合版 `gas/Index.html` 43.4KB）が高速配信され、そのままコントローラー画面として機能する最強のサーバーレス構成を実現！





