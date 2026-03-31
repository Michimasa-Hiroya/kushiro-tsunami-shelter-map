const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14
    deviceScaleFactor: 2,
    locale: 'ja-JP',
  });
  const page = await ctx.newPage();

  // Firebase エラーを無視
  page.on('pageerror', () => {});
  page.on('console', () => {});

  await page.goto('http://localhost:8787/', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const dir = 'c:/Users/User/Desktop/避難所アプリ/howto-imgs';
  const fs = require('fs');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  // Step1: ホーム画面全体
  await page.screenshot({ path: `${dir}/step1-home.png`, fullPage: false });

  // Step2: シナリオチップをタップしてモーダルを開く
  await page.click('#scenario-chip');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/step2-scenario.png` });
  await page.keyboard.press('Escape');
  await page.click('#settings-close').catch(() => {});
  await page.waitForTimeout(300);

  // Step3: ボトムシートを引き上げて検索エリアを表示
  await page.evaluate(() => {
    document.getElementById('bottom-sheet').style.height = '420px';
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/step3-search.png` });

  // Step4: フィルタータブ (地図上部)
  await page.evaluate(() => {
    document.getElementById('bottom-sheet').style.height = '180px';
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/step4-filter.png` });

  // Step5: メニュー（ドロワー）
  await page.click('#menu-btn');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/step5-menu.png` });
  await page.click('#drawer-overlay').catch(() => {});
  await page.waitForTimeout(300);

  // Step6: 使い方ページ
  await page.evaluate(() => navigateTo('howto'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/step6-howto.png` });

  await browser.close();
  console.log('Screenshots saved to', dir);
})();
