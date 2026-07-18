/**
 * bakumote STUDIO - CapCut-style Video Editor Controller
 * GAS sandbox safe: NO backticks, NO template literals, NO arrow functions in critical paths
 */

window.addEventListener("error", function(e) {
  console.error("Global Error:", e.error || e.message);
  showAlertBanner("画面エラー: " + (e.message || ""), "error");
});

var state = {
  gasUrl: localStorage.getItem("bakumote_gas_url") || "https://script.google.com/macros/s/AKfycbzppl0o5kMi7-4yjtwlCPGdVucFpgDaq3l48ihgTaaQ9cyDeSQr37JGSeK5BkzCDE4L/exec",
  configData: null,
  imageSlots: new Map(),
  pollingInterval: null,
  selectedSceneIndex: 0,
  sceneCount: 0
};

document.addEventListener("DOMContentLoaded", function() {
  var gasInput = document.getElementById("input-gas-url");
  if (gasInput && state.gasUrl) gasInput.value = state.gasUrl;
});

/* ===== UTILITIES ===== */

function showAlertBanner(msg, type) {
  var banner = document.getElementById("alert-banner");
  if (!banner) return;
  banner.style.display = "block";
  if (type === "error") {
    banner.style.backgroundColor = "#FEE2E2"; banner.style.color = "#991B1B"; banner.style.border = "1px solid #F87171";
  } else if (type === "success") {
    banner.style.backgroundColor = "#D1FAE5"; banner.style.color = "#065F46"; banner.style.border = "1px solid #34D399";
  } else {
    banner.style.backgroundColor = "#DBEAFE"; banner.style.color = "#1E40AF"; banner.style.border = "1px solid #60A5FA";
  }
  banner.innerHTML = msg;
}

function showToast(msg) {
  var toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(function() { toast.classList.remove("show"); }, 3200);
}

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ===== MODAL ===== */

window.openModal = function(id) {
  var el = document.getElementById(id);
  if (el) el.classList.add("active");
};

window.closeModal = function(id) {
  var el = document.getElementById(id);
  if (el) el.classList.remove("active");
};

/* ===== CONFIG ===== */

window.toggleConfigCard = function(forceShow) {
  var card = document.getElementById("config-card");
  if (!card) return;
  if (typeof forceShow === "boolean") {
    forceShow ? card.classList.remove("hidden") : card.classList.add("hidden");
  } else {
    card.classList.toggle("hidden");
  }
};

window.saveAndTestGasUrl = async function() {
  var urlInput = document.getElementById("input-gas-url");
  var url = urlInput ? urlInput.value.trim() : "";
  if (!url) { showAlertBanner("URL required", "error"); return; }
  localStorage.setItem("bakumote_gas_url", url);
  state.gasUrl = url;
  showAlertBanner("Connecting...", "info");
  try {
    var res = await fetch(url + "?action=test");
    var data = await res.json();
    if (data.status === "ok") {
      showAlertBanner("Connected!", "success");
      setTimeout(function() { toggleConfigCard(false); }, 1500);
    } else { showAlertBanner("Connection failed", "error"); }
  } catch (err) { showAlertBanner("Connection error", "error"); }
};

/* ===== TOOL TABS ===== */

window.switchToolTab = function(panelId, btnElem) {
  var tabs = document.querySelectorAll(".tool-tab");
  var panels = document.querySelectorAll(".editor-panel");
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove("active");
  for (var j = 0; j < panels.length; j++) panels[j].classList.remove("active");
  if (btnElem) btnElem.classList.add("active");
  else {
    for (var k = 0; k < tabs.length; k++) {
      if (tabs[k].getAttribute("data-panel") === panelId) { tabs[k].classList.add("active"); break; }
    }
  }
  var panel = document.getElementById(panelId);
  if (panel) panel.classList.add("active");
};

/* ===== CLIPBOARD & FILE ===== */

window.pasteFromClipboard = async function() {
  try {
    var text = await navigator.clipboard.readText();
    if (text) {
      var ta = document.getElementById("textarea-json-raw");
      if (ta) ta.value = text;
      showAlertBanner("Pasted! Auto-parsing...", "info");
      setTimeout(window.parseAndRenderJson, 300);
    } else { showAlertBanner("Clipboard empty", "error"); }
  } catch (err) {
    showAlertBanner("Paste failed. Please paste manually.", "error");
  }
};

window.handleFileSelect = function(event) {
  var file = event.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    var ta = document.getElementById("textarea-json-raw");
    if (ta) ta.value = e.target.result;
    showAlertBanner("File loaded! Auto-parsing...", "info");
    setTimeout(window.parseAndRenderJson, 300);
  };
  reader.readAsText(file);
};

/* ===== JSON PARSE & RENDER ===== */

window.parseAndRenderJson = function() {
  var btn = document.getElementById("btn-parse-json");
  if (btn) btn.textContent = "Parsing...";

  var textarea = document.getElementById("textarea-json-raw");
  var rawText = textarea ? textarea.value.trim() : "";

  if (!rawText) {
    if (btn) btn.textContent = "Parse & Generate Timeline";
    showAlertBanner("Empty! Paste JSON first.", "error");
    return;
  }

  try {
    rawText = rawText.replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "");
    var cleanText = rawText
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/\uff1a/g, ':')
      .replace(/\uff0c/g, ',');

    var firstBrace = cleanText.indexOf('{');
    var lastBrace = cleanText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleanText = cleanText.substring(firstBrace, lastBrace + 1);
    }
    cleanText = cleanText.replace(/,\s*([}\]])/g, "$1");

    var data = JSON.parse(cleanText);
    state.configData = data;
    state.sceneCount = (data.scenes || []).length;
    state.selectedSceneIndex = 0;

    var metaTitle = document.getElementById("meta-title");
    if (metaTitle) metaTitle.value = data.title || "";

    var metaOut = document.getElementById("meta-output-filename");
    if (metaOut && data.outputVideo) metaOut.value = data.outputVideo;

    renderTimeline(data.scenes || []);
    renderScriptEditor(data.scenes || []);
    extractAndRenderMediaSlots(data.scenes || []);
    renderTimingPanel(data.scenes || []);
    updatePreview();

    // Show hidden sections
    var tl = document.getElementById("timeline-section");
    if (tl) tl.style.display = "block";
    var tt = document.getElementById("tool-tabs");
    if (tt) tt.style.display = "flex";

    if (btn) btn.textContent = "Parse & Generate Timeline";
    closeModal("modal-json");

    showAlertBanner(state.sceneCount + " scenes loaded! Timeline ready.", "success");
    showToast("Timeline generated!");

    if (textarea) textarea.value = JSON.stringify(data, null, 2);
  } catch (err) {
    if (btn) btn.textContent = "Parse & Generate Timeline";
    showAlertBanner("JSON Error: " + err.message, "error");
  }
};

/* ===== TIMELINE ===== */

function renderTimeline(scenes) {
  var scroll = document.getElementById("timeline-scroll");
  var totalEl = document.getElementById("timeline-total");
  if (!scroll) return;
  scroll.innerHTML = "";

  if (totalEl) totalEl.textContent = scenes.length + " scenes";

  for (var i = 0; i < scenes.length; i++) {
    var scene = scenes[i];
    var block = document.createElement("div");
    block.className = "timeline-block" + (i === state.selectedSceneIndex ? " active" : "");
    block.setAttribute("data-index", i);
    block.style.width = Math.max(52, Math.min(120, 52 + (scene.narration || "").length)) + "px";

    var slotData = scene.image ? state.imageSlots.get(scene.image) : null;
    var hasPreview = slotData && slotData.base64;

    if (hasPreview) {
      block.innerHTML = '<img class="timeline-block-bg" src="' + slotData.base64 + '" alt="">' +
        '<div class="timeline-block-label">S' + (i + 1) + '</div>';
    } else {
      block.innerHTML = '<div class="timeline-block-no-img">' + getSceneEmoji(scene.type) + '</div>' +
        '<div class="timeline-block-label">S' + (i + 1) + '</div>';
    }

    block.addEventListener("click", (function(idx) {
      return function() { selectScene(idx); };
    })(i));

    scroll.appendChild(block);
  }
}

function getSceneEmoji(type) {
  if (!type) return "&#127916;";
  if (type === "hook") return "&#127919;";
  if (type === "intro") return "&#128075;";
  if (type === "feature") return "&#11088;";
  if (type === "cta") return "&#128293;";
  if (type === "ending") return "&#128588;";
  return "&#127916;";
}

/* ===== SCENE SELECTION & PREVIEW ===== */

window.selectScene = function(index) {
  if (!state.configData || !state.configData.scenes) return;
  if (index < 0) index = state.sceneCount - 1;
  if (index >= state.sceneCount) index = 0;
  state.selectedSceneIndex = index;

  // Update timeline highlights
  var blocks = document.querySelectorAll(".timeline-block");
  for (var i = 0; i < blocks.length; i++) {
    blocks[i].classList.toggle("active", i === index);
  }

  // Scroll timeline block into view
  if (blocks[index]) {
    blocks[index].scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }

  // Update script card highlights
  var cards = document.querySelectorAll(".script-card");
  for (var j = 0; j < cards.length; j++) {
    cards[j].classList.toggle("selected", j === index);
  }
  if (cards[index]) {
    cards[index].scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  updatePreview();
};

window.navigateScene = function(delta) {
  selectScene(state.selectedSceneIndex + delta);
};

function updatePreview() {
  if (!state.configData || !state.configData.scenes) return;
  var scene = state.configData.scenes[state.selectedSceneIndex];
  if (!scene) return;

  var imgEl = document.getElementById("preview-image");
  var emptyEl = document.getElementById("preview-empty");
  var overlayEl = document.getElementById("preview-overlay");
  var titleEl = document.getElementById("preview-title");
  var subEl = document.getElementById("preview-subtitle");
  var sceneNumEl = document.getElementById("preview-scene-num");
  var durEl = document.getElementById("preview-duration");
  var navEl = document.getElementById("preview-nav");

  // Show image if available
  var slotData = scene.image ? state.imageSlots.get(scene.image) : null;
  if (slotData && slotData.base64) {
    if (imgEl) { imgEl.src = slotData.base64; imgEl.style.display = "block"; }
    if (emptyEl) emptyEl.style.display = "none";
  } else {
    if (imgEl) imgEl.style.display = "none";
    if (emptyEl) {
      emptyEl.style.display = "block";
      emptyEl.innerHTML = '<div style="font-size:40px; margin-bottom:8px;">' + getSceneEmoji(scene.type) + '</div>' +
        '<div style="font-weight:700; font-size:14px;">' + escapeHtml(scene.title || "Scene " + (state.selectedSceneIndex + 1)) + '</div>' +
        '<div style="margin-top:4px; font-size:12px;">' + escapeHtml(scene.image || "No image") + '</div>';
    }
  }

  // Overlay text
  if (overlayEl) overlayEl.style.display = "block";
  if (titleEl) titleEl.innerHTML = (scene.title || "").replace(/&lt;br\s*\/?&gt;/gi, "<br>").replace(/<br\s*\/?>/gi, "<br>");
  if (subEl) subEl.textContent = scene.subtitle || scene.narration || "";

  // Scene indicator
  if (sceneNumEl) {
    sceneNumEl.style.display = "block";
    sceneNumEl.textContent = "Scene " + (state.selectedSceneIndex + 1) + "/" + state.sceneCount;
  }

  // Duration
  if (durEl) {
    durEl.style.display = "block";
    var charCount = (scene.narration || "").length;
    var estSec = Math.max(2, Math.round(charCount * 0.12));
    durEl.textContent = "~" + estSec + "s";
  }

  if (navEl) navEl.style.display = "flex";
}

/* ===== SCRIPT EDITOR ===== */

function renderScriptEditor(scenes) {
  var container = document.getElementById("script-editor-list");
  if (!container) return;
  container.innerHTML = "";

  for (var i = 0; i < scenes.length; i++) {
    (function(scene, index) {
      var card = document.createElement("div");
      card.className = "script-card" + (index === state.selectedSceneIndex ? " selected" : "");
      card.setAttribute("data-scene-index", index);

      var html = '<div class="script-card-header">' +
        '<span class="script-scene-badge">Scene ' + (index + 1) + '</span>' +
        '<span class="script-scene-type">' + escapeHtml(scene.type || "standard") + '</span>' +
        '</div>';

      html += '<div class="form-group">' +
        '<label class="form-label">Title</label>' +
        '<input type="text" class="form-input scene-title-input" value="' + escapeHtml(scene.title || "") + '" oninput="onSceneFieldChange(' + index + ', \'title\', this.value)">' +
        '</div>';

      if (scene.subtitle !== undefined) {
        html += '<div class="form-group">' +
          '<label class="form-label">Subtitle</label>' +
          '<input type="text" class="form-input scene-sub-input" value="' + escapeHtml(scene.subtitle || "") + '" oninput="onSceneFieldChange(' + index + ', \'subtitle\', this.value)">' +
          '</div>';
      }

      html += '<div class="form-group" style="margin-bottom:0;">' +
        '<label class="form-label" style="color:var(--accent);">Narration</label>' +
        '<textarea class="form-textarea scene-nar-input" style="min-height:60px;" oninput="onSceneFieldChange(' + index + ', \'narration\', this.value)">' + escapeHtml(scene.narration || "") + '</textarea>' +
        '</div>';

      card.innerHTML = html;

      card.addEventListener("click", function() { selectScene(index); });
      container.appendChild(card);
    })(scenes[i], i);
  }
}

window.onSceneFieldChange = function(index, field, value) {
  if (!state.configData || !state.configData.scenes) return;
  state.configData.scenes[index][field] = value;
  syncJsonTextarea();
  if (index === state.selectedSceneIndex) updatePreview();
  if (field === "narration") renderTimingPanel(state.configData.scenes);
};

window.syncJsonTextarea = function() {
  if (!state.configData) return;
  var metaTitle = document.getElementById("meta-title");
  if (metaTitle) state.configData.title = metaTitle.value;
  var textarea = document.getElementById("textarea-json-raw");
  if (textarea) textarea.value = JSON.stringify(state.configData, null, 2);
};

/* ===== MEDIA SLOTS ===== */

function extractAndRenderMediaSlots(scenes) {
  state.imageSlots.clear();

  for (var i = 0; i < scenes.length; i++) {
    var scene = scenes[i];
    if (scene.image) {
      if (!state.imageSlots.has(scene.image)) {
        state.imageSlots.set(scene.image, { scenes: [i + 1], base64: null });
      } else {
        state.imageSlots.get(scene.image).scenes.push(i + 1);
      }
    }
  }

  var container = document.getElementById("media-slot-grid");
  if (!container) return;
  container.innerHTML = "";

  if (state.imageSlots.size === 0) {
    container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--text-muted); font-size:13px;">No image slots required</div>';
    return;
  }

  state.imageSlots.forEach(function(slotData, filename) {
    var slot = document.createElement("div");
    slot.className = "media-slot";
    var safeFilename = escapeHtml(filename);
    var sceneList = slotData.scenes.map(function(n) { return "S" + n; }).join(", ");

    slot.innerHTML = '<label class="media-slot-preview">' +
      '<div class="media-slot-placeholder">&#128247;</div>' +
      '<input type="file" accept="image/*" class="file-input-hidden" data-filename="' + safeFilename + '" onchange="handleSlotImageSelect(event, \'' + safeFilename + '\')">' +
      '</label>' +
      '<div class="media-slot-info">' +
      '<div class="media-slot-name">' + safeFilename + '</div>' +
      '<div class="media-slot-scenes">' + sceneList + '</div>' +
      '</div>';

    container.appendChild(slot);
  });
}

window.handleSlotImageSelect = function(event, slotFilename) {
  var file = event.target.files[0];
  if (!file) return;
  var slotEl = event.target.closest(".media-slot");
  processImageFile(file, slotFilename, slotEl);
};

function processImageFile(file, slotFilename, slotElement) {
  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      var MAX_SIZE = 1200;
      var w = img.width, h = img.height;
      if (w > MAX_SIZE || h > MAX_SIZE) {
        if (w > h) { h = Math.round((h * MAX_SIZE) / w); w = MAX_SIZE; }
        else { w = Math.round((w * MAX_SIZE) / h); h = MAX_SIZE; }
      }
      var canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      var base64Data = canvas.toDataURL("image/jpeg", 0.85);

      var slot = state.imageSlots.get(slotFilename);
      if (slot) slot.base64 = base64Data;

      // Update slot card
      if (slotElement) {
        var preview = slotElement.querySelector(".media-slot-preview");
        if (preview) {
          var safeFilename = escapeHtml(slotFilename);
          preview.innerHTML = '<img src="' + base64Data + '" alt="preview">' +
            '<div class="media-slot-check">&#10003;</div>' +
            '<input type="file" accept="image/*" class="file-input-hidden" data-filename="' + safeFilename + '" onchange="handleSlotImageSelect(event, \'' + safeFilename + '\')">';
        }
      }

      // Refresh timeline & preview
      if (state.configData) {
        renderTimeline(state.configData.scenes || []);
        updatePreview();
      }

      showToast(slotFilename + " set!");
    };
    img.onerror = function() { showAlertBanner("Image load failed", "error"); };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

/* ===== TIMING PANEL ===== */

function renderTimingPanel(scenes) {
  var container = document.getElementById("timing-editor-list");
  if (!container) return;
  container.innerHTML = "";

  var totalEst = 0;

  for (var i = 0; i < scenes.length; i++) {
    var scene = scenes[i];
    var charCount = (scene.narration || "").length;
    var estSec = Math.max(2, Math.round(charCount * 0.12));
    totalEst += estSec;

    var card = document.createElement("div");
    card.className = "timing-info-card";
    card.innerHTML = '<div class="timing-row">' +
      '<span class="timing-label">Scene ' + (i + 1) + ' (' + escapeHtml(scene.type || "std") + ')</span>' +
      '<span class="timing-value">~' + estSec + 's</span>' +
      '</div>' +
      '<div class="timing-row">' +
      '<span class="timing-label">Narration chars</span>' +
      '<span class="timing-value">' + charCount + '</span>' +
      '</div>';
    container.appendChild(card);
  }

  // Total summary
  var summary = document.createElement("div");
  summary.className = "timing-info-card";
  summary.style.borderColor = "var(--accent)";
  summary.innerHTML = '<div class="timing-row">' +
    '<span class="timing-label" style="font-weight:800;">Total estimated</span>' +
    '<span class="timing-value" style="font-size:18px;">~' + totalEst + 's</span>' +
    '</div>' +
    '<div class="timing-row">' +
    '<span class="timing-label">Scenes</span>' +
    '<span class="timing-value">' + scenes.length + '</span>' +
    '</div>';
  container.appendChild(summary);
}

/* ===== PUSH & TRIGGER ===== */

window.pushAndTriggerWorkflow = async function() {
  if (!state.configData) {
    showAlertBanner("Load JSON first!", "error");
    openModal("modal-json");
    return;
  }

  var missingSlots = [];
  state.imageSlots.forEach(function(slot, filename) {
    if (!slot.base64) missingSlots.push(filename);
  });

  if (missingSlots.length > 0) {
    var confirmMsg = "These images are not set:\n\n" + missingSlots.join("\n") + "\n\nPush anyway?";
    if (!confirm(confirmMsg)) return;
  }

  var pushBtn = document.getElementById("btn-push-trigger");
  if (pushBtn) { pushBtn.disabled = true; pushBtn.querySelector(".bar-btn-icon").textContent = "..."; }
  showAlertBanner("Pushing to GitHub & starting Actions...", "info");

  try {
    syncJsonTextarea();
    var updatedJsonText = document.getElementById("textarea-json-raw").value;

    var payload = {
      action: "pushAndTrigger",
      jsonFilename: document.getElementById("meta-json-filename") ? document.getElementById("meta-json-filename").value : "video_config_custom.json",
      outputFilename: document.getElementById("meta-output-filename") ? document.getElementById("meta-output-filename").value : "output_custom.mp4",
      jsonContent: updatedJsonText,
      images: []
    };

    state.imageSlots.forEach(function(slot, filename) {
      if (slot.base64) {
        var b64 = slot.base64;
        if (b64.indexOf(",") !== -1) b64 = b64.split(",")[1];
        payload.images.push({ path: filename, filename: filename, base64: b64 });
      }
    });

    var res = await fetch(state.gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "payload=" + encodeURIComponent(JSON.stringify(payload))
    });

    var result = await res.json();
    if (result.status === "ok" || result.success === true || result.workflowTriggered === true) {
      showAlertBanner("Pushed! Actions started. Monitoring...", "success");
      if (pushBtn) pushBtn.querySelector(".bar-btn-icon").textContent = "\u2713";
      switchToolTab("panel-status", null);
      setTimeout(function() {
        window.checkActionsStatus(true);
        startPollingActions();
      }, 3000);
    } else {
      var errMsg = result.error || result.message || "Server error";
      if (result.errors && result.errors.length > 0) errMsg += " (" + result.errors.join(", ") + ")";
      throw new Error(errMsg);
    }
  } catch (err) {
    showAlertBanner("Push failed: " + err.message, "error");
    if (pushBtn) {
      pushBtn.disabled = false;
      pushBtn.querySelector(".bar-btn-icon").textContent = "\uD83D\uDE80";
    }
  }
};

/* ===== ACTIONS STATUS ===== */

function startPollingActions() {
  if (state.pollingInterval) clearInterval(state.pollingInterval);
  state.pollingInterval = setInterval(function() {
    window.checkActionsStatus(false);
  }, 4000);
}

window.checkActionsStatus = async function(showToastOnManual) {
  if (showToastOnManual) showAlertBanner("Checking Actions status...", "info");

  try {
    var res = await fetch(state.gasUrl + "?action=status");
    var data = await res.json();

    if (data.status !== "ok" && data.success !== true) {
      throw new Error(data.error || data.message || "Status check failed");
    }

    var latest = data.latestRun;
    var badge = document.getElementById("status-badge");
    var title = document.getElementById("status-title");
    var meta = document.getElementById("status-meta");
    var artArea = document.getElementById("artifact-list-area");

    if (!latest) {
      if (badge) badge.textContent = "No runs";
      if (title) title.textContent = "No workflow runs found";
      return;
    }

    var createdTime = latest.created_at || latest.updated_at || new Date().toISOString();
    var timeStr = new Date(createdTime).toLocaleTimeString();
    var runNum = latest.run_number || latest.id || "?";
    if (meta) meta.textContent = "Started: " + timeStr + " (Run #" + runNum + ")";

    if (latest.status === "in_progress" || latest.status === "queued") {
      if (badge) { badge.textContent = "RENDERING..."; badge.className = "status-badge status-progress"; }
      if (title) title.textContent = "VOICEVOX + Rendering in progress...";
    } else if (latest.status === "completed" && latest.conclusion === "success") {
      if (badge) { badge.textContent = "COMPLETE"; badge.className = "status-badge status-success"; }
      if (title) title.textContent = "Video rendered successfully!";
      if (state.pollingInterval) clearInterval(state.pollingInterval);
    } else if (latest.status === "completed" && latest.conclusion === "failure") {
      if (badge) { badge.textContent = "FAILED"; badge.className = "status-badge status-error"; }
      if (title) title.textContent = "Render failed. Check logs.";
      if (state.pollingInterval) clearInterval(state.pollingInterval);
    } else {
      if (badge) badge.textContent = latest.status;
      if (title) title.textContent = "Status: " + latest.status;
    }

    if (artArea) artArea.innerHTML = "";
    if (latest.artifacts && latest.artifacts.length > 0 && artArea) {
      for (var i = 0; i < latest.artifacts.length; i++) {
        var art = latest.artifacts[i];
        var sizeMb = (art.size_in_bytes / (1024 * 1024)).toFixed(1);
        var a = document.createElement("a");
        a.className = "artifact-item";
        a.href = latest.html_url;
        a.target = "_blank";
        a.innerHTML = '<span>' + escapeHtml(art.name) + ' (' + sizeMb + ' MB)</span><span>Download</span>';
        artArea.appendChild(a);
      }
    } else if (latest.status === "completed" && latest.conclusion === "success" && artArea) {
      var link = document.createElement("a");
      link.className = "artifact-item";
      link.href = latest.html_url;
      link.target = "_blank";
      link.innerHTML = '<span>generated-video</span><span>Open Run Page</span>';
      artArea.appendChild(link);
    }

    if (showToastOnManual) {
      showToast("Status updated");
      showAlertBanner("Status updated!", "success");
    }
  } catch (err) {
    if (showToastOnManual) showAlertBanner("Status error: " + err.message, "error");
  }
};
