import { chromium } from 'playwright';

(async () => {
  console.log('🧪 Tentativa 1: Usando Chrome do sistema...\n');
  
  try {
    const browser = await chromium.launch({
      headless: false,
      channel: 'chrome', // Usar Chrome instalado no sistema
      args: [
        '--incognito',
        '--new-window'
      ]
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('https://www.google.com');

    console.log('✅ Chrome aberto com --incognito flag');
    console.log('👁️  Verifique se tem o ícone de modo anônimo!');
    console.log('\n⏳ Aguardando... Pressione Ctrl+C quando verificar');
    
    await new Promise(() => {});
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.log('\n🔄 Tentando alternativa...\n');
    
    // Alternativa: tentar com executablePath
    const browser = await chromium.launch({
      headless: false,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: [
        '--incognito',
        '--new-window'
      ]
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('https://www.google.com');

    console.log('✅ Chrome aberto (path direto)');
    console.log('👁️  Verifique se tem o ícone de modo anônimo!');
    
    await new Promise(() => {});
  }
})();
