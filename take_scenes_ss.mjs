import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function captureScenes() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1080,1920']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920 });

  const htmlPath = `file://${path.resolve(__dirname, 'index.html').replace(/\\/g, '/')}`;
  console.log(`Opening: ${htmlPath}`);
  await page.goto(htmlPath, { waitUntil: 'networkidle0' });

  // Hide or pause GSAP timelines, force show specific scenes
  const scenes = ['scene2', 'scene3', 'scene4', 'scene5', 'scene6', 'scene7', 'scene8', 'scene9'];

  for (const sceneId of scenes) {
    await page.evaluate((id) => {
      // Hide all clips inside root
      document.querySelectorAll('#root > .clip').forEach(el => {
        if (el.id !== 'base-frame' && !el.id.startsWith('voice-')) {
          el.style.display = 'none';
          el.style.opacity = '0';
        }
      });
      // Show base-frame and current scene
      const base = document.getElementById('base-frame');
      if (base) base.style.display = 'block';

      const target = document.getElementById(id);
      if (target) {
        target.style.display = 'block';
        target.style.opacity = '1';
        target.style.visibility = 'visible';
        // force show all child anim-items
        target.querySelectorAll('.anim-item').forEach(item => {
          item.style.opacity = '1';
          item.style.transform = 'none';
        });
      }
    }, sceneId);

    await new Promise(r => setTimeout(r, 300));
    const ssPath = path.resolve(__dirname, `screenshot_${sceneId}.png`);
    await page.screenshot({ path: ssPath });
    console.log(`Saved screenshot: screenshot_${sceneId}.png`);
  }

  await browser.close();
  console.log('Finished taking scene screenshots.');
}

captureScenes();
