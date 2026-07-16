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
