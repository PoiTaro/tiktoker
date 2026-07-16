import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CLI Arguments parsing ---
const args = process.argv.slice(2);
let configPath = 'video_config.json';
let shouldRender = false;
let outputVideoOverride = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--config' || args[i] === '-c') {
    configPath = args[i + 1];
    i++;
  } else if (args[i] === '--render' || args[i] === '-r') {
    shouldRender = true;
  } else if (args[i] === '--output' || args[i] === '-o') {
    outputVideoOverride = args[i + 1];
    i++;
  }
}

const fullConfigPath = path.resolve(__dirname, configPath);
if (!fs.existsSync(fullConfigPath)) {
  console.error(`❌ Error: Config file not found at ${fullConfigPath}`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(fullConfigPath, 'utf8'));
if (config.autoRender) {
  shouldRender = true;
}

console.log(`✨ Loaded video configuration: "${config.title}"`);

// --- Helper: Get accurate WAV duration in seconds using WAV RIFF header ---
function getWavDurationSec(filepath) {
  const buffer = fs.readFileSync(filepath);
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`Not a valid WAV file: ${filepath}`);
  }
  let offset = 12;
  let byteRate = 0;
  let dataSize = 0;

  while (offset < buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    if (chunkId === 'fmt ') {
      byteRate = buffer.readUInt32LE(offset + 16);
    } else if (chunkId === 'data') {
      dataSize = chunkSize;
      break;
    }
    offset += 8 + chunkSize;
  }

  if (!byteRate || !dataSize) {
    throw new Error(`Could not parse WAV data chunk or byteRate in ${filepath}`);
  }

  return dataSize / byteRate;
}

// --- VOICEVOX Engine Management ---
const VV_HOST = process.env.VOICEVOX_HOST || '127.0.0.1';
const VV_PORT = process.env.VOICEVOX_PORT || 50021;
const VV_BASE = `http://${VV_HOST}:${VV_PORT}`;

async function isEngineReady() {
  try {
    const res = await fetch(`${VV_BASE}/version`, { method: 'GET' });
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function startEngineIfNeed() {
  if (await isEngineReady()) {
    console.log(`✅ VOICEVOX Engine is ready at ${VV_BASE}`);
    return null;
  }

  console.log('🚀 VOICEVOX Engine not detected at default URL. Searching for local engine binary...');
  const customPath = process.env.VOICEVOX_ENGINE_PATH;
  const enginePaths = [
    ...(customPath ? [customPath] : []),
    'C:\\Program Files\\VOICEVOX\\vv-engine\\run.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Programs\\VOICEVOX\\vv-engine\\run.exe'),
    '/usr/local/vv-engine/run',
    '/usr/local/bin/vv-engine/run',
    'run.exe',
    'run'
  ];

  let engineProcess = null;
  for (const exePath of enginePaths) {
    if (fs.existsSync(exePath)) {
      console.log(`   Found engine at: ${exePath}`);
      engineProcess = spawn(exePath, ['--host', VV_HOST, '--port', String(VV_PORT)], {
        windowsHide: true,
        stdio: 'ignore'
      });
      break;
    }
  }

  if (!engineProcess) {
    throw new Error(`Could not connect to or start VOICEVOX engine at ${VV_BASE}. Please launch VOICEVOX ENGINE manually or check VOICEVOX_HOST/PORT.`);
  }

  // Wait up to 30 seconds for ready
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (await isEngineReady()) {
      console.log('✅ VOICEVOX Engine started successfully!');
      return engineProcess;
    }
  }
  throw new Error('VOICEVOX Engine timed out starting.');
}

// --- Smart Audio Cache Helper ---
function getAudioCacheHash(text, speakerId) {
  const hashObj = {
    text,
    speakerId,
    speedScale: config.speedScale ?? 1.02,
    intonationScale: config.intonationScale ?? 1.15,
    pitchScale: config.pitchScale ?? 0.02,
    prePhonemeLength: config.leadSilenceSeconds ?? 0.55,
    postPhonemeLength: config.tailSilenceSeconds ?? 0.3
  };
  return crypto.createHash('sha256').update(JSON.stringify(hashObj)).digest('hex');
}

async function synthesizeAudio(text, speakerId, outputFile) {
  const metaFile = `${outputFile}.meta.json`;
  const currentHash = getAudioCacheHash(text, speakerId);

  // Check cache
  if (fs.existsSync(outputFile) && fs.existsSync(metaFile)) {
    try {
      const cachedMeta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
      if (cachedMeta.hash === currentHash) {
        console.log(`   ⚡ Cache hit: Skipping synthesis for "${text.slice(0, 20)}..."`);
        return;
      }
    } catch (e) {
      // Ignore meta parse errors, regenerate
    }
  }

  console.log(`   🎙️ Synthesizing: "${text}"`);
  const queryUrl = `${VV_BASE}/audio_query?speaker=${speakerId}&text=${encodeURIComponent(text)}`;
  const queryRes = await fetch(queryUrl, { method: 'POST' });
  if (!queryRes.ok) {
    throw new Error(`audio_query failed for "${text}": ${queryRes.statusText}`);
  }
  const queryJson = await queryRes.json();

  // Apply voice and silence parameters from config
  queryJson.speedScale = config.speedScale ?? 1.02;
  queryJson.intonationScale = config.intonationScale ?? 1.15;
  queryJson.pitchScale = config.pitchScale ?? 0.02;
  queryJson.prePhonemeLength = config.leadSilenceSeconds ?? 0.55;
  queryJson.postPhonemeLength = config.tailSilenceSeconds ?? 0.3;

  const synthUrl = `${VV_BASE}/synthesis?speaker=${speakerId}`;
  const synthRes = await fetch(synthUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(queryJson)
  });

  if (!synthRes.ok) {
    throw new Error(`synthesis failed for "${text}": ${synthRes.statusText}`);
  }

  const audioBuffer = await synthRes.arrayBuffer();
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, Buffer.from(audioBuffer));
  fs.writeFileSync(metaFile, JSON.stringify({ hash: currentHash, text, speakerId }, null, 2), 'utf8');
}

// --- Main Execution ---
async function main() {
  const engineProcess = await startEngineIfNeed();

  try {
    console.log('\n🎙️ Step 1: Synthesizing & Caching Narrations with Lead Silence Buffer...');
    const audioDir = path.resolve(__dirname, 'audio');
    fs.mkdirSync(audioDir, { recursive: true });

    const sceneMetrics = [];
    let currentTime = 0.0;
    const leadSilence = config.leadSilenceSeconds ?? 0.55;
    const scenePadding = config.scenePaddingSeconds ?? 0.6;

    for (let i = 0; i < config.scenes.length; i++) {
      const scene = config.scenes[i];
      const audioPath = path.join(audioDir, `${scene.id}.wav`);
      const relAudioPath = `audio/${scene.id}.wav`;

      await synthesizeAudio(scene.narration, config.speakerId ?? 13, audioPath);

      const duration = getWavDurationSec(audioPath);
      console.log(`      -> [${scene.id}] Duration: ${duration.toFixed(3)}s (including ${leadSilence}s lead silence)`);

      const start = currentTime;
      const clipDuration = Math.ceil((duration + scenePadding) * 10) / 10;
      const end = start + clipDuration;

      sceneMetrics.push({
        ...scene,
        trackIndex: i + 1,
        audioTrackIndex: 11 + i,
        audioSrc: relAudioPath,
        audioDuration: duration.toFixed(2),
        start: start.toFixed(2),
        duration: clipDuration.toFixed(2),
        end: end.toFixed(2),
        animStart: (start + leadSilence).toFixed(2),
        animExit: Math.max(start + leadSilence + 1.0, end - 1.0).toFixed(2),
        animHardKill: (end - 0.05).toFixed(2)
      });

      currentTime = end;
    }

    const totalDuration = Math.ceil(currentTime);
    console.log(`\n📐 Step 2: Generating composition index.html (Total duration: ${totalDuration}s)...`);

    const audioTagsHtml = sceneMetrics.map(m => 
      `      <audio id="voice-${m.id}" class="clip" data-start="${m.start}" data-duration="${m.audioDuration}" data-track-index="${m.audioTrackIndex}" src="${m.audioSrc}"></audio>`
    ).join('\n');

    const scenesHtml = sceneMetrics.map(m => {
      let contentHtml = '';
      if (m.type === 'title') {
        contentHtml = `
          <div class="main-logo anim-item">${m.mainLogo || config.brand}</div>
          <div class="divider-line anim-item"></div>
          <div class="tagline anim-item">${m.tagline || ''}</div>`;
      } else if (m.type === 'feature') {
        const numClassAttr = m.numClass ? ` ${m.numClass}` : '';
        contentHtml = `
          <div class="scene-num${numClassAttr} anim-item">${m.num || ''}</div>
          <h1 class="scene-title anim-item">${m.title || ''}</h1>
          <p class="scene-subtitle anim-item">${m.subtitle || ''}</p>`;
      } else if (m.type === 'epilogue') {
        contentHtml = `
          <h1 class="closing-text anim-item">${m.title || ''}</h1>
          <div class="closing-sub anim-item">${m.subtitle || config.brand}</div>`;
      } else {
        contentHtml = `
          <h1 class="scene-title anim-item">${m.title || ''}</h1>
          <p class="scene-subtitle anim-item">${m.subtitle || ''}</p>`;
      }

      const imageHtml = m.image ? `
          <div class="scene-image-wrapper anim-item">
            <img class="scene-image" src="${m.image}" alt="${(m.title || '').replace(/<[^>]*>/g, '')}" />
          </div>` : '';

      const containerClasses = m.image ? 'scene-container has-image' : 'scene-container';

      return `      <!-- Scene: ${m.id} (Track ${m.trackIndex}) -->
      <div id="${m.id}" class="clip" data-start="${m.start}" data-duration="${m.duration}" data-track-index="${m.trackIndex}">
        <div class="${containerClasses}">${contentHtml}${imageHtml}
        </div>
      </div>`;
    }).join('\n\n');

    const gsapInitialSets = sceneMetrics.map(m => `      gsap.set("#${m.id} .anim-item", { opacity: 0, y: 40 });`).join('\n');
    const gsapTweens = sceneMetrics.map((m, idx) => {
      const isLast = idx === sceneMetrics.length - 1;
      let tween = `      // ${m.id} (${m.start}s - ${m.end}s) | Voice begins precisely at ${m.animStart}s\n`;
      tween += `      tl.to("#${m.id} .anim-item", {
        opacity: 1,
        y: 0,
        duration: ${isLast ? 1.5 : 1.4},
        stagger: ${isLast ? 0.3 : 0.25},
        ease: "power2.out"
      }, ${m.animStart})`;

      if (!isLast) {
        tween += `\n      .to("#${m.id} .anim-item", {
        opacity: 0,
        y: -30,
        duration: 0.8,
        stagger: 0.1,
        ease: "power2.in"
      }, ${m.animExit})
      .set("#${m.id} .anim-item", { opacity: 0 }, ${m.animHardKill});`;
      } else {
        tween += `;`;
      }
      return tween;
    }).join('\n\n');

    const fullHtml = `<!doctype html>
<html lang="ja" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <title>${config.title}</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <div
      id="root"
      data-composition-id="main"
      data-start="0"
      data-duration="${totalDuration}"
      data-width="1080"
      data-height="1920"
    >
      <!-- Base Static Frame (Track 0) -->
      <div id="base-frame" class="clip" data-start="0" data-duration="${totalDuration}" data-track-index="0" style="padding: 0; justify-content: initial; align-items: initial;">
        <div class="frame-border"></div>
        <div class="frame-corner corner-tl"></div>
        <div class="frame-corner corner-tr"></div>
        <div class="frame-corner corner-bl"></div>
        <div class="frame-corner corner-br"></div>

        <header class="static-header">
          <div class="header-tag">${config.headerTag || '紹介動画'}</div>
          <div class="header-brand">${config.brand || '爆モテメンズラボ'}</div>
        </header>

        <footer class="static-footer">
          <div class="footer-note">
            ${(config.footerNote || '').replace(/\n/g, '<br />')}
          </div>
          <div class="footer-right">${config.footerYear || new Date().getFullYear()}</div>
        </footer>
      </div>

<!-- Audio Tracks (0.55s Lead Silence Buffer synchronized with text animation) -->
${audioTagsHtml}

${scenesHtml}
    </div>

    <script>
      // GSAP timeline registration for HyperFrames
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });

      // Initial setup for animated elements
${gsapInitialSets}

${gsapTweens}

      // Register timeline to HyperFrames global registry
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;

    const indexPath = path.resolve(__dirname, 'index.html');
    fs.writeFileSync(indexPath, fullHtml, 'utf8');
    console.log(`✅ Successfully generated composition: ${indexPath}`);

    // Run lint check
    console.log('\n🔍 Step 3: Running HyperFrames Quality & Lint Check...');
    try {
      execSync('npm run check', { cwd: __dirname, stdio: 'inherit' });
      console.log('✅ Quality check passed (0 errors)!');
    } catch (e) {
      console.warn('⚠️ Quality check reported warnings/errors. Please review output.');
    }

    // Optional render
    if (shouldRender) {
      const outputDir = path.resolve(__dirname, 'output');
      fs.mkdirSync(outputDir, { recursive: true });
      const targetFilename = outputVideoOverride || config.outputVideo || 'output_video.mp4';
      const outputVideoPath = path.isAbsolute(targetFilename) ? targetFilename : path.join(outputDir, path.basename(targetFilename));

      console.log(`\n🎬 Step 4: Rendering video to "${outputVideoPath}"...`);
      execSync(`npx -y hyperframes@latest render . -o "${outputVideoPath}"`, { cwd: __dirname, stdio: 'inherit' });
      console.log(`\n🎉 All done! Video successfully generated: ${outputVideoPath}`);
    } else {
      console.log(`\n💡 To render the video, run:\n   node generate_video.mjs --config "${configPath}" --render\n   or: npm run render`);
    }

  } finally {
    if (engineProcess) {
      console.log('🛑 Stopping temporary VOICEVOX Engine...');
      engineProcess.kill();
    }
  }
}

main().catch(err => {
  console.error('❌ Fatal Error during video generation:', err);
  process.exit(1);
});

