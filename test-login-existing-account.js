/**
 * Script de teste para login em conta existente e verificação de banner de créditos
 * 
 * Este script testa:
 * 1. Detecção de conta existente
 * 2. Login automático
 * 3. Verificação de projetos publicados
 * 4. Busca de banner de créditos
 */

import { chromium } from 'playwright';
import { logger } from './src/utils/logger.js';
import { config } from './src/utils/config.js';
import { outlookCredentialsService } from './src/services/outlookCredentialsService.js';
import { loginToLovable, checkPublishedProjects, findCreditsBanner } from './src/automation/lovableFlow.js';
import { getTimeout, getDelay } from './src/utils/timeouts.js';
import path from 'path';
import fs from 'fs';

// Garantir que o diretório reports existe
const reportsDir = path.join(process.cwd(), 'reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
  logger.info('📁 Diretório reports criado');
}

async function testLoginExistingAccount() {
  console.log('════════════════════════════════════════════════════════');
  console.log('        🧪 TESTE: Login em Conta Existente              ');
  console.log('════════════════════════════════════════════════════════\n');

  // 1. Obter credencial Outlook (pode ser uma já usada)
  logger.info('📧 Obtendo credencial Outlook...');
  const allCredentials = outlookCredentialsService.loadCredentials();
  
  if (allCredentials.length === 0) {
    logger.error('❌ Nenhuma credencial Outlook encontrada. Adicione credenciais primeiro.');
    return;
  }

  // Usar a primeira credencial disponível (mesmo que esteja marcada como usada)
  const credential = allCredentials[0];
  const email = credential.email;
  const password = credential.password;
  
  logger.info(`📧 Usando credencial: ${email}`);
  logger.info(`📊 Status: ${credential.used ? 'Usada' : 'Disponível'}`);
  logger.info(`\n🔧 Modo de teste ATIVADO`);
  logger.info(`💡 Nota: Se a senha estiver incorreta, o teste ainda funcionará mas mostrará erro de login\n`);
  
  // Perguntar se quer continuar
  logger.info('⚠️  ATENÇÃO: Este teste tentará fazer login com a credencial acima.\n');

  // 2. Iniciar navegador
  logger.info('🌐 Iniciando navegador...');
  const browser = await chromium.launch({
    headless: false, // Mostrar navegador para visualizar o teste
    slowMo: 500 // Desacelerar para visualizar melhor
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();
  
  try {
    // 3. Testar login
    logger.info('\n════════════════════════════════════════════════════════');
    logger.info('ETAPA 1: Login no Lovable');
    logger.info('════════════════════════════════════════════════════════\n');
    
    const loginResult = await loginToLovable(page, email, password, false, true); // testMode = true
    
    if (!loginResult.success) {
      logger.error('❌ Login falhou');
      return;
    }
    
    logger.success(`✅ Login bem-sucedido em ${loginResult.executionTime}ms`);

    // 4. Verificar projetos
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
      projectsInfo.projects.slice(0, 3).forEach((project, idx) => {
        logger.info(`     ${idx + 1}. ${project.text || 'Sem texto'} - ${project.href}`);
      });
    }

    // 5. Procurar banner de créditos (só se não tiver projeto publicado)
    if (!projectsInfo.hasPublishedProject) {
      logger.info('\n════════════════════════════════════════════════════════');
      logger.info('ETAPA 3: Busca de Banner de Créditos');
      logger.info('════════════════════════════════════════════════════════\n');
      
      const bannerInfo = await findCreditsBanner(page, false, true); // testMode = true
      
      logger.info(`📊 Resultado:`);
      logger.info(`   - Banner encontrado: ${bannerInfo.found ? 'Sim' : 'Não'}`);
      
      if (bannerInfo.found) {
        logger.success(`🎉 Banner de créditos encontrado!`);
        logger.info(`📝 Texto do banner: ${bannerInfo.bannerText.substring(0, 200)}`);
      } else {
        logger.warning(`⚠️ Banner de créditos não encontrado`);
      }
    } else {
      logger.info('\n════════════════════════════════════════════════════════');
      logger.info('ETAPA 3: Busca de Banner de Créditos');
      logger.info('════════════════════════════════════════════════════════\n');
      logger.info('⏭️  Pulando busca de banner - conta já tem projeto publicado');
    }

    logger.info('\n════════════════════════════════════════════════════════');
    logger.success('✅ TESTE CONCLUÍDO COM SUCESSO!');
    logger.info('════════════════════════════════════════════════════════\n');

  } catch (error) {
    logger.error(`❌ Erro durante o teste: ${error.message}`);
    logger.error(error.stack);
  } finally {
    // Manter navegador aberto por 5 segundos para visualizar
    logger.info('⏳ Mantendo navegador aberto por 5 segundos para visualização...');
    await page.waitForTimeout(5000);
    
    await browser.close();
    logger.info('🧹 Navegador fechado');
  }
}

// Executar teste
testLoginExistingAccount().catch(error => {
  logger.error('❌ Erro fatal no teste:', error);
  process.exit(1);
});

