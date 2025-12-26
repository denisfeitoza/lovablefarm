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
 * Etapa 3: Completar o quiz de onboarding
 */
export async function completeOnboardingQuiz(page, userId = 1) {
  const startTime = Date.now();
  
  try {
    logger.step(3, 'Completando quiz de onboarding');

    // Aguardar a página carregar
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // 1. Escolher modo (Light ou Dark) - aleatório
    logger.info('1️⃣ Escolhendo modo (Light/Dark)...');
    const modes = ['Light', 'Dark'];
    const selectedMode = modes[Math.floor(Math.random() * modes.length)];
    logger.info(`Modo escolhido: ${selectedMode}`);
    
    // Aguardar a página do quiz aparecer
    await page.waitForSelector('text="Pick your style", text="Light", text="Dark"', { timeout: 10000 });
    logger.info('Quiz de estilo encontrado');
    
    // Usar JavaScript para clicar (mais confiável)
    const modeClicked = await page.evaluate((mode) => {
      // Procurar por todos os elementos que contêm o texto
      const elements = Array.from(document.querySelectorAll('*'));
      
      for (const el of elements) {
        // Verificar se o elemento ou seus filhos contêm o texto exato
        const text = el.textContent?.trim();
        if (text === mode) {
          // Tentar clicar no elemento ou em seu parent
          const clickable = el.closest('button, [role="button"], div[onclick], a') || el;
          if (clickable) {
            clickable.click();
            console.log('Clicou em:', mode, 'via', clickable.tagName);
            return true;
          }
        }
      }
      
      // Tentar uma abordagem mais agressiva - procurar qualquer coisa com o texto
      const allText = document.body.innerText;
      if (allText.includes(mode)) {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node;
        while (node = walker.nextNode()) {
          if (node.textContent?.trim() === mode) {
            const parent = node.parentElement;
            if (parent) {
              parent.click();
              console.log('Clicou via text node parent');
              return true;
            }
          }
        }
      }
      
      return false;
    }, selectedMode);
    
    if (!modeClicked) {
      logger.error('❌ Não conseguiu clicar no modo. Tentando forçar...');
      // Última tentativa - clicar em qualquer elemento visível que contenha o texto
      try {
        await page.locator(`text="${selectedMode}"`).first().click({ force: true, timeout: 3000 });
        logger.success('✅ Modo clicado (forçado)');
      } catch (e) {
        throw new Error(`Não foi possível clicar no modo ${selectedMode}`);
      }
    } else {
      logger.success(`✅ Modo ${selectedMode} selecionado`);
    }
    
    // Aguardar transição automática
    await page.waitForTimeout(2500);

    // 2. Preencher nome
    logger.info('2️⃣ Preenchendo nome...');
    const names = ['Alex Silva', 'Maria Santos', 'João Oliveira', 'Ana Costa', 'Pedro Lima', 'Julia Souza'];
    const randomName = names[Math.floor(Math.random() * names.length)];
    
    // Aguardar campo de nome aparecer
    await page.waitForSelector('input[type="text"], input[placeholder*="name" i]', { timeout: 5000 });
    
    const nameInput = page.locator('input[type="text"], input[placeholder*="name" i]').first();
    await nameInput.fill(randomName);
    logger.info(`Nome preenchido: ${randomName}`);
    
    // Clicar em Next
    await page.waitForTimeout(1000);
    const nextButton1 = page.locator('button:has-text("Next")').first();
    await nextButton1.click();
    logger.success('✅ Nome confirmado');
    
    await page.waitForTimeout(2000);

    // 3. Escolher profissão (role) - sempre Other
    logger.info('3️⃣ Escolhendo profissão...');
    const selectedRole = 'Other';
    logger.info(`Profissão escolhida: ${selectedRole}`);
    
    // Aguardar opções de role aparecerem
    await page.waitForTimeout(1500);
    
    // Usar JavaScript para clicar
    const roleClicked = await page.evaluate((role) => {
      const elements = Array.from(document.querySelectorAll('*'));
      for (const el of elements) {
        const text = el.textContent?.trim();
        if (text === role) {
          const clickable = el.closest('button, [role="button"], div[onclick], a') || el;
          if (clickable) {
            clickable.click();
            return true;
          }
        }
      }
      return false;
    }, selectedRole);
    
    if (!roleClicked) {
      logger.warning('Tentando forçar clique na profissão...');
      await page.locator(`text="${selectedRole}"`).first().click({ force: true });
    }
    
    logger.success('✅ Profissão selecionada');
    await page.waitForTimeout(2000);

    // 4. Escolher tamanho da empresa - aleatório
    logger.info('4️⃣ Escolhendo tamanho da empresa...');
    const companySizes = ['Solo', '2 - 20', '21 - 200', '200+'];
    const selectedSize = companySizes[Math.floor(Math.random() * companySizes.length)];
    logger.info(`Tamanho escolhido: ${selectedSize}`);
    
    await page.waitForTimeout(1000);
    
    // Usar JavaScript para clicar
    const sizeClicked = await page.evaluate((size) => {
      const elements = Array.from(document.querySelectorAll('*'));
      for (const el of elements) {
        const text = el.textContent?.trim();
        if (text === size) {
          const clickable = el.closest('button, [role="button"], div[onclick], a') || el;
          if (clickable) {
            clickable.click();
            return true;
          }
        }
      }
      return false;
    }, selectedSize);
    
    if (!sizeClicked) {
      logger.warning('Tentando forçar clique no tamanho...');
      await page.locator(`text="${selectedSize}"`).first().click({ force: true });
    }
    
    logger.success('✅ Tamanho selecionado');

    // 5. Aguardar mensagem de confirmação de créditos
    logger.info('5️⃣ Aguardando confirmação de créditos...');
    await page.waitForSelector('text="+10 credits", text="10 credits"', { timeout: 15000 });
    logger.success('✅ Mensagem de créditos encontrada!');

    await page.waitForTimeout(1500);

    // 6. Clicar em Continue
    logger.info('6️⃣ Clicando em Continue...');
    const continueButton = page.locator('button:has-text("Continue")').first();
    await continueButton.click();
    logger.success('✅ Quiz completado!');

    // Aguardar dashboard carregar
    await page.waitForTimeout(4000);

    const executionTime = Date.now() - startTime;
    logger.success(`✅ Onboarding completado em ${executionTime}ms`);
    return { success: true, executionTime };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logger.error('❌ Erro ao completar quiz', error);
    logger.error(`URL atual: ${page.url()}`);
    
    // Tirar screenshot para debug
    try {
      await page.screenshot({ 
        path: `reports/quiz-error-${userId}-${Date.now()}.png`,
        fullPage: true 
      });
      logger.info('📸 Screenshot salvo em reports/');
    } catch (e) {
      // Ignorar erro de screenshot
    }
    
    throw error;
  }
}

/**
 * Etapa 4: Escolher template
 */
export async function selectTemplate(page, userId = 1) {
  const startTime = Date.now();
  
  try {
    logger.step(4, 'Escolhendo template');

    // Templates a evitar
    const avoidTemplates = [
      'Visual landing page',
      'Photographer portfolio',
      'Personal portfolio',
      'Visual gallery'
    ];

    logger.info('Procurando templates disponíveis...');
    
    // Aguardar seção de templates
    await page.waitForSelector('text="Templates"', { timeout: 10000 });
    
    // Rolar para baixo para ver os templates
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    // Buscar todos os templates disponíveis
    const templateCards = await page.locator('[role="link"], a').filter({ 
      has: page.locator('text=/Architect portfolio|Ecommerce store|Event platform|Lifestyle Blog|Architecture blog|Fashion magazine|Fashion blog|Personal blog/i')
    }).all();

    if (templateCards.length === 0) {
      throw new Error('Nenhum template encontrado');
    }

    logger.info(`📋 ${templateCards.length} templates encontrados`);

    // Escolher um template aleatório (que não esteja na lista de evitar)
    let selectedTemplate = null;
    let attempts = 0;
    const maxAttempts = 10;

    while (!selectedTemplate && attempts < maxAttempts) {
      const randomIndex = Math.floor(Math.random() * templateCards.length);
      const template = templateCards[randomIndex];
      const templateText = await template.textContent();
      
      // Verificar se não está na lista de evitar
      const shouldAvoid = avoidTemplates.some(avoid => templateText.includes(avoid));
      
      if (!shouldAvoid) {
        selectedTemplate = template;
        logger.info(`✅ Template escolhido: ${templateText.substring(0, 50)}...`);
      }
      
      attempts++;
    }

    if (!selectedTemplate) {
      // Se não encontrou nenhum válido, pega qualquer um
      selectedTemplate = templateCards[Math.floor(Math.random() * templateCards.length)];
      logger.warning('⚠️ Usando template aleatório (não foi possível evitar os especificados)');
    }

    // Clicar no template
    await selectedTemplate.click();
    logger.info('Aguardando template abrir...');
    
    await page.waitForTimeout(3000);

    // Aguardar e clicar em "Use template"
    logger.info('Procurando botão "Use template"...');
    await page.waitForSelector('button:has-text("Use template")', { timeout: 15000 });
    
    const useTemplateButton = await page.locator('button:has-text("Use template")').first();
    await useTemplateButton.click();
    logger.success('✅ Clicou em "Use template"');

    await page.waitForTimeout(3000);

    const executionTime = Date.now() - startTime;
    logger.success(`✅ Template selecionado em ${executionTime}ms`);
    return { success: true, executionTime };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logger.error('❌ Erro ao selecionar template', error);
    logger.error(`URL: ${page.url()}`);
    throw error;
  }
}

/**
 * Etapa 5: Publicar projeto
 */
export async function useTemplateAndPublish(page, userId = 1) {
  const startTime = Date.now();
  
  try {
    logger.step(5, 'Publicando projeto');

    // Aguardar editor carregar (após clicar em Use Template na etapa anterior)
    logger.info('⏳ Aguardando editor carregar...');
    await page.waitForSelector('button:has-text("Publish"), button:has-text("Publicar")', { 
      state: 'visible', 
      timeout: 30000 
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
