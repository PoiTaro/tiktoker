/**
 * bakumote STUDIO - Premium Apple Design compliant script
 * GAS sandbox safe: NO backticks (`), NO template literals, NO arrow functions in code
 */

window.addEventListener("error", function(e) {
  console.error("Global Error:", e.error || e.message);
  showAlertBanner("Error: " + (e.message || ""), "error");
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
    banner.style.backgroundColor = "#ffefe5"; banner.style.color = "#ff3b30"; banner.style.border = "0.5px solid rgba(255,59,48,0.3)";
  } else if (type === "success") {
    banner.style.backgroundColor = "#eafaf1"; banner.style.color = "#10b981"; banner.style.border = "0.5px solid rgba(16,185,129,0.3)";
  } else {
    banner.style.backgroundColor = "#e8f4ff"; banner.style.color = "#007aff"; banner.style.border = "0.5px solid rgba(0,122,255,0.3)";
  }
  banner.innerHTML = msg;
}

function showToast(msg) {
  var toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.style.display = "block";
  toast.classList.add("show");
  setTimeout(function() {
    toast.classList.remove("show");
    setTimeout(function() { toast.style.display = "none"; }, 300);
  }, 2500);
}

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ===== MODAL & CONFIG ===== */

window.openModal = function(id) {
  var modal = document.getElementById(id);
  if (modal) {
    modal.style.display = "flex";
  }
};

window.closeModal = function(id) {
  var modal = document.getElementById(id);
  if (modal) {
    modal.style.display = "none";
  }
};

window.toggleConfigCard = function() {
  var card = document.getElementById("config-card");
  if (card) {
    card.classList.toggle("hidden");
  }
};

window.saveConfig = async function() {
  var urlInput = document.getElementById("input-gas-url");
  var url = urlInput ? urlInput.value.trim() : "";
  if (!url) { showAlertBanner("URL is required.", "error"); return; }
  localStorage.setItem("bakumote_gas_url", url);
  state.gasUrl = url;
  showAlertBanner("Testing connection...", "info");
  try {
    var res = await fetch(url + "?action=test");
    var data = await res.json();
    if (data.status === "ok") {
      showAlertBanner("Connected successfully!", "success");
      setTimeout(function() { toggleConfigCard(); }, 1500);
    } else {
      showAlertBanner("Connection failed. Bad server response.", "error");
    }
  } catch (err) {
    showAlertBanner("Connection failed. Please check the URL.", "error");
  }
};

/* ===== TABS ===== */

window.switchToolTab = function(panelId, btnElem) {
  var tabs = document.querySelectorAll(".tab-btn");
  var panels = document.querySelectorAll(".editor-panel");
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove("active");
  for (var j = 0; j < panels.length; j++) panels[j].classList.remove("active");
  
  if (btnElem) {
    btnElem.classList.add("active");
  } else {
    for (var k = 0; k < tabs.length; k++) {
      if (tabs[k].getAttribute("onclick").indexOf(panelId) !== -1) {
        tabs[k].classList.add("active");
        break;
      }
    }
  }
  var panel = document.getElementById(panelId);
  if (panel) panel.classList.add("active");
};

/* ===== FILE UPLOADER & CLIPBOARD ===== */

window.pasteFromClipboard = async function() {
  try {
    var text = await navigator.clipboard.readText();
    if (text) {
      var ta = document.getElementById("textarea-json-raw");
      if (ta) ta.value = text;
      showAlertBanner("Pasted from clipboard! Parsing...", "info");
      setTimeout(window.parseAndRenderJson, 300);
    } else {
      showAlertBanner("Clipboard is empty.", "error");
    }
  } catch (err) {
    showAlertBanner("Clipboard access rejected. Please paste manually into the textarea.", "error");
  }
};

window.handleFileUpload = function(event) {
  var file = event.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    var ta = document.getElementById("textarea-json-raw");
    if (ta) ta.value = e.target.result;
    showAlertBanner("File loaded! Parsing...", "info");
    setTimeout(window.parseAndRenderJson, 300);
  };
  reader.readAsText(file);
};

/* ===== JSON PARSER & RENDERING ===== */

window.parseAndRenderJson = function() {
  var btn = document.getElementById("btn-parse-json");
  if (btn) btn.textContent = "Parsing...";

  var textarea = document.getElementById("textarea-json-raw");
  var rawText = textarea ? textarea.value.trim() : "";

  if (!rawText) {
    if (btn) btn.textContent = "Parse & Render";
    showAlertBanner("No JSON data provided.", "error");
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

    // Reveal elements
    var tl = document.getElementById("timeline-section");
    if (tl) tl.style.display = "block";
    var tt = document.getElementById("tool-tabs");
    if (tt) tt.style.display = "flex";

    if (btn) btn.textContent = "Parse & Render";
    closeModal("modal-json");

    showAlertBanner("Parsed " + state.sceneCount + " scenes successfully!", "success");
    showToast("Editor generated!");

    if (textarea) textarea.value = JSON.stringify(data, null, 2);
  } catch (err) {
    if (btn) btn.textContent = "Parse & Render";
    showAlertBanner("JSON Parse Error: " + err.message, "error");
  }
};

/* ===== TIMELINE ===== */

function renderTimeline(scenes) {
  var scroll = document.getElementById("timeline-scroll");
  var totalEl = document.getElementById("timeline-total");
  if (!scroll) return;
  scroll.innerHTML = "";

  var totalEst = 0;

  for (var i = 0; i < scenes.length; i++) {
    var scene = scenes[i];
    var card = document.createElement("div");
    card.className = "timeline-card" + (i === state.selectedSceneIndex ? " active" : "");
    card.setAttribute("data-index", i);

    var charCount = (scene.narration || "").length;
    var estSec = Math.max(2, Math.round(charCount * 0.12));
    totalEst += estSec;

    var slotData = scene.image ? state.imageSlots.get(scene.image) : null;
    var hasPreview = slotData && slotData.base64;

    if (hasPreview) {
      card.innerHTML = '<img src="' + slotData.base64 + '" alt="">' +
        '<div class="timeline-label-num">S' + (i + 1) + '</div>';
    } else {
      card.innerHTML = '<div class="timeline-card-empty">' + getSceneEmoji(scene.type) + '</div>' +
        '<div class="timeline-label-num">S' + (i + 1) + '</div>';
    }

    card.addEventListener("click", (function(idx) {
      return function() { selectScene(idx); };
    })(i));

    scroll.appendChild(card);
  }

  if (totalEl) totalEl.textContent = totalEst.toFixed(1) + "s (" + scenes.length + " scenes)";
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

  var cards = document.querySelectorAll(".timeline-card");
  for (var i = 0; i < cards.length; i++) {
    cards[i].classList.toggle("active", i === index);
  }

  if (cards[index]) {
    cards[index].scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }

  var scriptCards = document.querySelectorAll(".script-editor-card");
  for (var j = 0; j < scriptCards.length; j++) {
    scriptCards[j].classList.toggle("selected", j === index);
  }
  if (scriptCards[index]) {
    scriptCards[index].scrollIntoView({ behavior: "smooth", block: "nearest" });
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
  var sceneNumEl = document.getElementById("preview-scene-num");
  var durEl = document.getElementById("preview-duration");
  var navEl = document.getElementById("preview-nav");

  var slotData = scene.image ? state.imageSlots.get(scene.image) : null;
  if (slotData && slotData.base64) {
    if (imgEl) { imgEl.src = slotData.base64; imgEl.style.display = "block"; }
    if (emptyEl) emptyEl.style.display = "none";
  } else {
    if (imgEl) imgEl.style.display = "none";
    if (emptyEl) {
      emptyEl.style.display = "flex";
      emptyEl.innerHTML = '<span class="emoji">' + getSceneEmoji(scene.type) + '</span>' +
        '<div style="font-weight:700; margin-top:4px;">' + escapeHtml(scene.title || "Scene " + (state.selectedSceneIndex + 1)) + '</div>' +
        '<div style="font-size:11px; opacity:0.7; margin-top:2px;">' + escapeHtml(scene.image || "No image") + '</div>';
    }
  }

  if (overlayEl) {
    overlayEl.style.display = "block";
    overlayEl.innerHTML = '<div class="preview-title">' + (scene.title || "").replace(/&lt;br\s*\/?&gt;/gi, "<br>").replace(/<br\s*\/?>/gi, "<br>") + '</div>' +
      '<div class="preview-subtitle">' + escapeHtml(scene.subtitle || scene.narration || "") + '</div>';
  }

  if (sceneNumEl) {
    sceneNumEl.style.display = "block";
    sceneNumEl.textContent = "Scene " + (state.selectedSceneIndex + 1) + "/" + state.sceneCount;
  }

  if (durEl) {
    durEl.style.display = "block";
    var charCount = (scene.narration || "").length;
    var estSec = Math.max(2, Math.round(charCount * 0.12));
    durEl.textContent = estSec + "s";
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
      card.className = "script-editor-card" + (index === state.selectedSceneIndex ? " selected" : "");
      card.setAttribute("data-scene-index", index);

      var html = '<div class="script-card-header">' +
        '<span class="scene-num-badge">Scene ' + (index + 1) + '</span>' +
        '<span class="scene-type-badge">' + escapeHtml(scene.type || "standard") + '</span>' +
        '</div>';

      html += '<div class="input-group">' +
        '<label>Title</label>' +
        '<input type="text" class="scene-title-input" value="' + escapeHtml(scene.title || "") + '" oninput="onSceneFieldChange(' + index + ', \'title\', this.value)">' +
        '</div>';

      if (scene.subtitle !== undefined) {
        html += '<div class="input-group">' +
          '<label>Subtitle</label>' +
          '<input type="text" class="scene-sub-input" value="' + escapeHtml(scene.subtitle || "") + '" oninput="onSceneFieldChange(' + index + ', \'subtitle\', this.value)">' +
          '</div>';
      }

      html += '<div class="input-group" style="margin-bottom:0;">' +
        '<label style="color:var(--accent);">Narration</label>' +
        '<textarea class="scene-nar-input" style="min-height:54px;" oninput="onSceneFieldChange(' + index + ', \'narration\', this.value)">' + escapeHtml(scene.narration || "") + '</textarea>' +
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
  if (field === "narration") {
    renderTimingPanel(state.configData.scenes);
    // Refresh timeline label calculations
    var totalEl = document.getElementById("timeline-total");
    if (totalEl) {
      var totalEst = 0;
      for (var i = 0; i < state.configData.scenes.length; i++) {
        var charCount = (state.configData.scenes[i].narration || "").length;
        totalEst += Math.max(2, Math.round(charCount * 0.12));
      }
      totalEl.textContent = totalEst.toFixed(1) + "s (" + state.sceneCount + " scenes)";
    }
  }
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
    container.innerHTML = '<p class="placeholder-text">No media slots required for this JSON.</p>';
    return;
  }

  state.imageSlots.forEach(function(slotData, filename) {
    var slot = document.createElement("div");
    slot.className = "media-slot-item";
    var safeFilename = escapeHtml(filename);
    var sceneList = slotData.scenes.map(function(n) { return "Scene " + n; }).join(", ");

    slot.innerHTML = '<label class="media-slot-view">' +
      '<div class="media-slot-placeholder icon-camera">&#128247;</div>' +
      '<input type="file" accept="image/*" class="file-input-hidden" data-filename="' + safeFilename + '" onchange="handleSlotImageSelect(event, \'' + safeFilename + '\')">' +
      '</label>' +
      '<div class="media-slot-details">' +
      '<div class="media-slot-title">' + safeFilename + '</div>' +
      '<div class="media-slot-scenes-list">' + sceneList + '</div>' +
      '</div>';

    container.appendChild(slot);
  });
}

window.handleSlotImageSelect = function(event, slotFilename) {
  var file = event.target.files[0];
  if (!file) return;
  var slotEl = event.target.closest(".media-slot-item");
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

      if (slotElement) {
        var view = slotElement.querySelector(".media-slot-view");
        if (view) {
          var safeFilename = escapeHtml(slotFilename);
          view.innerHTML = '<img src="' + base64Data + '" alt="preview">' +
            '<div class="media-slot-checked">&#10003;</div>' +
            '<input type="file" accept="image/*" class="file-input-hidden" data-filename="' + safeFilename + '" onchange="handleSlotImageSelect(event, \'' + safeFilename + '\')">';
        }
      }

      if (state.configData) {
        renderTimeline(state.configData.scenes || []);
        updatePreview();
      }

      showToast("Media updated!");
    };
    img.onerror = function() { showAlertBanner("Invalid image file.", "error"); };
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
    card.className = "timing-item-card";
    card.innerHTML = '<div class="timing-name">' +
      'Scene ' + (i + 1) + '<span>' + escapeHtml(scene.type || "std") + '</span>' +
      '</div>' +
      '<div class="timing-sec">~' + estSec + 's</div>';
    container.appendChild(card);
  }

  var summary = document.createElement("div");
  summary.className = "timing-item-card total";
  summary.innerHTML = '<div class="timing-name">' +
    'Total Estimated Duration<span>' + scenes.length + ' scenes</span>' +
    '</div>' +
    '<div class="timing-sec">~' + totalEst + 's</div>';
  container.appendChild(summary);
}

/* ===== PUSH AND VIDEO TRIGGER ===== */

window.pushAndTriggerWorkflow = async function() {
  if (!state.configData) {
    showAlertBanner("Please load and parse JSON first.", "error");
    openModal("modal-json");
    return;
  }

  var missingSlots = [];
  state.imageSlots.forEach(function(slot, filename) {
    if (!slot.base64) missingSlots.push(filename);
  });

  if (missingSlots.length > 0) {
    var confirmMsg = "The following images are not assigned:\n\n" + missingSlots.join("\n") + "\n\nContinue anyway?";
    if (!confirm(confirmMsg)) return;
  }

  var pushBtn = document.getElementById("btn-push-trigger");
  if (pushBtn) {
    pushBtn.disabled = true;
    var labelEl = pushBtn.querySelector(".btn-label");
    if (labelEl) labelEl.textContent = "Processing...";
  }
  showAlertBanner("Pushing files to GitHub...", "info");

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
      showAlertBanner("Files pushed! Launching Actions...", "success");
      if (pushBtn) {
        var labelEl2 = pushBtn.querySelector(".btn-label");
        if (labelEl2) labelEl2.textContent = "Triggered";
      }
      switchToolTab("panel-status", null);
      setTimeout(function() {
        window.checkActionsStatus(true);
        startPollingActions();
      }, 3000);
    } else {
      var errMsg = result.error || result.message || "Server upload error";
      if (result.errors && result.errors.length > 0) errMsg += " (" + result.errors.join(", ") + ")";
      throw new Error(errMsg);
    }
  } catch (err) {
    showAlertBanner("Upload failed: " + err.message, "error");
    if (pushBtn) {
      pushBtn.disabled = false;
      var labelEl3 = pushBtn.querySelector(".btn-label");
      if (labelEl3) labelEl3.textContent = "Generate";
    }
  }
};

/* ===== ACTIONS STATUS POLING ===== */

function startPollingActions() {
  if (state.pollingInterval) clearInterval(state.pollingInterval);
  state.pollingInterval = setInterval(function() {
    window.checkActionsStatus(false);
  }, 4000);
}

window.checkActionsStatus = async function(showToastOnManual) {
  if (showToastOnManual) showAlertBanner("Fetching latest video generation status...", "info");

  try {
    var res = await fetch(state.gasUrl + "?action=status");
    var data = await res.json();

    if (data.status !== "ok" && data.success !== true) {
      throw new Error(data.error || data.message || "Status endpoint failed");
    }

    var latest = data.latestRun;
    var badge = document.getElementById("status-badge");
    var title = document.getElementById("status-title");
    var meta = document.getElementById("status-meta");
    var artArea = document.getElementById("artifact-list-area");

    if (!latest) {
      if (badge) { badge.textContent = "STANDBY"; badge.className = "status-badge"; }
      if (title) title.textContent = "No history found";
      if (meta) meta.textContent = "Workflow runs haven't started yet.";
      return;
    }

    var createdTime = latest.created_at || latest.updated_at || new Date().toISOString();
    var timeStr = new Date(createdTime).toLocaleTimeString();
    var runNum = latest.run_number || latest.id || "?";
    
    if (meta) meta.textContent = "Updated: " + timeStr + " (Run #" + runNum + ")";

    if (latest.status === "in_progress" || latest.status === "queued") {
      if (badge) { badge.textContent = "RENDERING"; badge.className = "status-badge progress"; }
      if (title) title.textContent = "Generating video and synthetic voice...";
    } else if (latest.status === "completed" && latest.conclusion === "success") {
      if (badge) { badge.textContent = "SUCCESS"; badge.className = "status-badge success"; }
      if (title) title.textContent = "Video successfully generated!";
      if (state.pollingInterval) clearInterval(state.pollingInterval);
    } else if (latest.status === "completed" && latest.conclusion === "failure") {
      if (badge) { badge.textContent = "FAILED"; badge.className = "status-badge error"; }
      if (title) title.textContent = "Video generation failed. Please check build logs.";
      if (state.pollingInterval) clearInterval(state.pollingInterval);
    } else {
      if (badge) { badge.textContent = latest.status.toUpperCase(); badge.className = "status-badge"; }
      if (title) title.textContent = "Workflow status: " + latest.status;
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
        a.innerHTML = "<span>" + escapeHtml(art.name) + " (" + sizeMb + " MB)</span><span>Download</span>";
        artArea.appendChild(a);
      }
    } else if (latest.status === "completed" && latest.conclusion === "success" && artArea) {
      var link = document.createElement("a");
      link.className = "artifact-item";
      link.href = latest.html_url;
      link.target = "_blank";
      link.innerHTML = "<span>Output Video File</span><span>Go to Run Page</span>";
      artArea.appendChild(link);
    }

    if (showToastOnManual) {
      showToast("Status updated");
      showAlertBanner("Status is up to date.", "success");
    }
  } catch (err) {
    if (showToastOnManual) showAlertBanner("Failed to retrieve status: " + err.message, "error");
  }
};
