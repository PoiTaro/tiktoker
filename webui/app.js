/**
 * 爆モテ動画制作コントローラー - フロントエンドロジック (app.js)
 * スマホで快適に操作できるSPA状態管理・双方向データ同期・自動リサイズ・GAS API通信を実行します。
 */

// アプリケーション状態管理
const state = {
  gasUrl: localStorage.getItem("bakumote_gas_url") || "",
  configData: null,          // パースされた原稿 JSON オブジェクト
  imageSlots: new Map(),     // 画像スロット情報 { "images/xxx.png": { scenes: [1, 2], base64: null } }
  pollingInterval: null      // Actions ステータス自動更新用タイマー
};

// DOM ロード時の初期化
document.addEventListener("DOMContentLoaded", () => {
  initUI();
  initEventListeners();
});

/**
 * UIと保存済み設定の初期設定
 */
function initUI() {
  if (state.gasUrl) {
    document.getElementById("input-gas-url").value = state.gasUrl;
  }
}

/**
 * イベントリスナーの登録
 */
function initEventListeners() {
  // ⚙️ GAS設定アコーディオン開閉
  const configCard = document.getElementById("config-card");
  document.getElementById("btn-toggle-config").addEventListener("click", () => {
    configCard.classList.toggle("hidden");
  });
  document.getElementById("btn-close-config").addEventListener("click", () => {
    configCard.classList.add("hidden");
  });

  // GAS URL 保存＆テスト接続
  document.getElementById("btn-save-config").addEventListener("click", async () => {
    const urlInput = document.getElementById("input-gas-url").value.trim();
    if (!urlInput) {
      showToast("GAS ウェブアプリの URL を入力してください");
      return;
    }
    localStorage.setItem("bakumote_gas_url", urlInput);
    state.gasUrl = urlInput;
    showToast("保存しました！テスト接続中...");

    try {
      // GET でテスト接続
      const res = await fetch(`${urlInput}?action=test`);
      const data = await res.json();
      if (data.status === "ok") {
        showToast("✓ GAS バックエンドに正常接続しました！");
        configCard.classList.add("hidden");
      } else {
        showToast("⚠️ 接続できましたが応答が正しくありません");
      }
    } catch (err) {
      showToast("❌ 接続エラー。URLをご確認ください");
    }
  });

  // タブ切り替え
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      
      btn.classList.add("active");
      const tabId = btn.getAttribute("data-tab");
      document.getElementById(tabId).classList.add("active");
    });
  });

  // クリップボードからペースト
  document.getElementById("btn-paste-clipboard").addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        document.getElementById("textarea-json-raw").value = text;
        showToast("クリップボードから貼り付けました！");
        parseAndRenderJson();
      }
    } catch (err) {
      showToast("⚠️ クリップボード読み取り権限が必要です。手動でペーストしてください。");
    }
  });

  // ファイルからJSON読み込み
  document.getElementById("input-json-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      document.getElementById("textarea-json-raw").value = event.target.result;
      showToast("JSON ファイルを読み込みました！");
      parseAndRenderJson();
    };
    reader.readAsText(file);
  });

  // JSON 解析ボタン
  document.getElementById("btn-parse-json").addEventListener("click", parseAndRenderJson);

  // プッシュ＆Actions起動ボタン
  document.getElementById("btn-push-trigger").addEventListener("click", pushAndTriggerWorkflow);

  // Actions ステータス確認ボタン
  document.getElementById("btn-check-status").addEventListener("click", () => {
    checkActionsStatus(true);
  });
}

/**
 * JSON 解析とエディタカード＆画像スロットの自動展開
 */
function parseAndRenderJson() {
  const rawText = document.getElementById("textarea-json-raw").value.trim();
  if (!rawText) {
    showToast("JSON データが入力されていません");
    return;
  }

  try {
    const data = JSON.parse(rawText);
    state.configData = data;

    // メタデータの反映
    document.getElementById("meta-title").value = data.title || "";
    if (data.outputVideo) {
      document.getElementById("meta-output-filename").value = data.outputVideo;
    }
    document.getElementById("meta-editor-area").style.display = "block";

    // シーンカードの生成
    renderScenesEditor(data.scenes || []);

    // 要求画像スロットの抽出と生成
    extractAndRenderImageSlots(data.scenes || []);

    // バッジ件数の更新
    document.getElementById("badge-scene-count").textContent = (data.scenes || []).length;
    document.getElementById("badge-img-count").textContent = state.imageSlots.size;

    showToast("✓ JSON を展開し画像スロットを抽出しました！");
  } catch (err) {
    showToast("❌ JSON の構文エラー: " + err.message);
  }
}

/**
 * シーン別エディタカードの描画と双方向イベント同期
 */
function renderScenesEditor(scenes) {
  const container = document.getElementById("scenes-editor-list");
  container.innerHTML = "";

  scenes.forEach((scene, index) => {
    const card = document.createElement("div");
    card.className = "card";

    // シーンヘッダー
    const header = document.createElement("div");
    header.className = "scene-header";
    header.innerHTML = `
      <span class="scene-badge">Scene ${index + 1}</span>
      <span class="scene-type">${scene.type || "standard"}</span>
    `;
    card.appendChild(header);

    // タイトル (改行を <br /> でやりとりするため調整)
    const titleGroup = document.createElement("div");
    titleGroup.className = "form-group";
    titleGroup.innerHTML = `
      <label class="form-label">画面タイトル (改行は &lt;br /&gt;)</label>
      <input type="text" class="form-input scene-input-title" value="${escapeHtml(scene.title || "")}">
    `;
    titleGroup.querySelector("input").addEventListener("input", (e) => {
      scene.title = e.target.value;
      syncJsonTextarea();
    });
    card.appendChild(titleGroup);

    // サブタイトル (あれば表示・編集)
    if (scene.subtitle !== undefined || scene.type === "standard" || scene.type === "feature") {
      const subGroup = document.createElement("div");
      subGroup.className = "form-group";
      subGroup.innerHTML = `
        <label class="form-label">サブタイトル (subtitle)</label>
        <input type="text" class="form-input scene-input-sub" value="${escapeHtml(scene.subtitle || "")}">
      `;
      subGroup.querySelector("input").addEventListener("input", (e) => {
        scene.subtitle = e.target.value;
        syncJsonTextarea();
      });
      card.appendChild(subGroup);
    }

    // ナレーション (VOICEVOX セリフ)
    const narGroup = document.createElement("div");
    narGroup.className = "form-group";
    narGroup.style.marginBottom = "0";
    narGroup.innerHTML = `
      <label class="form-label" style="color:var(--accent-primary);">🗣️ ナレーションセリフ (narration)</label>
      <textarea class="form-textarea scene-input-nar" style="min-height:75px;">${escapeHtml(scene.narration || "")}</textarea>
    `;
    narGroup.querySelector("textarea").addEventListener("input", (e) => {
      scene.narration = e.target.value;
      syncJsonTextarea();
    });
    card.appendChild(narGroup);

    container.appendChild(card);
  });
}

/**
 * 双方向同期：メタデータやシーン編集内容を JSON テキストエリアに戻す
 */
function syncJsonTextarea() {
  if (!state.configData) return;
  state.configData.title = document.getElementById("meta-title").value;
  document.getElementById("textarea-json-raw").value = JSON.stringify(state.configData, null, 2);
}

/**
 * 要求画像ファイル名の自動抽出＆スロットカードの生成
 */
function extractAndRenderImageSlots(scenes) {
  state.imageSlots.clear();

  // シーンごとに image を抽出
  scenes.forEach((scene, idx) => {
    if (scene.image) {
      if (!state.imageSlots.has(scene.image)) {
        state.imageSlots.set(scene.image, {
          scenes: [idx + 1],
          base64: null
        });
      } else {
        state.imageSlots.get(scene.image).scenes.push(idx + 1);
      }
    }
  });

  const container = document.getElementById("images-slot-list");
  container.innerHTML = "";

  if (state.imageSlots.size === 0) {
    container.innerHTML = `<div class="card" style="text-align:center; padding:30px; color:var(--text-muted);">要求されている画像はありません。</div>`;
    return;
  }

  // スロットごとにカードを構築
  state.imageSlots.forEach((slotData, filename) => {
    const card = document.createElement("div");
    card.className = "card image-slot-card";

    const sceneNumList = slotData.scenes.map(n => `Scene ${n}`).join(", ");
    
    card.innerHTML = `
      <div class="slot-info">
        <span class="slot-filename">🖼️ ${filename}</span>
        <span class="slot-scenes">${sceneNumList}</span>
      </div>
      <label class="preview-area" id="preview-${filename.replace(/[^a-zA-Z0-9]/g, "_")}">
        <div class="preview-placeholder">
          <i>📷</i>
          <span>タップしてカメラ／写真から<br>このスロットに画像を割り当て</span>
        </div>
        <input type="file" accept="image/*" class="file-input-hidden slot-file-input" data-filename="${filename}">
      </label>
    `;

    // ファイル選択＆ Canvas 自動リサイズ・ Base64 圧縮のバインド
    const fileInput = card.querySelector(".slot-file-input");
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      processImageFile(file, filename, card.querySelector(".preview-area"));
    });

    container.appendChild(card);
  });
}

/**
 * スマホで選択した画像ファイルを引き受け、Canvas でリサイズして Base64 化
 */
function processImageFile(file, slotFilename, previewElement) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      // 最大幅・高さを設定してリサイズ (長辺最大 1200px)
      const maxDim = 1200;
      let w = img.width;
      let h = img.height;

      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);

      // JPEG/PNG のフォーマット判断と Base64 生成
      const isPng = slotFilename.toLowerCase().endsWith(".png");
      const mimeType = isPng ? "image/png" : "image/jpeg";
      const base64DataUrl = canvas.toDataURL(mimeType, isPng ? 0.95 : 0.88);

      // 状態とプレビュー表示を更新
      const slot = state.imageSlots.get(slotFilename);
      if (slot) {
        slot.base64 = base64DataUrl;
      }

      previewElement.innerHTML = `<img src="${base64DataUrl}" alt="${slotFilename}">`;
      showToast(`✓ ${slotFilename} を割り当てました！`);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

/**
 * GAS エンドポイントへ全画像＆ JSON を一括 POST し、 Actions を開始
 */
async function pushAndTriggerWorkflow() {
  if (!state.gasUrl) {
    showToast("⚠️ ⚙️ GAS バックエンド設定で URL を保存してください！");
    document.getElementById("config-card").classList.remove("hidden");
    return;
  }

  if (!state.configData) {
    showToast("⚠️ 先に JSON を展開してください");
    return;
  }

  // 同期して最新の JSON 文字列を取得
  syncJsonTextarea();
  const jsonString = document.getElementById("textarea-json-raw").value;
  const jsonFilename = document.getElementById("meta-json-filename").value || "video_config_custom.json";
  const outputFilename = document.getElementById("meta-output-filename").value || "output_custom.mp4";

  // セットされた画像リストを作成
  const uploadImages = [];
  state.imageSlots.forEach((slotData, filename) => {
    if (slotData.base64) {
      uploadImages.push({
        path: filename,
        base64: slotData.base64
      });
    }
  });

  const btn = document.getElementById("btn-push-trigger");
  const origText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `⏳ リポジトリにアップロード＆起動中... (${uploadImages.length}枚)`;

  try {
    const payload = {
      action: "pushAndTrigger",
      jsonFilename: jsonFilename,
      outputFilename: outputFilename,
      jsonContent: jsonString,
      images: uploadImages
    };

    // GAS (CORS) への POST リクエスト (redirect follow & text output)
    const response = await fetch(state.gasUrl, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    const resText = await response.text();
    let resData;
    try {
      resData = JSON.parse(resText);
    } catch (e) {
      throw new Error("GASからの応答を解析できませんでした: " + resText.substring(0, 80));
    }

    if (resData.success) {
      showToast("🚀 プッシュ＆動画生成ワークフローがスタートしました！");
      // ステータス監視タイマーをスタート
      startActionsPolling();
    } else {
      showToast("❌ プッシュエラー: " + (resData.error || "詳細不明"));
    }
  } catch (err) {
    showToast("❌ 通信エラー: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = origText;
  }
}

/**
 * GitHub Actions 状況の自動ポーリングと表示
 */
function startActionsPolling() {
  if (state.pollingInterval) {
    clearInterval(state.pollingInterval);
  }
  
  // 即時1回目チェック
  checkActionsStatus(false);

  // 4秒ごとに自動ポーリング
  state.pollingInterval = setInterval(() => {
    checkActionsStatus(false);
  }, 4000);
}

/**
 * Actions ステータスを GET して表示更新
 */
async function checkActionsStatus(showToastOnManual) {
  if (!state.gasUrl) {
    if (showToastOnManual) showToast("⚠️ GAS URL を設定してください");
    return;
  }

  try {
    const res = await fetch(`${state.gasUrl}?action=status`);
    const data = await res.json();

    if (!data.success) {
      if (showToastOnManual) showToast("❌ 状態取得失敗: " + (data.error || ""));
      return;
    }

    const latest = data.latestRun;
    if (!latest) {
      document.getElementById("status-badge").textContent = "実行履歴なし";
      document.getElementById("status-title").textContent = "ワークフローの実行履歴が見つかりません";
      return;
    }

    const badge = document.getElementById("status-badge");
    const title = document.getElementById("status-title");
    const meta = document.getElementById("status-meta");
    const artArea = document.getElementById("artifact-list-area");

    // バッジカラーとメッセージの設定
    badge.className = "status-badge";
    if (latest.status === "in_progress" || latest.status === "queued") {
      badge.classList.add("status-in-progress");
      badge.textContent = `⏳ ${latest.status === "queued" ? "待機中 (Queued)" : "ナレーション合成＆レンダリング中..."}`;
      title.textContent = latest.title;
      meta.textContent = `Run ID: ${latest.id} / 更新: ${new Date(latest.updated_at).toLocaleTimeString("ja-JP")}`;
    } else if (latest.status === "completed") {
      if (latest.conclusion === "success") {
        badge.classList.add("status-success");
        badge.textContent = "✓ 動画生成完了！ (Success)";
        title.textContent = latest.title;
        meta.textContent = `正常終了 / ${new Date(latest.updated_at).toLocaleTimeString("ja-JP")}`;
        
        // ポーリング終了
        if (state.pollingInterval) {
          clearInterval(state.pollingInterval);
          state.pollingInterval = null;
        }
      } else {
        badge.classList.add("status-failure");
        badge.textContent = `❌ 停止またはエラー (${latest.conclusion})`;
        title.textContent = latest.title;
        meta.textContent = `GitHub Actions でログをご確認ください`;
        if (state.pollingInterval) {
          clearInterval(state.pollingInterval);
          state.pollingInterval = null;
        }
      }
    }

    // Artifact ダウンロード情報の表示
    artArea.innerHTML = "";
    if (latest.artifacts && latest.artifacts.length > 0) {
      latest.artifacts.forEach(art => {
        const sizeMb = (art.size_in_bytes / (1024 * 1024)).toFixed(1);
        const a = document.createElement("a");
        a.className = "artifact-item";
        a.href = latest.html_url; // ログイン状態で Run ページからすぐダウンロード可能に
        a.target = "_blank";
        a.innerHTML = `
          <span>🎬 ${art.name} (${sizeMb} MB)</span>
          <span>📥 ダウンロード画面へ ➔</span>
        `;
        artArea.appendChild(a);
      });
    } else if (latest.status === "completed" && latest.conclusion === "success") {
      const a = document.createElement("a");
      a.className = "artifact-item";
      a.href = latest.html_url;
      a.target = "_blank";
      a.innerHTML = `
        <span>🎬 generated-mp4-video</span>
        <span>📥 Run ページを開く ➔</span>
      `;
      artArea.appendChild(a);
    }

    if (showToastOnManual) showToast("✓ ステータスを最新に更新しました");
  } catch (err) {
    if (showToastOnManual) showToast("❌ 確認エラー: " + err.message);
  }
}

/**
 * HTML エスケープユーティリティ
 */
function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * スマホ用フローティング・トースト通知表示
 */
function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}
