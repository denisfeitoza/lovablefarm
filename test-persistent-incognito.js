import { chromium } from 'playwright';
import os from 'os';
import path from 'path';
import fs from 'fs';

(async () => {
  console.log('🧪 Tentando com launchPersistentContext (modo REAL anônimo)...\n');
  
  // Criar diretório temporário único para cada sessão (simula incógnito)
  const tempDir = path.join(os.tmpdir(), `playwright-incognito-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  
  console.log('📁 Diretório temporário:', tempDir);
  
  const context = await chromium.launchPersistentContext(tempDir, {
    headless: false,
    args: [
      '--incognito',
      '--disable-blink-features=AutomationControlled',
    ]
  });

  const page = await context.pages()[0] || await context.newPage();
  
  await page.goto('https://www.google.com');
  await page.waitForTimeout(2000);

  // Screenshot
  await page.screenshot({ path: 'screenshot-persistent-incognito.png', fullPage: true });
  
  console.log('✅ Screenshot salvo: screenshot-persistent-incognito.png');
  console.log('👁️  Verificando...');
  
  // Manter aberto
  console.log('\n⏳ Navegador aberto. Pressione Ctrl+C para fechar');
  await new Promise(() => {});
})();
