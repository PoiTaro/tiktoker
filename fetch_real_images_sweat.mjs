import puppeteer from 'puppeteer';
import fs from 'fs';
import https from 'https';
import http from 'http';

const products = [
  {
    name: 'images/real_gatsby.jpg',
    url: 'https://www.amazon.co.jp/s?k=' + encodeURIComponent('ギャツビー フェイシャルペーパー モイスチャー 洗顔シート')
  },
  {
    name: 'images/real_deonatulle.jpg',
    url: 'https://www.amazon.co.jp/s?k=' + encodeURIComponent('デオナチュレ 男ソフトストーンW 制汗剤 直塗り')
  },
  {
    name: 'images/real_uno_uv.jpg',
    url: 'https://www.amazon.co.jp/s?k=' + encodeURIComponent('ウーノ UVパーフェクトジェル オールインワン')
  }
];

async function downloadImage(url, dest) {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(dest);
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    }, res => {
      if (res.statusCode === 200) {
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(true); });
      } else {
        file.close();
        resolve(false);
      }
    }).on('error', () => {
      file.close();
      resolve(false);
    });
  });
}

async function main() {
  console.log('Launching Chrome browser via Puppeteer to fetch high-res real product photos...');
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1280, height: 800 });

  for (const item of products) {
    console.log(`\nBrowsing search page for: ${item.name}...`);
    try {
      await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 2000));

      const imgUrls = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img.s-image, div.s-product-image-container img'));
        return imgs.map(img => img.src).filter(src => src && src.includes('media-amazon.com/images/I/'));
      });

      if (imgUrls && imgUrls.length > 0) {
        let bestUrl = imgUrls[0];
        bestUrl = bestUrl.replace(/\._AC_[^.]+_\./, '._AC_SL1200_.');
        console.log(`Found product photo URL: ${bestUrl}`);
        
        const success = await downloadImage(bestUrl, item.name);
        if (success) {
          const stats = fs.statSync(item.name);
          console.log(`[SUCCESS] Saved real photo (${stats.size} bytes) -> ${item.name}`);
        } else {
          console.log(`[FAIL] Could not download from ${bestUrl}`);
        }
      } else {
        console.log(`[WARN] Could not find product image element on page.`);
      }
    } catch (e) {
      console.log(`[ERROR] Navigating for ${item.name}: ${e.message}`);
    }
  }

  await browser.close();
  console.log('\nBrowser photo fetching complete.');
}

main();
