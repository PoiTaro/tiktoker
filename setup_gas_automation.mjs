import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

/**
 * Google Apps Script (GAS) 自動デプロイ＆設定スクリプト
 * Puppeteer でブラウザを起動し、Google Apps Script にアクセスして全自動設定・デプロイします。
 */

const CODE_GS_PATH = path.resolve("./gas/Code.gs");
const CODE_GS_CONTENT = fs.readFileSync(CODE_GS_PATH, 'utf8');
const USER_DATA_DIR = path.resolve("C:/Users/takes/.gemini/antigravity/chrome_profile_gas");

(async () => {
  console.log("🚀 [GAS 自動デプロイ] ブラウザを起動しています...");

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    userDataDir: USER_DATA_DIR,
    args: [
      '--start-maximized',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const page = (await browser.pages())[0] || await browser.newPage();

  console.log("🌐 Google Apps Script ホームにアクセスしています...");
  await page.goto('https://script.google.com/home', { waitUntil: 'networkidle2' });

  // ログイン確認のループ
  console.log("⏳ ログイン状態を確認中... (もしログイン画面が表示されている場合は、Googleアカウントにログインしてください)");
  
  while (true) {
    const url = page.url();
    if (url.includes('script.google.com/home') || url.includes('script.google.com/d/')) {
      console.log("✓ Google Apps Script にログイン済みであることを確認しました！");
      break;
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  // 「新しいプロジェクト」を作成する画面へ移動
  console.log("✨ 新しい GAS プロジェクトを作成しています...");
  await page.goto('https://script.google.com/home/projects/create', { waitUntil: 'networkidle2' });

  // エディタ画面が開くのを待機
  console.log("⏳ エディタ画面の読み込みをお待ちしています...");
  await page.waitForSelector('.monaco-editor', { timeout: 60000 });
  await new Promise(r => setTimeout(r, 3500)); // エディタ完全初期化待機

  console.log("📝 Code.gs にバックエンドコードを入力しています...");
  
  // Monaco Editor を書き換え
  await page.evaluate((codeContent) => {
    if (window.monaco && monaco.editor.getModels().length > 0) {
      monaco.editor.getModels()[0].setValue(codeContent);
    }
  }, CODE_GS_CONTENT);

  // 保存 (Ctrl + S)
  console.log("💾 プロジェクトを保存しています...");
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyS');
  await page.keyboard.up('Control');
  await new Promise(r => setTimeout(r, 2500));

  // プロジェクト名を変更
  console.log("🏷️ プロジェクト名を『爆モテ動画制作コントローラー GAS API』に変更しています...");
  try {
    const titleSelector = 'input[aria-label="プロジェクトのタイトル"], div[aria-label="プロジェクト名"]';
    await page.waitForSelector(titleSelector, { timeout: 5000 });
    await page.click(titleSelector);
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.type("爆モテ動画制作コントローラー GAS API");
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 1500));
  } catch (e) {
    console.log("⚠️ プロジェクト名変更スキップ");
  }

  // 初期化関数 (setupMyPropertiesOnce) を実行してスクリプトプロパティを設定
  console.log("🔑 setupMyPropertiesOnce を実行し、GITHUB_TOKEN プロパティを自動登録します...");
  try {
    // ツールバーの「実行」ボタンをクリック
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
      const runBtn = buttons.find(b => b.textContent && (b.textContent.trim() === '実行' || b.textContent.trim() === 'Run'));
      if (runBtn) runBtn.click();
    });
    await new Promise(r => setTimeout(r, 4000));
    
    // 承認が必要な場合のメッセージ
    console.log("💡 (注意) 「権限の確認」や「アクセスを承認」のポップアップが出た場合は、画面上で「許可」を押してください！");
  } catch (e) {
    console.log("⚠️ 実行ボタンクリックをスキップ");
  }

  console.log("\n==========================================================");
  console.log("📢 【ユーザー様へご案内】");
  console.log("エディタ画面が開いています！");
  console.log("もし「権限の確認」画面が出ている場合は、自分のアカウントを選択し「許可」をクリックしてください。");
  console.log("その後、画面右上の青い「デプロイ」->「新しいデプロイ」->「種類の選択(⚙️): ウェブアプリ」");
  console.log("-> アクセスできるユーザー: 「全員」 を選んでデプロイし、");
  console.log("発行されるウェブアプリの URL をこちらのコンソールまたは Web UI に設定すれば完了です！");
  console.log("自動でウェブアプリ URL の発行を検知して保存します。");
  console.log("==========================================================\n");

  // デプロイボタンも自動クリック試行
  try {
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const deployBtn = buttons.find(b => b.textContent && b.textContent.includes('デプロイ'));
      if (deployBtn) deployBtn.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('span, div, li, button'));
      const newDeployItem = items.find(i => i.textContent && i.textContent.trim() === '新しいデプロイ');
      if (newDeployItem) newDeployItem.click();
    });
  } catch (e) {
    // スキップ
  }

  // URL取得監視・待機ループ
  console.log("⏳ ウェブアプリ URL (`https://script.google.com/macros/s/.../exec`) の発行を監視中...");
  
  let webappUrl = null;
  while (!webappUrl) {
    webappUrl = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
      for (const input of inputs) {
        if (input.value && input.value.includes('/macros/s/') && input.value.endsWith('/exec')) {
          return input.value;
        }
      }
      const match = document.body.innerText.match(/https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec/);
      return match ? match[0] : null;
    });

    if (!webappUrl) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log("\n🎉 【デプロイ成功！ウェブアプリ URL を取得しました】");
  console.log("URL:", webappUrl);

  const indexHtmlPath = path.resolve("./webui/index.html");
  let indexContent = fs.readFileSync(indexHtmlPath, 'utf8');
  indexContent = indexContent.replace(
    /value="https:\/\/script\.google\.com\/macros\/s\/[^"]+"/g,
    `value="${webappUrl}"`
  ).replace(
    'placeholder="https://script.google.com/macros/s/XXXXX/exec"',
    `value="${webappUrl}" placeholder="https://script.google.com/macros/s/XXXXX/exec"`
  );
  fs.writeFileSync(indexHtmlPath, indexContent, 'utf8');

  const appJsPath = path.resolve("./webui/app.js");
  let appJsContent = fs.readFileSync(appJsPath, 'utf8');
  appJsContent = appJsContent.replace(
    /localStorage\.getItem\("bakumote_gas_url"\) \|\| "[^"]*"/g,
    `localStorage.getItem("bakumote_gas_url") || "${webappUrl}"`
  );
  fs.writeFileSync(appJsPath, appJsContent, 'utf8');

  console.log("✓ webui/index.html と webui/app.js に自動埋め込み完了！");
  
  await new Promise(r => setTimeout(r, 10000));
  await browser.close();
})();
