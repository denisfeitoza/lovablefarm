import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';

/**
 * Fluxo completo na plataforma Lovable - OTIMIZADO
 * Sem scrolls, sem screenshots, direto ao ponto
 */

/**
 * Etapa 1: Cadastro rápido
 */
export async function signupOnLovable(page, email, password, userId = 1, referralLink) {
  const startTime = Date.now();
  
  if (!referralLink) throw new Error('Link de indicação é obrigatório');
  
  try {
    logger.step(1, 'Cadastro na Lovable');
    
    await page.goto(referralLink, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    logger.success('✅ Página carregada');

    // DIRETO para #email
    const emailInput = await page.waitForSelector('#email', { timeout: 15000, state: 'visible' });
    await emailInput.click();
    await page.waitForTimeout(200);
    await emailInput.fill(email);
    await page.waitForTimeout(400);
    logger.success('✅ Email preenchido');

    // Clicar em Continuar (não Google/Gmail)
    logger.info('Procurando botão Continuar...');
    
    // Usar evaluate para clicar diretamente via JS (mais estável)
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const continueBtn = buttons.find(btn => {
        const text = btn.textContent.trim();
        return (text === 'Continuar' || text === 'Continue') && 
               !text.includes('Google') && !text.includes('Gmail') && !text.includes('GitHub');
      });
      
      if (continueBtn) {
        continueBtn.click();
        return true;
      }
      return false;
    });

    if (!clicked) {
      throw new Error('❌ Botão Continuar não encontrado');
    }
    
    await page.waitForTimeout(1500);
    logger.success('✅ Clicou em Continuar');

    // DIRETO para input[type="password"]
    const passwordInput = await page.waitForSelector('input[type="password"]', { timeout: 20000, state: 'visible' });
    await passwordInput.click();
    await page.waitForTimeout(200);
    await passwordInput.fill(password);
    await page.waitForTimeout(100); // Mínimo delay
    logger.success('✅ Senha preenchida');

    // CLIQUE INSTANTÂNEO em Create/Criar (múltiplos seletores)
    logger.info('Procurando botão Create/Criar...');
    
    const createSelectors = [
      'button:has-text("Create")',
      'button:has-text("Criar")',
      'button:has-text("Criar sua conta")',
      'button:has-text("Create account")',
      'button:has-text("Sign up")',
      'button[type="submit"]'
    ];
    
    let createButton = null;
    for (const selector of createSelectors) {
      try {
        createButton = await page.waitForSelector(selector, { timeout: 2000, state: 'visible' });
        if (createButton) {
          logger.info(`✅ Botão encontrado com seletor: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!createButton) {
      throw new Error('❌ Botão Create/Criar não encontrado');
    }
    
    await createButton.click();
    logger.success('✅ Clicou em Create');

    await page.waitForTimeout(2000);

    const executionTime = Date.now() - startTime;
    logger.success(`✅ Cadastro concluído em ${executionTime}ms`);

    return { success: true, executionTime };
  } catch (error) {
    logger.error('❌ Erro no cadastro', error);
    throw error;
  }
}

/**
 * Etapa 2: Verificar email
 */
export async function verifyEmailInSameSession(page, verificationLink, userId = 1) {
  const startTime = Date.now();
  
  try {
    logger.step(2, 'Verificando email');

    const isValidLink = verificationLink.includes('lovable.dev') && 
                        (verificationLink.includes('verify') || verificationLink.includes('auth/action'));
    
    if (!isValidLink) throw new Error(`❌ Link inválido`);

    logger.info('Clicando no link de verificação...');
    await page.goto(verificationLink, { waitUntil: 'domcontentloaded', timeout: 30000 });

    logger.info('⏳ Aguardando loading e redirect...');
    
    // Aguardar a URL mudar (sinal de redirect completado)
    await page.waitForURL(url => {
      const urlStr = url.toString();
      // Quando NÃO for mais auth/action ou verify-email = redirect completou
      return !urlStr.includes('auth/action') && !urlStr.includes('verify-email');
    }, { timeout: 10000 });
    
    const finalUrl = page.url();
    logger.success(`✅ Redirect completado! URL: ${finalUrl}`);

    const executionTime = Date.now() - startTime;
    logger.success(`✅ Email verificado em ${executionTime}ms`);

    return { success: true, executionTime };
  } catch (error) {
    logger.error('❌ Erro na verificação', error);
    logger.error(`URL atual: ${page.url()}`);
    throw error;
  }
}

/**
 * Etapa 3: Ir direto para o template
 */
export async function goToTemplate(page, userId = 1) {
  const startTime = Date.now();
  
  try {
    logger.step(3, 'Indo para template');

    const templateToUse = config.templateUrls && config.templateUrls.length > 0
      ? config.templateUrls[Math.floor(Math.random() * config.templateUrls.length)]
      : config.templateProjectUrl;

    logger.info(`Navegando para: ${templateToUse}`);
    
    await page.goto(templateToUse, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    logger.info(`✅ Template carregado! URL: ${page.url()}`);
    logger.info('⏳ Aguardando botão "Use Template"...');
    
    await page.waitForSelector('button:has-text("Use Template"), button:has-text("Usar Template")', { 
      state: 'visible', 
      timeout: 20000 
    });
    
    logger.success('✅ Botão "Use Template" encontrado!');

    const executionTime = Date.now() - startTime;
    return { success: true, executionTime };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logger.error('❌ Erro ao carregar template', error);
    logger.error(`URL: ${page.url()}`);
    throw error;
  }
}

/**
 * Etapa 4: Usar template e publicar
 */
export async function useTemplateAndPublish(page, userId = 1) {
  const startTime = Date.now();
  
  try {
    logger.step(4, 'Usando template e publicando');

    // Clicar em Use Template
    const useTemplateButton = await page.waitForSelector('button:has-text("Use Template"), button:has-text("Usar Template")', {
      state: 'visible',
      timeout: 15000
    });
    
    await useTemplateButton.click();
    logger.success('✅ Clicou em Usar Template');

    // Aguardar e clicar em Remix se aparecer
    try {
      const remixButton = await page.waitForSelector('button:has-text("Remix"), button:has-text("Remixar")', {
        state: 'visible',
        timeout: 5000
      });
      await remixButton.click();
      logger.success('✅ Clicou em Remix');
    } catch (e) {
      logger.info('⚠️ Remix não encontrado (opcional)');
    }

    // Aguardar editor carregar
    await page.waitForSelector('button:has-text("Publish"), button:has-text("Publicar")', { 
      state: 'visible', 
      timeout: 20000 
    });
    logger.success('✅ Editor carregado');

    // Clicar em Publish
    const publishButton = await page.waitForSelector('button:has-text("Publish"), button:has-text("Publicar")', {
      state: 'visible',
      timeout: 10000
    });
    
    await publishButton.click();
    logger.success('✅ Clicou em Publish');

    await page.waitForTimeout(500);

    // Clicar no segundo botão Publish (dropdown)
    try {
      const allPublishButtons = await page.locator('button:has-text("Publish")').all();
      if (allPublishButtons.length > 1) {
        for (let i = 1; i < allPublishButtons.length; i++) {
          if (await allPublishButtons[i].isVisible()) {
            await allPublishButtons[i].click();
            logger.success('✅ Clicou em Publish (dropdown)');
            break;
          }
        }
      }
    } catch (e) {
      logger.warning('⚠️ Dropdown não encontrado');
    }

    // Aguardar publicação
    logger.info('⏳ Aguardando publicação...');
    await page.waitForTimeout(5000);

    // Verificar se ainda está processando
    let isProcessing = true;
    let maxWait = 10000;
    const startWait = Date.now();
    
    while (isProcessing && (Date.now() - startWait) < maxWait) {
      const hasSpinner = await page.locator('[class*="spin"], [class*="load"], [role="progressbar"]').first().isVisible({ timeout: 500 }).catch(() => false);
      const hasProcessingText = await page.locator('text=/processing|publicando|deploying/i').first().isVisible({ timeout: 500 }).catch(() => false);
      
      if (!hasSpinner && !hasProcessingText) {
        isProcessing = false;
        logger.success(`✅ Processamento finalizado`);
        break;
      }
      
      await page.waitForTimeout(1000);
    }

    await page.waitForTimeout(2000); // Segurança
    logger.success('✅ Publicação concluída!');

    const executionTime = Date.now() - startTime;
    logger.success(`✅ Template publicado em ${executionTime}ms`);

    return { success: true, executionTime };
  } catch (error) {
    logger.error('❌ Erro ao publicar', error);
    throw error;
  }
}
