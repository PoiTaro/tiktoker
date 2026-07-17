/**
 * 爆モテ動画制作コントローラー - フロントエンドロジック (app.js)
 * スマホで快適に操作できるSPA状態管理・双方向データ同期・自動リサイズ・GAS API通信を実行します。
 */

// グローバルエラーキャッチ＆画面表示（スマホでのトラブルシューティングを瞬時に解決）
window.addEventListener("error", (e) => {
  console.error("Global Error:", e.error || e.message);
  showToast("⚠️ 内部エラー: " + (e.message || "処理に失敗しました"));
});

// アプリケーション状態管理
const state = {
  gasUrl: localStorage.getItem("bakumote_gas_url") || "https://script.google.com/macros/s/AKfycbzppl0o5kMi7-4yjtwlCPGdVucFpgDaq3l48ihgTaaQ9cyDeSQr37JGSeK5BkzCDE4L/exec",
  configData: null,          // パースされた原稿 JSON オブジェクト
  imageSlots: new Map(),     // 画像スロット情報 { "images/xxx.png": { scenes: [1, 2], base64: null } }
  pollingInterval: null      // Actions ステータス自動更新用タイマー
};

// DOM ロード時の初期化
document.addEventListener("DOMContentLoaded", () => {
  try {
    initUI();
    initEventListeners();
    console.log("✓ Controller initialized successfully");
  } catch (err) {
    console.error("Init Error:", err);
    showToast("⚠️ 初期化エラー: " + err.message);
  }
});

/**
 * UIと保存済み設定の初期設定
 */
function initUI() {
  const gasInput = document.getElementById("input-gas-url");
  if (gasInput && state.gasUrl) {
    gasInput.value = state.gasUrl;
  }
}

/**
 * 安全に要素へイベントリスナーを登録するヘルパー
 */
function safeAddListener(id, event, handler) {
  const elem = document.getElementById(id);
  if (elem) {
    elem.addEventListener(event, handler);
  } else {
    console.warn(`Element with id '${id}' not found for event '${event}'`);
  }
}

/**
 * イベントリスナーの登録
 */
function initEventListeners() {
  // ⚙️ GAS設定アコーディオン開閉
  const configCard = document.getElementById("config-card");
  safeAddListener("btn-toggle-config", "click", () => {
    if (configCard) configCard.classList.toggle("hidden");
  });
  safeAddListener("btn-close-config", "click", () => {
    if (configCard) configCard.classList.add("hidden");
  });

  // GAS URL 保存＆テスト接続
  safeAddListener("btn-save-config", "click", async () => {
    const urlInputElem = document.getElementById("input-gas-url");
    const urlInput = urlInputElem ? urlInputElem.value.trim() : "";
    if (!urlInput) {
      showToast("GAS ウェブアプリの URL を入力してください");
      return;
    }
    localStorage.setItem("bakumote_gas_url", urlInput);
    state.gasUrl = urlInput;
    showToast("保存しました！テスト接続中...");

    try {
      const res = await fetch(`${urlInput}?action=test`);
      const data = await res.json();
      if (data.status === "ok") {
        showToast("✓ GAS バックエンドに正常接続しました！");
        if (configCard) configCard.classList.add("hidden");
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
      const targetContent = document.getElementById(tabId);
      if (targetContent) targetContent.classList.add("active");
    });
  });

  // クリップボードからペースト
  safeAddListener("btn-paste-clipboard", "click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const textarea = document.getElementById("textarea-json-raw");
        if (textarea) textarea.value = text;
        showToast("📋 クリップボードから貼り付けました！解析中...");
        parseAndRenderJson();
      }
    } catch (err) {
      showToast("⚠️ クリップボード読み取り権限がありません。下の枠に指で直接貼り付けてください。");
    }
  });

  // ファイルからJSON読み込み
  safeAddListener("input-json-file", "change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const textarea = document.getElementById("textarea-json-raw");
      if (textarea) textarea.value = event.target.result;
      showToast("📁 JSON ファイルを読み込みました！解析中...");
      parseAndRenderJson();
    };
    reader.readAsText(file);
  });

  // JSON 解析ボタン
  safeAddListener("btn-parse-json", "click", () => {
    console.log("btn-parse-json clicked!");
    parseAndRenderJson();
  });

  // プッシュ＆Actions起動ボタン
  safeAddListener("btn-push-trigger", "click", pushAndTriggerWorkflow);

  // Actions ステータス確認ボタン
  safeAddListener("btn-check-status", "click", () => {
    checkActionsStatus(true);
  });
}

/**
 * JSON 解析とエディタカード＆画像スロットの自動展開
 */
function parseAndRenderJson() {
  const textarea = document.getElementById("textarea-json-raw");
  const rawText = textarea ? textarea.value.trim() : "";
  
  if (!rawText) {
    showToast("⚠️ JSON データが入力されていません。テキストを貼り付けてください。");
    return;
  }

  try {
    // 文字列内に余分な前後の文章がある場合でも {...} のJSONブロックを確実に自動抽出するスマートパーサー
    let jsonString = rawText;
    const firstBrace = rawText.indexOf('{');
    const lastBrace = rawText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonString = rawText.substring(firstBrace, lastBrace + 1);
    }

    const data = JSON.parse(jsonString);
    state.configData = data;

    // メタデータの反映
    const metaTitle = document.getElementById("meta-title");
    if (metaTitle) metaTitle.value = data.title || "";

    const metaOut = document.getElementById("meta-output-filename");
    if (metaOut && data.outputVideo) {
      metaOut.value = data.outputVideo;
    }

    const metaArea = document.getElementById("meta-editor-area");
    if (metaArea) metaArea.style.display = "block";

    // シーンカードの生成
    renderScenesEditor(data.scenes || []);

    // 要求画像スロットの抽出と生成
    extractAndRenderImageSlots(data.scenes || []);

    // バッジ件数の更新
    const badgeScene = document.getElementById("badge-scene-count");
    if (badgeScene) badgeScene.textContent = (data.scenes || []).length;

    const badgeImg = document.getElementById("badge-img-count");
    if (badgeImg) badgeImg.textContent = state.imageSlots.size;

    showToast("✓ JSONの解析とカード展開に成功しました！");
    
    // 画面を少しスクロールしてエディタカードを分かりやすく見せる
    if (metaArea) {
      metaArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } catch (err) {
    console.error("JSON Parse Error:", err);
    showToast("❌ JSON 構文エラー: " + err.message + "（構文やカンマをご確認ください）");
  }
}

/**
 * シーン別エディタカードの描画と双方向イベント同期
 */
function renderScenesEditor(scenes) {
  const container = document.getElementById("scenes-editor-list");
  if (!container) return;
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

    // タイトル
    const titleGroup = document.createElement("div");
    titleGroup.className = "form-group";
    titleGroup.innerHTML = `
      <label class="form-label">画面タイトル (改行は &lt;br /&gt;)</label>
      <input type="text" class="form-input scene-input-title" value="${escapeHtml(scene.title || "")}">
    `;
    const titleInput = titleGroup.querySelector("input");
    if (titleInput) {
      titleInput.addEventListener("input", (e) => {
        scene.title = e.target.value;
        syncJsonTextarea();
      });
    }
    card.appendChild(titleGroup);

    // サブタイトル (あれば表示・編集)
    if (scene.subtitle !== undefined || scene.type === "standard" || scene.type === "feature") {
      const subGroup = document.createElement("div");
      subGroup.className = "form-group";
      subGroup.innerHTML = `
        <label class="form-label">サブタイトル (subtitle)</label>
        <input type="text" class="form-input scene-input-sub" value="${escapeHtml(scene.subtitle || "")}">
      `;
      const subInput = subGroup.querySelector("input");
      if (subInput) {
        subInput.addEventListener("input", (e) => {
          scene.subtitle = e.target.value;
          syncJsonTextarea();
        });
      }
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
    const narTextarea = narGroup.querySelector("textarea");
    if (narTextarea) {
      narTextarea.addEventListener("input", (e) => {
        scene.narration = e.target.value;
        syncJsonTextarea();
      });
    }
    card.appendChild(narGroup);

    container.appendChild(card);
  });
}

/**
 * 双方向同期：メタデータやシーン編集内容を JSON テキストエリアに戻す
 */
function syncJsonTextarea() {
  if (!state.configData) return;
  const metaTitle = document.getElementById("meta-title");
  if (metaTitle) state.configData.title = metaTitle.value;
  
  const textarea = document.getElementById("textarea-json-raw");
  if (textarea) textarea.value = JSON.stringify(state.configData, null, 2);
}

/**
 * 要求画像ファイル名の自動抽出＆スロットカードの生成
 */
function extractAndRenderImageSlots(scenes) {
  state.imageSlots.clear();

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
  if (!container) return;
  container.innerHTML = "";

  if (state.imageSlots.size === 0) {
    container.innerHTML = `<div class="card" style="text-align:center; padding:30px; color:var(--text-muted);">要求されている画像はありません。</div>`;
    return;
  }

  state.imageSlots.forEach((slotData, filename) => {
    const card = document.createElement("div");
    card.className = "card image-slot-card";

    const sceneNumList = slotData.scenes.map(n => `Scene ${n}`).join(", ");
    
    card.innerHTML = `
      <div class="slot-info">
        <span class="slot-filename">🖼️ ${escapeHtml(filename)}</span>
        <span class="slot-scenes">${sceneNumList}</span>
      </div>
      <label class="preview-area" id="preview-${filename.replace(/[^a-zA-Z0-9]/g, "_")}">
        <div class="preview-placeholder">
          <i>📷</i>
          <span>タップしてカメラ／写真から<br>このスロットに画像を割り当て</span>
        </div>
        <input type="file" accept="image/*" class="file-input-hidden slot-file-input" data-filename="${escapeHtml(filename)}">
      </label>
    `;

    const fileInput = card.querySelector(".slot-file-input");
    if (fileInput) {
      fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        processImageFile(file, filename, card.querySelector(".preview-area"));
      });
    }

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
      const MAX_SIZE = 1200;
      let w = img.width;
      let h = img.height;

      if (w > MAX_SIZE || h > MAX_SIZE) {
        if (w > h) {
          h = Math.round((h * MAX_SIZE) / w);
          w = MAX_SIZE;
        } else {
          w = Math.round((w * MAX_SIZE) / h);
          h = MAX_SIZE;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);

      const base64Data = canvas.toDataURL("image/jpeg", 0.85);
      const slot = state.imageSlots.get(slotFilename);
      if (slot) slot.base64 = base64Data;

      if (previewElement) {
        previewElement.innerHTML = `
          <img src="${base64Data}" alt="preview">
          <div style="font-size:11px; color:#10B981; font-weight:700; margin-top:8px;">✓ 画像を準備しました (圧縮済: ${w}x${h})</div>
          <input type="file" accept="image/*" class="file-input-hidden slot-file-input" data-filename="${escapeHtml(slotFilename)}">
        `;

        const newFileInput = previewElement.querySelector(".slot-file-input");
        if (newFileInput) {
          newFileInput.addEventListener("change", (event) => {
            const newFile = event.target.files[0];
            if (newFile) processImageFile(newFile, slotFilename, previewElement);
          });
        }
      }

      showToast(`✓ 「${slotFilename}」をセットしました！`);
    };
    img.onerror = () => {
      showToast("❌ 画像の読み込みに失敗しました");
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

/**
 * 全画像データと更新された JSON を GAS バックエンドへプッシュ＆ Actions トリガー
 */
async function pushAndTriggerWorkflow() {
  if (!state.configData) {
    showToast("⚠️ 先に JSON データを解析・編集してください");
    return;
  }

  const missingSlots = [];
  state.imageSlots.forEach((slot, filename) => {
    if (!slot.base64) missingSlots.push(filename);
  });

  if (missingSlots.length > 0) {
    const confirmPush = confirm(`以下の画像が未セットですがプッシュしてよろしいですか？\n（テンプレートのデフォルト画像やリポジトリの既存画像が使われます）\n\n・${missingSlots.join("\n・")}`);
    if (!confirmPush) return;
  }

  const pushBtn = document.getElementById("btn-push-trigger");
  if (pushBtn) {
    pushBtn.disabled = true;
    pushBtn.innerHTML = `⏳ GAS 経由でプッシュ＆ Actions 起動中...`;
  }
  showToast("🔥 リポジトリへファイルをプッシュ中...");

  try {
    syncJsonTextarea();
    const updatedJsonText = document.getElementById("textarea-json-raw").value;

    const payload = {
      jsonFilename: document.getElementById("meta-json-filename") ? document.getElementById("meta-json-filename").value : "video_config_custom.json",
      jsonContent: updatedJsonText,
      images: []
    };

    state.imageSlots.forEach((slot, filename) => {
      if (slot.base64) {
        payload.images.push({
          filename: filename,
          base64: slot.base64.split(",")[1]
        });
      }
    });

    const res = await fetch(state.gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "payload=" + encodeURIComponent(JSON.stringify(payload))
    });

    const result = await res.json();
    if (result.status === "ok") {
      showToast("🎉 プッシュ＆動画生成の起動に成功しました！");
      if (pushBtn) pushBtn.innerHTML = `✓ 起動完了！ Actions の状況を監視中...`;

      setTimeout(() => {
        checkActionsStatus(true);
        startPollingActions();
      }, 3000);
    } else {
      throw new Error(result.message || "サーバー側でエラーが発生しました");
    }
  } catch (err) {
    showToast("❌ プッシュ失敗: " + err.message);
    if (pushBtn) {
      pushBtn.disabled = false;
      pushBtn.innerHTML = `🔥 全画像＆JSONを一斉プッシュして動画生成開始！`;
    }
  }
}

/**
 * Actions ステータスの自動ポーリングを開始
 */
function startPollingActions() {
  if (state.pollingInterval) clearInterval(state.pollingInterval);
  state.pollingInterval = setInterval(() => {
    checkActionsStatus(false);
  }, 4000);
}

/**
 * GitHub Actions の最新ビルドステータス確認
 */
async function checkActionsStatus(showToastOnManual = false) {
  if (showToastOnManual) showToast("🔍 最新のビルド状態を確認中...");

  try {
    const res = await fetch(`${state.gasUrl}?action=status`);
    const data = await res.json();

    if (data.status !== "ok") {
      throw new Error(data.message || "取得に失敗しました");
    }

    const latest = data.latestRun;
    const badge = document.getElementById("status-badge");
    const title = document.getElementById("status-title");
    const meta = document.getElementById("status-meta");
    const artArea = document.getElementById("artifact-list-area");

    if (!latest) {
      if (badge) badge.textContent = "履歴なし";
      if (title) title.textContent = "まだワークフローの実行履歴がありません";
      return;
    }

    const timeStr = new Date(latest.created_at).toLocaleTimeString();
    if (meta) meta.textContent = `開始時刻: ${timeStr} (Run ID: #${latest.run_number})`;

    if (latest.status === "in_progress" || latest.status === "queued") {
      if (badge) {
        badge.textContent = "🔥 動画生成中 (VOICEVOX合成＆レンダリング)";
        badge.className = "status-badge status-progress";
      }
      if (title) title.textContent = "現在、サーバー側で動画を生成しています...";
    } else if (latest.status === "completed" && latest.conclusion === "success") {
      if (badge) {
        badge.textContent = "✓ 動画生成完了！";
        badge.className = "status-badge status-success";
      }
      if (title) title.textContent = "動画のレンダリングが完了しました！下からダウンロードできます。";
      if (state.pollingInterval) clearInterval(state.pollingInterval);
    } else if (latest.status === "completed" && latest.conclusion === "failure") {
      if (badge) {
        badge.textContent = "❌ 生成エラー";
        badge.className = "status-badge status-error";
      }
      if (title) title.textContent = "動画の生成中にエラーが発生しました。ログをご確認ください。";
      if (state.pollingInterval) clearInterval(state.pollingInterval);
    } else {
      if (badge) badge.textContent = `${latest.status} (${latest.conclusion || ""})`;
      if (title) title.textContent = `状態: ${latest.status}`;
    }

    if (artArea) artArea.innerHTML = "";
    if (latest.artifacts && latest.artifacts.length > 0 && artArea) {
      latest.artifacts.forEach(art => {
        const sizeMb = (art.size_in_bytes / (1024 * 1024)).toFixed(1);
        const a = document.createElement("a");
        a.className = "artifact-item";
        a.href = latest.html_url;
        a.target = "_blank";
        a.innerHTML = `
          <span>🎬 ${escapeHtml(art.name)} (${sizeMb} MB)</span>
          <span>📥 ダウンロード画面へ ➔</span>
        `;
        artArea.appendChild(a);
      });
    } else if (latest.status === "completed" && latest.conclusion === "success" && artArea) {
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
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}
