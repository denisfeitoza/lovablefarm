const { chromium } = require('playwright');

(async () => {
  console.log('🧪 Testando modo incógnito...\n');
  
  // Exatamente como você mostrou
  const browser = await chromium.launch({
    headless: false,
    args: ['--incognito']
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://www.google.com');

  // Verificar se está em incógnito através de JavaScript
  const isIncognito = await page.evaluate(() => {
    // Tentar detectar características de incógnito
    return new Promise((resolve) => {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        navigator.storage.estimate().then(estimate => {
          // Em modo incógnito, o quota geralmente é menor
          const quota = estimate.quota || 0;
          const isIncognito = quota < 120000000; // Menos de 120MB geralmente = incógnito
          resolve({ isIncognito, quota });
        });
      } else {
        resolve({ isIncognito: 'unknown', quota: 0 });
      }
    });
  });

  console.log('✅ Navegador aberto em modo anônimo');
  console.log('📊 Detecção de incógnito:', isIncognito);
  console.log('\n⏳ Aguarde 10 segundos para você verificar visualmente...');
  
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  await browser.close();
  console.log('✅ Teste concluído');
})();
