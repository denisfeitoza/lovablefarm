import { chromium } from 'playwright';

(async () => {
  console.log('📸 Abrindo navegador e tirando screenshot...\n');
  
  const browser = await chromium.launch({
    headless: false,
    args: ['--incognito', '--new-window']
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://www.google.com');
  await page.waitForTimeout(2000);

  // Screenshot da página inteira
  await page.screenshot({ path: 'screenshot-incognito-test.png', fullPage: true });
  
  console.log('✅ Screenshot salvo: screenshot-incognito-test.png');
  console.log('🔍 Vou ler o screenshot para você ver...');
  
  await browser.close();
})();
