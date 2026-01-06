/**
 * Teste rápido com credenciais específicas
 */

import { chromium } from 'playwright';
import { logger } from './src/utils/logger.js';
import { loginToLovable, checkPublishedProjects, findCreditsBanner } from './src/automation/lovableFlow.js';
import path from 'path';
import fs from 'fs';

// Credenciais fornecidas
const email = 'fideliaalvaerica8@hotmail.com';
const password = 'HshVmnVwp3';

// Garantir que o diretório reports existe
const reportsDir = path.join(process.cwd(), 'reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

async function testSpecificAccount() {
  console.log('════════════════════════════════════════════════════════');
  console.log('        🧪 TESTE: Conta Específica                      ');
  console.log('════════════════════════════════════════════════════════\n');

  logger.info(`📧 Email: ${email}`);
  logger.info(`🔧 Modo de teste ATIVADO\n`);

  // Iniciar navegador
  logger.info('🌐 Iniciando navegador...');
  const browser = await chromium.launch({
    headless: false, // Mostrar navegador
    slowMo: 300 // Desacelerar um pouco
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();
  
  try {
    // 1. Testar login
    logger.info('\n════════════════════════════════════════════════════════');
    logger.info('ETAPA 1: Login no Lovable');
    logger.info('════════════════════════════════════════════════════════\n');
    
    const loginResult = await loginToLovable(page, email, password, false, true); // testMode = true
    
    if (!loginResult.success) {
      logger.error('❌ Login falhou');
      return;
    }
    
    logger.success(`✅ Login bem-sucedido em ${loginResult.executionTime}ms`);

    // 2. Verificar projetos
    logger.info('\n════════════════════════════════════════════════════════');
    logger.info('ETAPA 2: Verificação de Projetos Publicados');
    logger.info('════════════════════════════════════════════════════════\n');
    
    const projectsInfo = await checkPublishedProjects(page, false, true); // testMode = true
    
    logger.info(`📊 Resultado:`);
    logger.info(`   - Tem projeto publicado: ${projectsInfo.hasPublishedProject ? 'Sim' : 'Não'}`);
    logger.info(`   - Total de projetos: ${projectsInfo.count}`);
    logger.info(`   - Projetos publicados: ${projectsInfo.publishedCount}`);
    
    if (projectsInfo.projects.length > 0) {
      logger.info(`   - Links encontrados:`);
      projectsInfo.projects.slice(0, 5).forEach((project, idx) => {
        logger.info(`     ${idx + 1}. ${project.text || 'Sem texto'} - ${project.href}`);
      });
    }

    // 3. Procurar banner de créditos
    logger.info('\n════════════════════════════════════════════════════════');
    logger.info('ETAPA 3: Busca de Banner de Créditos');
    logger.info('════════════════════════════════════════════════════════\n');
    
    const bannerInfo = await findCreditsBanner(page, false, true); // testMode = true
    
    logger.info(`📊 Resultado:`);
    logger.info(`   - Banner encontrado: ${bannerInfo.found ? 'Sim ✅' : 'Não ❌'}`);
    
    if (bannerInfo.found) {
      logger.success(`🎉 Banner de créditos encontrado!`);
      logger.info(`📝 Texto do banner: ${bannerInfo.bannerText.substring(0, 300)}`);
    } else {
      logger.warning(`⚠️ Banner de créditos não encontrado`);
      logger.info(`💡 Isso pode significar que:`);
      logger.info(`   - A conta já recebeu os créditos`);
      logger.info(`   - O banner não está visível no momento`);
      logger.info(`   - A conta não está elegível para créditos`);
    }

    logger.info('\n════════════════════════════════════════════════════════');
    logger.success('✅ TESTE CONCLUÍDO COM SUCESSO!');
    logger.info('════════════════════════════════════════════════════════\n');

    // Manter navegador aberto por mais tempo para visualizar
    logger.info('⏳ Mantendo navegador aberto por 10 segundos para visualização...');
    await page.waitForTimeout(10000);

  } catch (error) {
    logger.error(`❌ Erro durante o teste: ${error.message}`);
    
    // Manter navegador aberto para debug
    logger.info('⏳ Mantendo navegador aberto por 10 segundos para debug...');
    await page.waitForTimeout(10000);
  } finally {
    await browser.close();
    logger.info('🧹 Navegador fechado');
  }
}

// Executar teste
testSpecificAccount().catch(error => {
  logger.error('❌ Erro fatal no teste:', error);
  process.exit(1);
});

