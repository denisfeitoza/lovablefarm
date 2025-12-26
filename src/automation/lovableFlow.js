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
    await page.waitForTimeout(400);
    logger.success('✅ Senha preenchida');

    // Procurar botão Create/Criar
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

    // 🔥 VERIFICAR se o cadastro foi processado (mudou de página ou apareceu erro)
    logger.info('⏳ Aguardando resposta do servidor...');
    await page.waitForTimeout(3000);
    
    // Verificar se apareceu algum erro/notificação
    const errorDetected = await page.evaluate(() => {
      // Procurar por mensagens de erro ou notificações
      const body = document.body.innerText.toLowerCase();
      const hasConnectionError = body.includes('connection') || 
                                 body.includes('network') || 
                                 body.includes('erro') ||
                                 body.includes('error');
      
      // Verificar se ainda está na mesma página (não avançou)
      const stillOnSignup = document.querySelector('input[type="password"]') !== null;
      
      return {
        hasError: hasConnectionError,
        stillOnPage: stillOnSignup,
        bodyText: body.substring(0, 500)
      };
    });
    
    if (errorDetected.stillOnPage) {
      logger.error('❌ CADASTRO BLOQUEADO! Ainda está na página de signup');
      logger.error(`📝 Texto da página: ${errorDetected.bodyText}`);
      throw new Error('Cadastro bloqueado - possível detecção de automação');
    }
    
    if (errorDetected.hasError) {
      logger.warning('⚠️ Possível erro detectado na página');
      logger.warning(`📝 Texto: ${errorDetected.bodyText}`);
    }
    
    logger.success('✅ Cadastro parece ter sido aceito');

    await page.waitForTimeout(1000);

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
    await page.waitForSelector('text="Pick your style"', { timeout: 10000 });
    logger.info('Quiz de estilo encontrado');
    await page.waitForTimeout(2000);
    
    // ESTRATÉGIA AGRESSIVA: Clicar em TUDO que contenha o texto
    const modeClicked = await page.evaluate((mode) => {
      console.log('🎯 Procurando pelo modo:', mode);
      
      // Estratégia 1: Procurar TODOS os elementos que contêm o texto
      const allElements = Array.from(document.querySelectorAll('*'));
      const candidates = [];
      
      for (const el of allElements) {
        const text = el.textContent?.trim();
        
        // Se contém EXATAMENTE o texto OU contém com no máximo 10 chars a mais
        if (text === mode || (text && text.includes(mode) && text.length <= mode.length + 10)) {
          candidates.push(el);
        }
      }
      
      console.log(`📋 Encontrados ${candidates.length} candidatos para "${mode}"`);
      
      // Ordenar por ÁREA (maior primeiro = bloco visual)
      candidates.sort((a, b) => {
        const areaA = a.getBoundingClientRect().width * a.getBoundingClientRect().height;
        const areaB = b.getBoundingClientRect().width * b.getBoundingClientRect().height;
        return areaB - areaA;
      });
      
      // Tentar clicar em cada candidato, priorizando BLOCOS GRANDES
      for (const el of candidates) {
        let current = el;
        for (let level = 0; level < 15; level++) {
          if (!current || current === document.body) break;
          
          const rect = current.getBoundingClientRect();
          const style = window.getComputedStyle(current);
          const isVisible = rect.width > 30 && rect.height > 30;
          
          if (isVisible) {
            const area = rect.width * rect.height;
            const isLarge = area > 10000; // 100x100+
            const isClickable = style.cursor === 'pointer' || 
                              current.onclick || 
                              current.getAttribute('role') === 'button';
            
            console.log(`🔍 ${level}: ${current.tagName} ${Math.round(rect.width)}x${Math.round(rect.height)} cursor:${style.cursor}`);
            
            // Tentar se for grande, clicável, ou já no nível 3+
            if (isLarge || isClickable || level >= 3) {
              try {
                current.click();
                console.log(`✅ CLICOU ${current.tagName} (nível ${level})`);
                return true;
              } catch (e) {
                console.log(`❌ ${e.message}`);
              }
            }
          }
          
          current = current.parentElement;
        }
      }
      
      // FALLBACK: clicar em QUALQUER candidato
      console.log('🚨 FALLBACK: clicando qualquer candidato');
      for (const c of candidates) {
        try {
          c.click();
          return true;
        } catch (e) { continue; }
      }
      
      return false;
    }, selectedMode);
    
    if (!modeClicked) {
      logger.error('❌ JavaScript não conseguiu clicar. Usando Playwright forçado...');
      try {
        // Tentar com Playwright - VÁRIOS seletores
        const selectors = [
          `text="${selectedMode}"`,
          `button:has-text("${selectedMode}")`,
          `div:has-text("${selectedMode}")`,
          `[role="button"]:has-text("${selectedMode}")`,
          `*:has-text("${selectedMode}")`
        ];
        
        for (const selector of selectors) {
          try {
            await page.locator(selector).first().click({ force: true, timeout: 2000 });
            logger.success(`✅ Clicou com seletor: ${selector}`);
            modeClicked = true;
            break;
          } catch (e) {
            continue;
          }
        }
        
        if (!modeClicked) {
          throw new Error(`Não foi possível clicar no modo ${selectedMode}`);
        }
      } catch (e) {
        throw new Error(`Falha total ao clicar no modo ${selectedMode}: ${e.message}`);
      }
    } else {
      logger.success(`✅ Modo ${selectedMode} selecionado via JavaScript`);
    }
    
    // Verificar se há botão "Next" (caso o design mude)
    logger.info('⏳ Verificando se há botão "Next"...');
    try {
      const nextAfterMode = page.locator('button:has-text("Next")').first();
      await nextAfterMode.click({ timeout: 2000 });
      logger.success('✅ Clicou em Next após modo');
    } catch (e) {
      // Sem Next - transição automática
      logger.info('⏳ Sem botão Next - aguardando transição automática...');
    }
    
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
    
    // ESPERA MAIOR para backend processar
    logger.info('⏳ Aguardando backend processar...');
    await page.waitForTimeout(3000);

    // 4. Escolher tamanho da empresa - aleatório
    logger.info('4️⃣ Escolhendo tamanho da empresa...');
    const companySizes = ['Solo', '2 - 20', '21 - 200', '200+'];
    const selectedSize = companySizes[Math.floor(Math.random() * companySizes.length)];
    logger.info(`Tamanho escolhido: ${selectedSize}`);
    
    await page.waitForTimeout(2000);
    
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
    
    // 🔥 ESPERA CRÍTICA: Backend precisa processar a indicação!
    logger.info('⏳ Aguardando backend processar indicação (5s)...');
    await page.waitForTimeout(5000);

    // 5. Aguardar POPUP ou BANNER de créditos (referral)
    logger.info('5️⃣ Aguardando popup/banner de indicação...');
    
    // Textos corretos que devemos procurar:
    // POPUP: "Congratulations! You have earned +10 credits"
    // BANNER: "You've signed up using a referral link. Publish your first project and reward your friend with 10 bonus credits."
    
    let creditsFound = false;
    
    // Tentar encontrar o POPUP primeiro
    try {
      logger.info('🔍 Procurando popup de "Congratulations"...');
      await page.waitForSelector('text=/Congratulations.*earned.*\\+10.*credits/i', { timeout: 5000 });
      logger.success('🎉 POPUP DE CRÉDITOS ENCONTRADO!');
      creditsFound = true;
    } catch (e) {
      logger.info('⚠️ Popup não encontrado, procurando banner...');
    }
    
    // Se não encontrou popup, tentar encontrar o BANNER
    if (!creditsFound) {
      try {
        logger.info('🔍 Procurando banner de "referral link"...');
        await page.waitForSelector('text=/referral link.*Publish.*first project.*bonus credits/i', { timeout: 5000 });
        logger.success('🎉 BANNER DE CRÉDITOS ENCONTRADO!');
        creditsFound = true;
      } catch (e) {
        logger.warning('⚠️ Banner não encontrado');
      }
    }
    
    if (creditsFound) {
      logger.success('✅ Indicação reconhecida pelo sistema!');
      await page.waitForTimeout(2000);
      
      // Procurar botão Continue (caso seja popup)
      try {
        logger.info('6️⃣ Procurando botão Continue...');
        const continueButton = page.locator('button:has-text("Continue"), button:has-text("Got it"), button:has-text("OK")').first();
        await continueButton.click({ timeout: 3000 });
        logger.success('✅ Clicou em Continue/OK');
        await page.waitForTimeout(2000);
      } catch (e) {
        logger.info('⚠️ Sem botão para fechar - continuando...');
      }
    } else {
      logger.error('❌ NENHUMA MENSAGEM DE INDICAÇÃO ENCONTRADA!');
      logger.warning('⚠️ O sistema NÃO reconheceu a indicação');
      logger.info(`📍 URL atual: ${page.url()}`);
      logger.info('⏳ Aguardando mais 3s caso apareça...');
      await page.waitForTimeout(3000);
    }

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
