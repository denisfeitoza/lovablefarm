import { chromium } from 'playwright';

(async () => {
  console.log('🧪 Abrindo navegador em modo incógnito...\n');
  
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--incognito',
      '--start-maximized'
    ]
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://www.google.com');

  console.log('✅ Navegador aberto!');
  console.log('👁️  VERIFIQUE VISUALMENTE:');
  console.log('   - Há um ícone de "óculos escuros" ou "chapéu" no canto superior?');
  console.log('   - A janela está em modo incógnito/privado?');
  console.log('\n⏳ Aguardando... Pressione Ctrl+C quando verificar');
  
  // Manter aberto indefinidamente
  await new Promise(() => {});
})();
