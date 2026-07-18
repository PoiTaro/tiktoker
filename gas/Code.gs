/**
 * 爆モテメンズラボ 動画制作コントローラー - GAS バックエンド (Code.gs)
 * スマホ Web UI からのリクエストを受け、GitHub API と連携してファイルプッシュ＆Actions起動＆ステータス確認を行います。
 */

/**
 * 【初期設定用関数】これを一度実行するだけでスクリプトプロパティが一斉登録されます。
 */
function setupMyPropertiesOnce() {
  PropertiesService.getScriptProperties().setProperties({
    "GITHUB_TOKEN": "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",
    "REPO_NAME": "PoiTaro/tiktoker"
  });
  console.log("✓ GITHUB_TOKEN と REPO_NAME プロパティの設定が正常に完了しました！");
}

// デフォルト設定 (プロパティサービスから取得。未設定時のフォールバック値)
const DEFAULT_REPO = "PoiTaro/tiktoker";

const WORKFLOW_ID = "generate-video.yml";
const BRANCH = "main";

/**
 * プロパティサービスまたはスプレッドシートから GitHub Token とリポジトリ名を取得
 */
function getConfig() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("GITHUB_TOKEN") || "";
  const repo = props.getProperty("REPO_NAME") || DEFAULT_REPO;
  return { token, repo };
}

/**
 * HTTP GET リクエスト処理 (ステータス確認・WEB UI 配信・設定チェック用)
 */
function doGet(e) {
  const action = e.parameter ? e.parameter.action : "";
  
  if (action === "init") {
    setupMyPropertiesOnce();
    return createJsonResponse({ status: "ok", message: "✓ GITHUB_TOKEN and REPO_NAME setup completed successfully!" });
  } else if (action === "status") {
    return createJsonResponse(checkActionsStatus());
  } else if (action === "test") {
    return createJsonResponse({ status: "ok", message: "GAS Backend is online!" });
  }
  
  // スマホ等のブラウザから URL そのままアクセスされた場合は、コントローラーの WEB UI 画面を直接返却
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('爆モテ動画制作コントローラー')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * HTTP POST リクエスト処理 (ファイルプッシュ＆Actions起動・ステータス確認用)
 */
function doPost(e) {
  try {
    let reqData = {};
    if (e && e.parameter && e.parameter.payload) {
      reqData = JSON.parse(e.parameter.payload);
    } else if (e && e.postData && e.postData.contents) {
      let contents = e.postData.contents;
      if (contents.indexOf("payload=") === 0) {
        contents = decodeURIComponent(contents.substring(8).replace(/\+/g, " "));
      }
      reqData = JSON.parse(contents);
    }

    const action = reqData.action || "pushAndTrigger";

    if (action === "pushAndTrigger") {
      const result = handlePushAndTrigger(reqData);
      return createJsonResponse(result);
    } else if (action === "checkStatus") {
      const status = checkActionsStatus();
      return createJsonResponse(status);
    } else {
      return createJsonResponse({ status: "error", success: false, error: "Unknown action: " + action });
    }
  } catch (err) {
    return createJsonResponse({ status: "error", success: false, error: err.toString(), stack: err.stack });
  }
}

/**
 * JSON & 画像一括プッシュおよび GitHub Actions ワークフローのトリガー処理
 */
function handlePushAndTrigger(data) {
  const { token, repo } = getConfig();
  if (!token) {
    throw new Error("GITHUB_TOKEN が GAS のスクリプトプロパティに設定されていません。SETUP_GUIDE をご確認ください。");
  }

  const jsonContent = data.jsonContent; // JSON 文字列
  const jsonFilename = data.jsonFilename || "video_config_custom.json";
  const outputFilename = data.outputFilename || "output_custom.mp4";
  const images = data.images || []; // [{ path: "images/xxx.png", base64: "..." }, ...]

  const results = {
    pushedFiles: [],
    errors: [],
    workflowTriggered: false
  };

  // 1. 画像ファイルを順番にコミット＆プッシュ
  for (const img of images) {
    try {
      const imgPath = img.path || img.filename;
      if (!imgPath) continue;

      // Data URL ("data:image/jpeg;base64,.....") から純粋な Base64 文字列を抽出
      let base64Data = img.base64;
      if (base64Data && base64Data.indexOf(",") !== -1) {
        base64Data = base64Data.split(",")[1];
      }
      const commitMsg = `feat: Upload ${imgPath} via Bakumote Mobile UI`;
      createOrUpdateFileGitHub(repo, imgPath, base64Data, commitMsg, token, true);
      results.pushedFiles.push(imgPath);
    } catch (err) {
      results.errors.push(`画像プッシュエラー (${img.path || img.filename}): ` + err.message);
    }
  }

  // 2. 原稿 JSON をコミット＆プッシュ (文字列を Base64 に変換してプッシュ)
  try {
    const jsonBase64 = Utilities.base64Encode(Utilities.newBlob(jsonContent).getBytes());
    const commitMsg = `feat: Update video config ${jsonFilename} via Bakumote Mobile UI`;
    createOrUpdateFileGitHub(repo, jsonFilename, jsonBase64, commitMsg, token, true);
    results.pushedFiles.push(jsonFilename);
  } catch (err) {
    results.errors.push(`JSONプッシュエラー (${jsonFilename}): ` + err.message);
  }

  // 3. ログ用スプレッドシート（もし紐づいていれば）に履歴保存
  try {
    logToSpreadsheet(jsonFilename, outputFilename, images.length, results.errors.length === 0 ? "SUCCESS" : "WARN");
  } catch (e) {
    // スプレッドシートなしでも動作続行
  }

  // 4. GitHub Actions ワークフロー (`generate-video.yml`) を自動キック
  if (results.errors.length === 0 || results.pushedFiles.includes(jsonFilename)) {
    try {
      triggerWorkflow(repo, WORKFLOW_ID, BRANCH, {
        config_file: jsonFilename,
        output_filename: outputFilename
      }, token);
      results.workflowTriggered = true;
    } catch (err) {
      results.errors.push("Actions起動エラー: " + err.message);
    }
  }

  return {
    status: "ok",
    success: results.errors.length === 0,
    workflowTriggered: results.workflowTriggered,
    results: results,
    errors: results.errors
  };
}

/**
 * GitHub API を用いた個別ファイルの作成または上書き
 */
function createOrUpdateFileGitHub(repo, path, contentBase64, message, token, isAlreadyBase64) {
  const url = `https://api.github.com/repos/${repo}/contents/${path}`;
  const headers = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };

  // 既存ファイルの SHA を取得
  let sha = null;
  const getRes = UrlFetchApp.fetch(url + `?ref=${BRANCH}`, {
    method: "get",
    headers: headers,
    muteHttpExceptions: true
  });

  if (getRes.getResponseCode() === 200) {
    const fileInfo = JSON.parse(getRes.getContentText());
    sha = fileInfo.sha;
  }

  const payload = {
    message: message,
    content: contentBase64,
    branch: BRANCH
  };
  if (sha) {
    payload.sha = sha;
  }

  const putRes = UrlFetchApp.fetch(url, {
    method: "put",
    headers: headers,
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const statusCode = putRes.getResponseCode();
  if (statusCode !== 200 && statusCode !== 201) {
    throw new Error(`GitHub API Error (${statusCode}): ` + putRes.getContentText());
  }

  return JSON.parse(putRes.getContentText());
}

/**
 * workflow_dispatch による Actions の開始
 */
function triggerWorkflow(repo, workflowId, ref, inputs, token) {
  const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflowId}/dispatches`;
  const headers = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };

  const payload = {
    ref: ref,
    inputs: inputs
  };

  const res = UrlFetchApp.fetch(url, {
    method: "post",
    headers: headers,
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  if (res.getResponseCode() !== 204) {
    throw new Error(`Workflow Trigger Error (${res.getResponseCode()}): ` + res.getContentText());
  }
}

/**
 * GitHub Actions の最新実行状態 (`runs`) と Artifact を取得
 */
function checkActionsStatus() {
  const { token, repo } = getConfig();
  if (!token) {
    return { status: "error", success: false, error: "GITHUB_TOKEN Not Configured" };
  }

  const headers = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };

  // 直近5件のワークフロー実行状況を取得
  const runsUrl = `https://api.github.com/repos/${repo}/actions/runs?per_page=5`;
  const runsRes = UrlFetchApp.fetch(runsUrl, {
    method: "get",
    headers: headers,
    muteHttpExceptions: true
  });

  if (runsRes.getResponseCode() !== 200) {
    return { status: "error", success: false, error: "GitHub API Error (" + runsRes.getResponseCode() + "): " + runsRes.getContentText() };
  }

  const runsData = JSON.parse(runsRes.getContentText());
  const runs = runsData.workflow_runs || [];

  if (runs.length === 0) {
    return { status: "ok", success: true, latestRun: null };
  }

  const latestRun = runs[0];
  const runId = latestRun.id;
  const status = latestRun.status; // queued, in_progress, completed
  const conclusion = latestRun.conclusion; // success, failure, cancelled, null
  const htmlUrl = latestRun.html_url;
  const title = latestRun.display_title || latestRun.name;
  const updatedAt = latestRun.updated_at;

  // Artifact 情報を取得
  let artifacts = [];
  if (status === "completed" && conclusion === "success") {
    const artUrl = `https://api.github.com/repos/${repo}/actions/runs/${runId}/artifacts`;
    const artRes = UrlFetchApp.fetch(artUrl, {
      method: "get",
      headers: headers,
      muteHttpExceptions: true
    });
    if (artRes.getResponseCode() === 200) {
      const artData = JSON.parse(artRes.getContentText());
      artifacts = (artData.artifacts || []).map(a => ({
        name: a.name,
        size_in_bytes: a.size_in_bytes,
        archive_download_url: a.archive_download_url
      }));
    }
  }

  return {
    status: "ok",
    success: true,
    latestRun: {
      id: runId,
      run_number: latestRun.run_number || runId,
      title: title,
      status: status,
      conclusion: conclusion,
      html_url: htmlUrl,
      created_at: latestRun.created_at || updatedAt,
      updated_at: updatedAt,
      artifacts: artifacts
    }
  };
}

/**
 * スプレッドシートが紐づいている場合に履歴をログ記録
 */
function logToSpreadsheet(jsonFile, outputFile, imgCount, status) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return; // スプレッドシートなしの場合はスキップ
  let sheet = ss.getSheetByName("生成履歴ログ");
  if (!sheet) {
    sheet = ss.insertSheet("生成履歴ログ");
    sheet.appendRow(["日時", "原稿JSONファイル", "出力MP4ファイル", "画像アップロード数", "ステータス"]);
  }
  sheet.appendRow([new Date(), jsonFile, outputFile, imgCount, status]);
}

/**
 * CORS 対応 JSON レスポンスの生成
 */
function createJsonResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
