#!/usr/bin/env node

/**
 * 🧪 Script de Teste - Login Outlook
 * 
 * Testa apenas o login no Outlook e mantém navegador aberto por 1 minuto
 */

import { chromium } from 'playwright';
import { loginToOutlook } from './src/automation/outlookLogin.js';
import { outlookCredentialsService } from './src/services/outlookCredentialsService.js';
import { logger } from './src/utils/logger.js';
import { config } from './src/utils/config.js';
import os from 'os';
import path from 'path';
import fs from 'fs';

async function main() {
  console.clear();
  console.log('🧪 TESTE DE LOGIN OUTLOOK\n');
  console.log('='.repeat(60));
  
  // 1. Obter todas as credenciais e pegar a 4ª (índice 3)
  const allCredentials = outlookCredentialsService.loadCredentials();
  const unusedCredentials = allCredentials.filter(c => !c.used);
  
  if (unusedCredentials.length === 0) {
    console.error('❌ Nenhuma credencial Outlook disponível!');
    console.log('\n💡 Adicione credenciais através da interface web ou API.');
    process.exit(1);
  }
  
  // Pegar a 2ª credencial (índice 1) para testar
  const credentialIndex = 1;
  const credential = unusedCredentials[credentialIndex];
  
  console.log(`✅ Usando credencial ${credentialIndex + 1} de ${unusedCredentials.length}: ${credential.email}`);
  console.log('='.repeat(60));
  console.log('\n🚀 Iniciando teste de login...\n');
  
  let context = null;
  let page = null;
  let tempDir = null;
  
  try {
    // 2. Criar diretório temporário
    tempDir = path.join(os.tmpdir(), `playwright-test-outlook-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    logger.info(`📁 Diretório temporário: ${tempDir}`);
    
    // 3. Iniciar navegador
    logger.info('🌐 Iniciando navegador...');
    const contextOptions = {
      headless: false, // SEMPRE visível para teste
      args: ['--incognito']
    };
    
    context = await chromium.launchPersistentContext(tempDir, contextOptions);
    
    // Fechar páginas extras
    const pages = context.pages();
    for (let i = 1; i < pages.length; i++) {
      await pages[i].close().catch(() => {});
    }
    
    page = context.pages()[0] || await context.newPage();
    logger.info('✅ Navegador iniciado');
    
    // 4. Executar login
    const result = await loginToOutlook(page, credential.email, credential.password, false);
    
    // 5. Mostrar resultado
    console.log('\n' + '='.repeat(60));
    if (result.success) {
      console.log('✅ LOGIN CONCLUÍDO COM SUCESSO!');
      console.log(`📍 URL: ${result.url}`);
      console.log(`⏱️  Tempo: ${(result.executionTime / 1000).toFixed(2)}s`);
      if (result.hasPopup) {
        console.log('📋 Popup detectado na página');
      }
    } else {
      console.log('❌ LOGIN FALHOU');
      console.log(`❌ Erro: ${result.error}`);
    }
    console.log('='.repeat(60));
    
    // 6. Manter navegador aberto por 1 minuto (já está no código do loginToOutlook)
    // O delay já está no loginToOutlook, então só mostramos mensagem aqui
    if (result.success) {
      console.log('\n⏸️  Navegador ficará aberto por 60 segundos para inspeção...');
      console.log('👀 Você pode verificar o estado da página e me dar o próximo passo');
      console.log('⏳ Aguardando 60 segundos...\n');
      
      // Aguardar apenas se a página ainda estiver aberta
      try {
        if (page && !page.isClosed()) {
          await page.waitForTimeout(60000);
          console.log('\n✅ Tempo de inspeção concluído!');
        }
      } catch (e) {
        console.log('\n⚠️ Navegador foi fechado durante a inspeção');
      }
    }
    
  } catch (error) {
    logger.error(`❌ Erro no teste: ${error.message}`);
    console.error(error);
  } finally {
    // Fechar navegador
    if (context) {
      console.log('\n🧹 Fechando navegador...');
      await context.close().catch(() => {});
    }
    
    // Limpar diretório temporário
    if (tempDir) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
        logger.info('🧹 Diretório temporário removido');
      } catch (e) {
        logger.warning(`⚠️ Não foi possível remover o diretório: ${e.message}`);
      }
    }
    
    console.log('\n✅ Teste finalizado!');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});

