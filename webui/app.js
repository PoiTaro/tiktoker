/**
 * 爆モテ動画制作コントローラー - フロントエンドロジック (app.js)
 * GAS サンドボックス (userCodeAppPanel) での JS 構文破壊 (バッククォートや改行の誤解析) を完全に撲滅したセキュア版です。
 */

// グローバルエラー監視
window.addEventListener("error", function(e) {
  console.error("Global Error:", e.error || e.message);
  showAlertBanner("⚠️ 画面エラー: " + (e.message || "予期せぬエラーが発生しました"), "error");
});

// アプリケーション状態管理
const state = {
  gasUrl: localStorage.getItem("bakumote_gas_url") || "https://script.google.com/macros/s/AKfycbzppl0o5kMi7-4yjtwlCPGdVucFpgDaq3l48ihgTaaQ9cyDeSQr37JGSeK5BkzCDE4L/exec",
  configData: null,
  imageSlots: new Map(),
  pollingInterval: null
};

// 初期化
document.addEventListener("DOMContentLoaded", function() {
  try {
    const gasInput = document.getElementById("input-gas-url");
    if (gasInput && state.gasUrl) gasInput.value = state.gasUrl;
    console.log("✓ App initialized safely without multiline template literals");
  } catch (err) {
    showAlertBanner("初期化失敗: " + err.message, "error");
  }
});

/**
 * 画面上部のアラートバナーを表示
 */
function showAlertBanner(msg, type) {
  const banner = document.getElementById("alert-banner");
  if (!banner) return;
  banner.style.display = "block";
  if (type === "error") {
    banner.style.backgroundColor = "#FEE2E2";
    banner.style.color = "#991B1B";
    banner.style.border = "1px solid #F87171";
  } else if (type === "success") {
    banner.style.backgroundColor = "#D1FAE5";
    banner.style.color = "#065F46";
    banner.style.border = "1px solid #34D399";
  } else {
    banner.style.backgroundColor = "#DBEAFE";
    banner.style.color = "#1E40AF";
    banner.style.border = "1px solid #60A5FA";
  }
  banner.innerHTML = msg;
}

/**
 * タブ切り替え処理
 */
window.switchTab = function(tabId, btnElem) {
  document.querySelectorAll(".tab-btn").forEach(function(b) { b.classList.remove("active"); });
  document.querySelectorAll(".tab-content").forEach(function(c) { c.classList.remove("active"); });
  if (btnElem) btnElem.classList.add("active");
  const content = document.getElementById(tabId);
  if (content) content.classList.add("active");
};

/**
 * GAS設定アコーディオンの開閉
 */
window.toggleConfigCard = function(forceShow) {
  const card = document.getElementById("config-card");
  if (!card) return;
  if (typeof forceShow === "boolean") {
    forceShow ? card.classList.remove("hidden") : card.classList.add("hidden");
  } else {
    card.classList.toggle("hidden");
  }
};

/**
 * GAS URL の保存とテスト接続
 */
window.saveAndTestGasUrl = async function() {
  const urlInput = document.getElementById("input-gas-url");
  const url = urlInput ? urlInput.value.trim() : "";
  if (!url) {
    showAlertBanner("URL を入力してください", "error");
    return;
  }
  localStorage.setItem("bakumote_gas_url", url);
  state.gasUrl = url;
  showAlertBanner("⏳ サーバーへテスト接続中...", "info");

  try {
    const res = await fetch(url + "?action=test");
    const data = await res.json();
    if (data.status === "ok") {
      showAlertBanner("✓ GAS バックエンドに正常接続しました！", "success");
      setTimeout(function() { toggleConfigCard(false); }, 1500);
    } else {
      showAlertBanner("⚠️ 接続できましたが応答が不正です", "error");
    }
  } catch (err) {
    showAlertBanner("❌ 接続エラー。URLをご確認ください", "error");
  }
};

/**
 * クリップボードからのペースト
 */
window.pasteFromClipboard = async function() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      const textarea = document.getElementById("textarea-json-raw");
      if (textarea) textarea.value = text;
      showAlertBanner("📋 クリップボードから貼り付けました！自動で解析を開始します...", "info");
      setTimeout(window.parseAndRenderJson, 300);
    } else {
      showAlertBanner("⚠️ クリップボードが空です", "error");
    }
  } catch (err) {
    showAlertBanner("⚠️ スマホのセキュリティにより自動貼り付けできませんでした。枠内に指で直接長押しして貼り付けてください。", "error");
  }
};

/**
 * ファイル選択時の処理
 */
window.handleFileSelect = function(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const textarea = document.getElementById("textarea-json-raw");
    if (textarea) textarea.value = e.target.result;
    showAlertBanner("📁 JSON ファイルを読み込みました！自動で解析を開始します...", "info");
    setTimeout(window.parseAndRenderJson, 300);
  };
  reader.readAsText(file);
};

/**
 * 無敵の JSON サニタイズ＆解析とカード展開
 */
window.parseAndRenderJson = function() {
  const btn = document.getElementById("btn-parse-json");
  if (btn) btn.innerHTML = "⏳ 解析＆カード展開中...";

  const textarea = document.getElementById("textarea-json-raw");
  let rawText = textarea ? textarea.value.trim() : "";

  if (!rawText) {
    if (btn) btn.innerHTML = "⚡ JSON を解析してカードエディタを展開";
    showAlertBanner("❌ 【入力エラー】テキスト枠が空です！ Gem が生成した JSON を貼り付けてからボタンを押してください。", "error");
    showToast("テキスト枠に JSON を貼り付けてください");
    return;
  }

  try {
    rawText = rawText.replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "");

    let cleanText = rawText
      .replace(/[”“]/g, '"')
      .replace(/[’‘]/g, "'")
      .replace(/：/g, ':')
      .replace(/，/g, ',');

    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleanText = cleanText.substring(firstBrace, lastBrace + 1);
    }

    cleanText = cleanText.replace(/,\s*([}\]])/g, "$1");

    const data = JSON.parse(cleanText);
    state.configData = data;

    const metaTitle = document.getElementById("meta-title");
    if (metaTitle) metaTitle.value = data.title || "";

    const metaOut = document.getElementById("meta-output-filename");
    if (metaOut && data.outputVideo) {
      metaOut.value = data.outputVideo;
    }

    const metaArea = document.getElementById("meta-editor-area");
    if (metaArea) metaArea.style.display = "block";

    renderScenesEditor(data.scenes || []);
    extractAndRenderImageSlots(data.scenes || []);

    const badgeScene = document.getElementById("badge-scene-count");
    if (badgeScene) badgeScene.textContent = (data.scenes || []).length;

    const badgeImg = document.getElementById("badge-img-count");
    if (badgeImg) badgeImg.textContent = state.imageSlots.size;

    if (btn) btn.innerHTML = "⚡ JSON を解析してカードエディタを展開";
    showAlertBanner("🎉 解析成功！ 全 " + (data.scenes || []).length + " シーンと " + state.imageSlots.size + " 個の画像スロットを展開しました！下にスクロールして編集・画像挿入を行ってください。", "success");
    showToast("✓ JSONを展開しカードを生成しました！");

    if (textarea) textarea.value = JSON.stringify(data, null, 2);

    if (metaArea) {
      metaArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } catch (err) {
    if (btn) btn.innerHTML = "⚡ JSON を解析してカードエディタを展開";
    console.error("JSON Parse Error:", err);
    showAlertBanner("❌ 【JSON解析エラー】貼り付けたデータに構文の誤りがあります。<br><span style='font-size:11px; font-weight:normal;'>原因の詳細: " + err.message + "</span>", "error");
    showToast("❌ JSON の構文エラー");
  }
};

/**
 * シーン別エディタカードの描画 (改行・バッククォート不使用)
 */
function renderScenesEditor(scenes) {
  const container = document.getElementById("scenes-editor-list");
  if (!container) return;
  container.innerHTML = "";

  scenes.forEach(function(scene, index) {
    const card = document.createElement("div");
    card.className = "card";

    let html = '<div class="scene-header">' +
      '<span class="scene-badge">Scene ' + (index + 1) + '</span>' +
      '<span class="scene-type">' + (scene.type || "standard") + '</span>' +
      '</div>' +
      '<div class="form-group">' +
      '<label class="form-label">画面タイトル (改行は &lt;br /&gt;)</label>' +
      '<input type="text" class="form-input scene-input-title" value="' + escapeHtml(scene.title || "") + '" oninput="syncJsonTextarea()">' +
      '</div>';

    if (scene.subtitle !== undefined || scene.type === "standard" || scene.type === "feature") {
      html += '<div class="form-group">' +
        '<label class="form-label">サブタイトル (subtitle)</label>' +
        '<input type="text" class="form-input scene-input-sub" value="' + escapeHtml(scene.subtitle || "") + '" oninput="syncJsonTextarea()">' +
        '</div>';
    }

    html += '<div class="form-group" style="margin-bottom:0;">' +
      '<label class="form-label" style="color:var(--accent-primary);">🗣️ ナレーションセリフ (narration)</label>' +
      '<textarea class="form-textarea scene-input-nar" style="min-height:75px;" oninput="syncJsonTextarea()">' + escapeHtml(scene.narration || "") + '</textarea>' +
      '</div>';

    card.innerHTML = html;

    const titleIn = card.querySelector(".scene-input-title");
    if (titleIn) titleIn.addEventListener("input", function(e) { scene.title = e.target.value; syncJsonTextarea(); });

    const subIn = card.querySelector(".scene-input-sub");
    if (subIn) subIn.addEventListener("input", function(e) { scene.subtitle = e.target.value; syncJsonTextarea(); });

    const narIn = card.querySelector(".scene-input-nar");
    if (narIn) narIn.addEventListener("input", function(e) { scene.narration = e.target.value; syncJsonTextarea(); });

    container.appendChild(card);
  });
}

/**
 * 双方向同期
 */
window.syncJsonTextarea = function() {
  if (!state.configData) return;
  const metaTitle = document.getElementById("meta-title");
  if (metaTitle) state.configData.title = metaTitle.value;
  
  const textarea = document.getElementById("textarea-json-raw");
  if (textarea) textarea.value = JSON.stringify(state.configData, null, 2);
};

/**
 * 要求画像ファイル名の自動抽出＆スロットカードの生成
 */
function extractAndRenderImageSlots(scenes) {
  state.imageSlots.clear();

  scenes.forEach(function(scene, idx) {
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
    container.innerHTML = '<div class="card" style="text-align:center; padding:30px; color:var(--text-muted);">要求されている画像はありません。</div>';
    return;
  }

  state.imageSlots.forEach(function(slotData, filename) {
    const card = document.createElement("div");
    card.className = "card image-slot-card";
    const sceneNumList = slotData.scenes.map(function(n) { return "Scene " + n; }).join(", ");
    const safeId = filename.replace(/[^a-zA-Z0-9]/g, "_");
    const safeFilename = escapeHtml(filename);
    
    card.innerHTML = '<div class="slot-info">' +
      '<span class="slot-filename">🖼️ ' + safeFilename + '</span>' +
      '<span class="slot-scenes">' + sceneNumList + '</span>' +
      '</div>' +
      '<label class="preview-area" id="preview-' + safeId + '">' +
      '<div class="preview-placeholder">' +
      '<i>📷</i>' +
      '<span>タップしてカメラ／写真から<br>このスロットに画像を割り当て</span>' +
      '</div>' +
      '<input type="file" accept="image/*" class="file-input-hidden slot-file-input" data-filename="' + safeFilename + '" onchange="handleSlotImageSelect(event, \'' + safeFilename + '\')">' +
      '</label>';

    container.appendChild(card);
  });
}

/**
 * 画像スロットでファイルが選択された時のハンドラ
 */
window.handleSlotImageSelect = function(event, slotFilename) {
  const file = event.target.files[0];
  if (!file) return;
  const previewElem = event.target.closest(".image-slot-card").querySelector(".preview-area");
  processImageFile(file, slotFilename, previewElem);
};

/**
 * スマホで選択した画像ファイルを引き受け、Canvas でリサイズして Base64 化
 */
function processImageFile(file, slotFilename, previewElement) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
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
        const safeFilename = escapeHtml(slotFilename);
        previewElement.innerHTML = '<img src="' + base64Data + '" alt="preview">' +
          '<div style="font-size:11px; color:#10B981; font-weight:700; margin-top:8px;">✓ 画像を準備しました (圧縮済: ' + w + 'x' + h + ')</div>' +
          '<input type="file" accept="image/*" class="file-input-hidden slot-file-input" data-filename="' + safeFilename + '" onchange="handleSlotImageSelect(event, \'' + safeFilename + '\')">';
      }

      showToast("✓ 「" + slotFilename + "」をセットしました！");
      showAlertBanner("✓ スロット「" + slotFilename + "」に写真を割り当てました", "success");
    };
    img.onerror = function() {
      showAlertBanner("❌ 画像の読み込みに失敗しました", "error");
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

/**
 * 全画像データと更新された JSON を GAS バックエンドへプッシュ＆ Actions トリガー
 */
window.pushAndTriggerWorkflow = async function() {
  if (!state.configData) {
    showAlertBanner("⚠️ 先に「① JSONエディタ」で JSON を解析してください", "error");
    return;
  }

  const missingSlots = [];
  state.imageSlots.forEach(function(slot, filename) {
    if (!slot.base64) missingSlots.push(filename);
  });

  if (missingSlots.length > 0) {
    const confirmMsg = "以下の画像が未セットですがプッシュしてよろしいですか？\n（テンプレートのデフォルト画像や既存画像が使われます）\n\n・" + missingSlots.join("\n・");
    if (!confirm(confirmMsg)) return;
  }

  const pushBtn = document.getElementById("btn-push-trigger");
  if (pushBtn) {
    pushBtn.disabled = true;
    pushBtn.innerHTML = "⏳ GAS 経由でプッシュ＆ Actions 起動中...";
  }
  showAlertBanner("🔥 リポジトリへファイルをプッシュして動画生成をスタートしています...", "info");

  try {
    syncJsonTextarea();
    const updatedJsonText = document.getElementById("textarea-json-raw").value;

    const payload = {
      action: "pushAndTrigger",
      jsonFilename: document.getElementById("meta-json-filename") ? document.getElementById("meta-json-filename").value : "video_config_custom.json",
      outputFilename: document.getElementById("meta-output-filename") ? document.getElementById("meta-output-filename").value : "output_custom.mp4",
      jsonContent: updatedJsonText,
      images: []
    };

    state.imageSlots.forEach(function(slot, filename) {
      if (slot.base64) {
        let b64 = slot.base64;
        if (b64.indexOf(",") !== -1) b64 = b64.split(",")[1];
        payload.images.push({
          path: filename,
          filename: filename,
          base64: b64
        });
      }
    });

    const res = await fetch(state.gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "payload=" + encodeURIComponent(JSON.stringify(payload))
    });

    const result = await res.json();
    if (result.status === "ok" || result.success === true || result.workflowTriggered === true) {
      showAlertBanner("🎉 プッシュ＆動画生成の起動に成功しました！自動で監視を開始します...", "success");
      if (pushBtn) pushBtn.innerHTML = "✓ 起動完了！ Actions の状況を監視中...";

      setTimeout(function() {
        window.checkActionsStatus(true);
        startPollingActions();
      }, 3000);
    } else {
      let errMsg = result.error || result.message || "サーバー側でエラーが発生しました";
      if (result.errors && result.errors.length > 0) {
        errMsg += " (" + result.errors.join(", ") + ")";
      }
      throw new Error(errMsg);
    }
  } catch (err) {
    showAlertBanner("❌ プッシュ失敗: " + err.message, "error");
    if (pushBtn) {
      pushBtn.disabled = false;
      pushBtn.innerHTML = "🔥 全画像＆JSONを一斉プッシュして動画生成開始！";
    }
  }
};

/**
 * Actions ステータスの自動ポーリング
 */
function startPollingActions() {
  if (state.pollingInterval) clearInterval(state.pollingInterval);
  state.pollingInterval = setInterval(function() {
    window.checkActionsStatus(false);
  }, 4000);
}

/**
 * GitHub Actions の最新ビルドステータス確認
 */
window.checkActionsStatus = async function(showToastOnManual) {
  if (showToastOnManual) showAlertBanner("🔍 最新の動画生成状態をサーバーに確認中...", "info");

  try {
    const res = await fetch(state.gasUrl + "?action=status");
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
    if (meta) meta.textContent = "開始時刻: " + timeStr + " (Run ID: #" + latest.run_number + ")";

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
      if (badge) badge.textContent = latest.status + " (" + (latest.conclusion || "") + ")";
      if (title) title.textContent = "状態: " + latest.status;
    }

    if (artArea) artArea.innerHTML = "";
    if (latest.artifacts && latest.artifacts.length > 0 && artArea) {
      latest.artifacts.forEach(function(art) {
        const sizeMb = (art.size_in_bytes / (1024 * 1024)).toFixed(1);
        const a = document.createElement("a");
        a.className = "artifact-item";
        a.href = latest.html_url;
        a.target = "_blank";
        a.innerHTML = '<span>🎬 ' + escapeHtml(art.name) + ' (' + sizeMb + ' MB)</span>' +
          '<span>📥 ダウンロード画面へ ➔</span>';
        artArea.appendChild(a);
      });
    } else if (latest.status === "completed" && latest.conclusion === "success" && artArea) {
      const a = document.createElement("a");
      a.className = "artifact-item";
      a.href = latest.html_url;
      a.target = "_blank";
      a.innerHTML = '<span>🎬 generated-mp4-video</span>' +
        '<span>📥 Run ページを開く ➔</span>';
      artArea.appendChild(a);
    }

    if (showToastOnManual) {
      showToast("✓ ステータスを最新に更新しました");
      showAlertBanner("✓ ステータスを最新情報に更新しました", "success");
    }
  } catch (err) {
    if (showToastOnManual) showAlertBanner("❌ 確認エラー: " + err.message, "error");
  }
};

/**
 * HTML エスケープユーティリティ
 */
function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * トースト通知
 */
function showToast(msg) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(function() {
    toast.classList.remove("show");
  }, 3200);
}
