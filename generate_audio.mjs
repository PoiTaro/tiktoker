import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const audioDir = path.resolve('audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

console.log('Starting VOICEVOX Engine...');
const vvProcess = spawn('C:\\Program Files\\VOICEVOX\\vv-engine\\run.exe', [
  '--host', '127.0.0.1',
  '--port', '50021'
], {
  windowsHide: true,
  stdio: 'ignore'
});

async function waitForServer(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch('http://127.0.0.1:50021/version');
      if (res.ok) return true;
    } catch (e) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return false;
}

const ready = await waitForServer();
if (!ready) {
  console.error('VOICEVOX Server failed to start.');
  vvProcess.kill();
  process.exit(1);
}

console.log('VOICEVOX Server ready!');

// 13: 青山龍星 - ノーマル (明るく知的で自然なプロのプレゼンターボイス)
const speakerId = 13;

const scenes = [
  { id: 'scene1', text: '思考する、AIエージェント。アンチグラビティ。' },
  { id: 'scene2', text: 'コードの文脈を深く理解し、自律的に設計と実装を行います。' },
  { id: 'scene3', text: '無駄を削ぎ落とした美しさ。洗練されたUIとデザインを構築します。' },
  { id: 'scene4', text: 'そして、コードから映像を生み出す。ハイパーフレームスによる動画生成まで。' },
  { id: 'scene5', text: '心地よい開発体験を、ともに。' }
];

for (const s of scenes) {
  console.log(`Synthesizing ${s.id}: ${s.text}`);
  const queryUrl = `http://127.0.0.1:50021/audio_query?speaker=${speakerId}&text=${encodeURIComponent(s.text)}`;
  const queryRes = await fetch(queryUrl, { method: 'POST' });
  const queryJson = await queryRes.json();

  // 明るく普通テンションへ改善 & 「し」の語頭切れを完全に防止する無音追加
  queryJson.speedScale = 1.02;      // 少しハキハキと前向きなスピード
  queryJson.intonationScale = 1.15; // 抑揚をつけて明るく生き生きと
  queryJson.pitchScale = 0.02;      // 声のトーンをわずかに明るく
  queryJson.prePhonemeLength = 0.55;// 語頭の音途切れを完全に防ぐ0.55秒の無音マージン
  queryJson.postPhonemeLength = 0.3;// 語尾の余韻無音マージン

  const synthUrl = `http://127.0.0.1:50021/synthesis?speaker=${speakerId}`;
  const synthRes = await fetch(synthUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(queryJson)
  });

  const arrayBuffer = await synthRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const outPath = path.join(audioDir, `${s.id}.wav`);
  fs.writeFileSync(outPath, buffer);
  console.log(`Saved ${outPath}`);
}

console.log('Stopping VOICEVOX Engine...');
vvProcess.kill();
console.log('All audio files generated successfully!');
