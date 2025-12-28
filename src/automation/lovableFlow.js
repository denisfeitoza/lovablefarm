import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';
import { getTimeout, getDelay, DEFAULT_TIMEOUTS } from '../utils/timeouts.js';

/**
 * Função helper para fazer fallback para o template quando houver erros
 */
export async function fallbackToTemplate(page, userId, usingProxy) {
  const fallbackTemplateUrl = config.templateProjectUrl;
  logger.warning('⚠️ Fazendo fallback para template específico...');
  logger.info(`📍 Navegando para: ${fallbackTemplateUrl}`);
  
  await page.goto(fallbackTemplateUrl, { 
    waitUntil: 'domcontentloaded', 
    timeout: getTimeout(DEFAULT_TIMEOUTS.pageLoad, usingProxy) 
  });
  await page.waitForTimeout(getDelay(DEFAULT_TIMEOUTS.mediumDelay, usingProxy));
  
  // Aguardar e clicar em "Use template"
  logger.info('Procurando botão "Use template" (fallback)...');
  await page.waitForSelector('button:has-text("Use template")', { timeout: getTimeout(DEFAULT_TIMEOUTS.elementVisible, usingProxy) });
  
  const useTemplateButton = await page.locator('button:has-text("Use template")').first();
  await useTemplateButton.click();
  logger.success('✅ Clicou em "Use template" (fallback)');
  
  await page.waitForTimeout(getDelay(1500, usingProxy));
  
  // Aguardar e clicar em "REMIX" (popup que aparece)
  logger.info('⏳ Aguardando popup "Remix" (fallback)...');
  await page.waitForSelector('button:has-text("Remix"), button:has-text("remix")', { timeout: getTimeout(DEFAULT_TIMEOUTS.elementVisible, usingProxy) });
  
  const remixButton = await page.locator('button:has-text("Remix"), button:has-text("remix")').first();
  await remixButton.click();
  logger.success('✅ Clicou em "Remix" (fallback)');
  
  // Aguardar editor começar a carregar
  logger.info('⏳ Aguardando editor abrir (fallback)...');
  await page.waitForTimeout(getDelay(DEFAULT_TIMEOUTS.longDelay, usingProxy));
  
  logger.success('✅ Fallback para template concluído');
}

/**
 * Fluxo completo na plataforma Lovable - OTIMIZADO
 * Sem scrolls, sem screenshots, direto ao ponto
 */

/**
 * Etapa 1: Cadastro rápido
 */
export async function signupOnLovable(page, email, password, userId = 1, referralLink, usingProxy = false) {
  const startTime = Date.now();
  
  if (!referralLink) throw new Error('Link de indicação é obrigatório');
  
  try {
    logger.step(1, 'Cadastro na Lovable');
    
    const pageLoadTimeout = getTimeout(DEFAULT_TIMEOUTS.pageLoad, usingProxy);
    await page.goto(referralLink, { waitUntil: 'domcontentloaded', timeout: pageLoadTimeout });
    await page.waitForTimeout(getDelay(2000, usingProxy));
    logger.success('✅ Página carregada');

    // DIRETO para #email - usar locator para ser mais resiliente
    const emailInputLocator = page.locator('#email');
    await emailInputLocator.waitFor({ state: 'visible', timeout: getTimeout(DEFAULT_TIMEOUTS.elementVisible, usingProxy) });
    await emailInputLocator.click();
    await page.waitForTimeout(getDelay(200, usingProxy));
    await emailInputLocator.fill(email);
    await page.waitForTimeout(getDelay(400, usingProxy));
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
    
    logger.success('✅ Clicou em Continuar');
    logger.info('⏳ Aguardando transição para campo de senha...');
    
    // Aguardar transição: pode mudar URL ou aparecer campo de senha
    await page.waitForTimeout(getDelay(2000, usingProxy));
    
    // Verificar se há erros na página antes de continuar
    const hasError = await page.evaluate(() => {
      const bodyText = document.body.innerText.toLowerCase();
      return bodyText.includes('erro') || 
             bodyText.includes('error') || 
             bodyText.includes('invalid') ||
             bodyText.includes('inválido');
    });
    
    if (hasError) {
      const errorText = await page.evaluate(() => document.body.innerText.substring(0, 500));
      logger.error('❌ Erro detectado na página após Continuar');
      logger.error(`📝 Texto: ${errorText}`);
      throw new Error('Erro na página após clicar em Continuar');
    }

    // DIRETO para input[type="password"] - usar locator para ser mais resiliente
    logger.info('🔍 Procurando campo de senha...');
    
    // Tentar múltiplas estratégias para encontrar o campo de senha
    let passwordInputLocator = null;
    const passwordSelectors = [
      'input[type="password"]',
      'input[name="password"]',
      'input[placeholder*="password" i]',
      'input[placeholder*="senha" i]',
      'input[id*="password" i]'
    ];
    
    for (const selector of passwordSelectors) {
      try {
        const locator = page.locator(selector).first();
        await locator.waitFor({ state: 'visible', timeout: getTimeout(DEFAULT_TIMEOUTS.elementWait, usingProxy) });
        passwordInputLocator = locator;
        logger.info(`✅ Campo de senha encontrado com seletor: ${selector}`);
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (!passwordInputLocator) {
      // Última tentativa: aguardar mais tempo
      logger.warning('⚠️ Campo de senha não encontrado, aguardando mais tempo...');
      await page.waitForTimeout(getDelay(DEFAULT_TIMEOUTS.longDelay, usingProxy));
      
      try {
        passwordInputLocator = page.locator('input[type="password"]').first();
        await passwordInputLocator.waitFor({ state: 'visible', timeout: getTimeout(DEFAULT_TIMEOUTS.elementVisible, usingProxy) });
        logger.info('✅ Campo de senha encontrado após espera adicional');
      } catch (e) {
        const currentUrl = page.url();
        const pageText = await page.evaluate(() => document.body.innerText.substring(0, 300));
        logger.error(`❌ Campo de senha não encontrado após todas as tentativas`);
        logger.error(`📍 URL: ${currentUrl}`);
        logger.error(`📝 Conteúdo da página: ${pageText}`);
        throw new Error('Campo de senha não apareceu após clicar em Continuar');
      }
    }
    
    await passwordInputLocator.click();
    await page.waitForTimeout(getDelay(200, usingProxy));
    await passwordInputLocator.fill(password);
    await page.waitForTimeout(getDelay(400, usingProxy));
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
    
    // Usar abordagem mais robusta: clicar via JavaScript ou usar locator
    let createButtonClicked = false;
    for (const selector of createSelectors) {
      try {
        // Tentar com locator primeiro (mais resiliente)
        const buttonLocator = page.locator(selector).first();
        await buttonLocator.waitFor({ state: 'visible', timeout: getTimeout(DEFAULT_TIMEOUTS.elementWait, usingProxy) });
        logger.info(`✅ Botão encontrado com seletor: ${selector}`);
        
        // Tentar clicar com locator (mais resiliente a mudanças no DOM)
        try {
          await buttonLocator.click({ timeout: getTimeout(DEFAULT_TIMEOUTS.elementWait, usingProxy) });
          createButtonClicked = true;
          logger.success('✅ Clicou em Create (via locator)');
          break;
        } catch (clickError) {
          // Se falhar, tentar via JavaScript
          logger.warning('⚠️ Clique via locator falhou, tentando JavaScript...');
          const jsClicked = await page.evaluate((sel) => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const btn = buttons.find(b => {
              const text = b.textContent.trim();
              return text === 'Create' || 
                     text === 'Criar' || 
                     text === 'Criar sua conta' || 
                     text === 'Create account' ||
                     text === 'Sign up' ||
                     b.type === 'submit';
            });
            if (btn) {
              btn.click();
              return true;
            }
            return false;
          });
          
          if (jsClicked) {
            createButtonClicked = true;
            logger.success('✅ Clicou em Create (via JavaScript)');
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!createButtonClicked) {
      throw new Error('❌ Botão Create/Criar não encontrado ou não foi possível clicar');
    }

    // 🔥 AGUARDAR URL MUDAR (sinal de que aceitou)
    logger.info('⏳ Aguardando página mudar após cadastro...');
    await page.waitForTimeout(getDelay(DEFAULT_TIMEOUTS.mediumDelay, usingProxy)); // Esperar primeiro
    
    try {
      // Esperar pela URL mudar (sair de /signup)
      // Usar pageNavigation timeout (maior) pois redirects podem demorar mais com proxy
      await page.waitForURL(url => !url.toString().includes('/signup'), { timeout: getTimeout(DEFAULT_TIMEOUTS.pageNavigation || DEFAULT_TIMEOUTS.pageLoad, usingProxy) });
      logger.success('✅ Cadastro aceito! URL mudou para verificação');
    } catch (e) {
      // Se não mudou em 10s, verificar se tem mensagem de erro
      
      const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase());
      if (bodyText.includes('erro') || bodyText.includes('error')) {
        logger.error('❌ CADASTRO BLOQUEADO! Erro detectado');
        logger.error(`📝 Texto: ${bodyText.substring(0, 500)}`);
        throw new Error('Cadastro bloqueado');
      }
      // Se não tem erro, apenas não mudou ainda - continuar mesmo assim
      logger.warning('⚠️ URL não mudou, mas sem erro detectado - continuando...');
    }

    // 🔍 VERIFICAR NOTIFICAÇÃO DE DOMÍNIO CANSADO
    // Após clicar em Create e ir para página de aguardar confirmação,
    // pode aparecer notificação "Email address not eligible for referral program"
    // Isso indica que o domínio está cansado/bloqueado
    logger.info('🔍 Verificando se há notificação de domínio não elegível...');
    await page.waitForTimeout(getDelay(2000, usingProxy)); // Aguardar notificação aparecer
    
    const hasIneligibleNotification = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      // Procurar pela mensagem exata ou variações
      const ineligiblePatterns = [
        'Email address not eligible for referral program',
        'not eligible for referral program',
        'email address not eligible',
        'referral program',
        'sign-up will proceed without the referral bonus'
      ];
      
      return ineligiblePatterns.some(pattern => 
        bodyText.toLowerCase().includes(pattern.toLowerCase())
      );
    });
    
    if (hasIneligibleNotification) {
      const notificationText = await page.evaluate(() => {
        // Tentar encontrar o texto exato da notificação
        const allText = document.body.innerText;
        const lines = allText.split('\n');
        const notificationLine = lines.find(line => 
          line.toLowerCase().includes('not eligible') || 
          line.toLowerCase().includes('referral program')
        );
        return notificationLine || 'Notificação de domínio não elegível detectada';
      });
      
      logger.error('❌ DOMÍNIO CANSADO DETECTADO!');
      logger.error(`📝 Notificação: ${notificationText}`);
      logger.error(`📧 Email usado: ${email}`);
      
      // Extrair domínio do email para incluir no erro
      const emailDomain = email.split('@')[1] || 'unknown';
      
      // Lançar erro que será categorizado como email_error (contém "email" e "domínio")
      throw new Error(`❌ Erro de email - Domínio não elegível para programa de indicação detectado. Email: ${email} | Domínio: ${emailDomain}`);
    }
    
    logger.success('✅ Nenhuma notificação de domínio não elegível detectada');

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
export async function verifyEmailInSameSession(page, verificationLink, userId = 1, usingProxy = false) {
  const startTime = Date.now();
  
  try {
    logger.step(2, 'Verificando email');

    const isValidLink = verificationLink.includes('lovable.dev') && 
                        (verificationLink.includes('verify') || verificationLink.includes('auth/action'));
    
    if (!isValidLink) throw new Error(`❌ Link inválido`);

    logger.info('Clicando no link de verificação...');
    await page.goto(verificationLink, { waitUntil: 'domcontentloaded', timeout: getTimeout(DEFAULT_TIMEOUTS.pageLoad, usingProxy) });

    logger.info('⏳ Aguardando loading e redirect...');
    
    // Aguardar a URL mudar (sinal de redirect completado)
    // Usar pageNavigation timeout (maior) pois redirects podem demorar mais com proxy
    await page.waitForURL(url => {
      const urlStr = url.toString();
      // Quando NÃO for mais auth/action ou verify-email = redirect completou
      return !urlStr.includes('auth/action') && !urlStr.includes('verify-email');
    }, { timeout: getTimeout(DEFAULT_TIMEOUTS.pageNavigation || DEFAULT_TIMEOUTS.pageLoad, usingProxy) });
    
    const finalUrl = page.url();
    logger.success(`✅ Redirect completado! URL: ${finalUrl}`);

    const executionTime = Date.now() - startTime;
    logger.success(`✅ Email verificado em ${executionTime}ms`);

    return { success: true, executionTime };
  } catch (error) {
    logger.error('❌ Erro na verificação', error);
    logger.error(`URL atual: ${page.url()}`);
    
    // 🔥 FALLBACK: Qualquer erro após clicar no link de verificação deve ir para o template fallback
    logger.warning('⚠️ Erro após verificação de email. Fazendo fallback para template...');
    try {
      await fallbackToTemplate(page, userId, usingProxy);
      // Retornar sucesso após fallback - a função de publish continuará a partir do template
      return { success: true, executionTime: Date.now() - startTime, usedFallback: true };
    } catch (fallbackError) {
      logger.error('❌ Erro também no fallback do template', fallbackError);
      throw new Error(`Erro na verificação: ${error.message}. Fallback também falhou: ${fallbackError.message}`);
    }
  }
}

/**
 * Etapa 3: Completar o quiz de onboarding
 */
export async function completeOnboardingQuiz(page, userId = 1, email = null, usingProxy = false) {
  const startTime = Date.now();
  
  try {
    logger.step(3, 'Completando quiz de onboarding');

    // Aguardar a página carregar
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(getDelay(DEFAULT_TIMEOUTS.mediumDelay, usingProxy));

    // 1. Escolher modo (Light ou Dark) - aleatório
    logger.info('1️⃣ Escolhendo modo (Light/Dark)...');
    const modes = ['Light', 'Dark'];
    const selectedMode = modes[Math.floor(Math.random() * modes.length)];
    logger.info(`Modo escolhido: ${selectedMode}`);
    
    // Aguardar a página do quiz aparecer
    await page.waitForSelector('text="Pick your style"', { timeout: getTimeout(DEFAULT_TIMEOUTS.elementVisible, usingProxy) });
    logger.info('Quiz de estilo encontrado');
    await page.waitForTimeout(getDelay(DEFAULT_TIMEOUTS.actionDelay, usingProxy));
    
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
            await page.locator(selector).first().click({ force: true, timeout: getTimeout(DEFAULT_TIMEOUTS.elementWait, usingProxy) });
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
      await nextAfterMode.click({ timeout: getTimeout(DEFAULT_TIMEOUTS.elementWait, usingProxy) });
      logger.success('✅ Clicou em Next após modo');
    } catch (e) {
      // Sem Next - transição automática
      logger.info('⏳ Sem botão Next - aguardando transição automática...');
    }
    
    await page.waitForTimeout(getDelay(2500, usingProxy));

    // 2. Preencher nome
    logger.info('2️⃣ Preenchendo nome...');
    const names = ['Alex Silva', 'Maria Santos', 'João Oliveira', 'Ana Costa', 'Pedro Lima', 'Julia Souza'];
    const randomName = names[Math.floor(Math.random() * names.length)];
    
    // Aguardar campo de nome aparecer
    await page.waitForSelector('input[type="text"], input[placeholder*="name" i]', { timeout: getTimeout(DEFAULT_TIMEOUTS.elementWait, usingProxy) });
    
    const nameInput = page.locator('input[type="text"], input[placeholder*="name" i]').first();
    await nameInput.fill(randomName);
    logger.info(`Nome preenchido: ${randomName}`);
    
    // Clicar em Next
    await page.waitForTimeout(getDelay(DEFAULT_TIMEOUTS.shortDelay, usingProxy));
    const nextButton1 = page.locator('button:has-text("Next")').first();
    await nextButton1.click();
    logger.success('✅ Nome confirmado');
    
    await page.waitForTimeout(getDelay(DEFAULT_TIMEOUTS.actionDelay, usingProxy));

    // 3. Escolher profissão (role) - sempre Other
    logger.info('3️⃣ Escolhendo profissão...');
    const selectedRole = 'Other';
    logger.info(`Profissão escolhida: ${selectedRole}`);
    
    // Aguardar opções de role aparecerem
    await page.waitForTimeout(getDelay(1500, usingProxy));
    
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
    await page.waitForTimeout(getDelay(DEFAULT_TIMEOUTS.mediumDelay, usingProxy));

    // 4. Escolher tamanho da empresa - aleatório
    logger.info('4️⃣ Escolhendo tamanho da empresa...');
    const companySizes = ['Solo', '2 - 20', '21 - 200', '200+'];
    const selectedSize = companySizes[Math.floor(Math.random() * companySizes.length)];
    logger.info(`Tamanho escolhido: ${selectedSize}`);
    
    await page.waitForTimeout(getDelay(DEFAULT_TIMEOUTS.actionDelay, usingProxy));
    
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
    logger.info('⏳ Aguardando backend processar indicação...');
    await page.waitForTimeout(getDelay(DEFAULT_TIMEOUTS.longDelay, usingProxy));

    // 5. Aguardar POPUP ou BANNER de créditos (referral)
    logger.info('5️⃣ Aguardando popup/banner de indicação...');
    
    // Textos corretos que devemos procurar:
    // POPUP: "Congratulations! You have earned +10 credits"
    // BANNER: "You've signed up using a referral link. Publish your first project and reward your friend with 10 bonus credits."
    
    let creditsFound = false;
    
    // Tentar encontrar o POPUP primeiro
    try {
      logger.info('🔍 Procurando popup de "Congratulations"...');
      await page.waitForSelector('text=/Congratulations.*earned.*\\+10.*credits/i', { timeout: getTimeout(DEFAULT_TIMEOUTS.elementWait, usingProxy) });
      logger.success('🎉 POPUP DE CRÉDITOS ENCONTRADO!');
      creditsFound = true;
    } catch (e) {
      logger.info('⚠️ Popup não encontrado, procurando banner...');
    }
    
    // Se não encontrou popup, tentar encontrar o BANNER
    if (!creditsFound) {
      try {
        logger.info('🔍 Procurando banner de "referral link"...');
        await page.waitForSelector('text=/referral link.*Publish.*first project.*bonus credits/i', { timeout: getTimeout(DEFAULT_TIMEOUTS.elementWait, usingProxy) });
        logger.success('🎉 BANNER DE CRÉDITOS ENCONTRADO!');
        creditsFound = true;
      } catch (e) {
        logger.warning('⚠️ Banner não encontrado');
      }
    }
    
    if (creditsFound) {
      logger.success('✅ Indicação reconhecida pelo sistema!');
      await page.waitForTimeout(getDelay(DEFAULT_TIMEOUTS.actionDelay, usingProxy));
      
      // Procurar botão Continue (caso seja popup)
      try {
        logger.info('6️⃣ Procurando botão Continue...');
        const continueButton = page.locator('button:has-text("Continue"), button:has-text("Got it"), button:has-text("OK")').first();
        await continueButton.click({ timeout: getTimeout(DEFAULT_TIMEOUTS.mediumDelay, usingProxy) });
        logger.success('✅ Clicou em Continue/OK');
        await page.waitForTimeout(getDelay(DEFAULT_TIMEOUTS.actionDelay, usingProxy));
      } catch (e) {
        logger.info('⚠️ Sem botão para fechar - continuando...');
      }
    } else {
      logger.error('❌ NENHUMA MENSAGEM DE INDICAÇÃO ENCONTRADA!');
      logger.warning('⚠️ O sistema NÃO reconheceu a indicação');
      logger.info(`📍 URL atual: ${page.url()}`);
      logger.info('⏳ Aguardando mais tempo caso apareça...');
      await page.waitForTimeout(getDelay(DEFAULT_TIMEOUTS.mediumDelay, usingProxy));
      
      // Se ainda não encontrou após espera adicional, lançar erro
      const errorMessage = email 
        ? `Banner/popup de créditos não encontrado. Email: ${email}`
        : 'Banner/popup de créditos não encontrado';
      throw new Error(errorMessage);
    }

    const executionTime = Date.now() - startTime;
    logger.success(`✅ Onboarding completado em ${executionTime}ms`);
    return { success: true, executionTime };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logger.error('❌ Erro ao completar quiz', error);
    logger.error(`URL atual: ${page.url()}`);
    
    // 🔥 FALLBACK: Qualquer erro no quiz deve ir para o template fallback
    logger.warning('⚠️ Erro no quiz. Fazendo fallback para template...');
    try {
      await fallbackToTemplate(page, userId, usingProxy);
      // Retornar sucesso após fallback - a função de publish continuará a partir do template
      return { success: true, executionTime: Date.now() - startTime, usedFallback: true };
    } catch (fallbackError) {
      logger.error('❌ Erro também no fallback do template', fallbackError);
      throw new Error(`Erro no quiz: ${error.message}. Fallback também falhou: ${fallbackError.message}`);
    }
  }
}

/**
 * Etapa 4: Escolher template
 */
export async function selectTemplate(page, userId = 1, usingProxy = false, simulatedErrors = []) {
  const startTime = Date.now();
  
  try {
    logger.step(4, 'Escolhendo template');

    // 🧪 SIMULAR ERRO DE TEMPLATE se solicitado
    if (simulatedErrors.includes('template_error')) {
      logger.warning('🧪 SIMULANDO ERRO DE TEMPLATE para testar fallback...');
      throw new Error('Nenhum template encontrado');
    }

    // Templates a evitar
    const avoidTemplates = [
      'Visual landing page',
      'Photographer portfolio',
      'Personal portfolio',
      'Visual gallery'
    ];

    logger.info('Procurando templates disponíveis...');
    
    // Aguardar seção de templates
    await page.waitForSelector('text="Templates"', { timeout: getTimeout(DEFAULT_TIMEOUTS.elementVisible, usingProxy) });
    
    // Rolar para baixo para ver os templates
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(getDelay(DEFAULT_TIMEOUTS.actionDelay, usingProxy));

    // Buscar todos os templates disponíveis
    const templateCards = await page.locator('[role="link"], a').filter({ 
      has: page.locator('text=/Architect portfolio|Ecommerce store|Lifestyle Blog|Architecture blog|Fashion magazine|Fashion blog|Personal blog/i')
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
    
    await page.waitForTimeout(getDelay(DEFAULT_TIMEOUTS.mediumDelay, usingProxy));

    // Aguardar e clicar em "Use template"
    logger.info('Procurando botão "Use template"...');
    await page.waitForSelector('button:has-text("Use template")', { timeout: getTimeout(DEFAULT_TIMEOUTS.elementVisible, usingProxy) });
    
    const useTemplateButton = await page.locator('button:has-text("Use template")').first();
    await useTemplateButton.click();
    logger.success('✅ Clicou em "Use template"');

    await page.waitForTimeout(getDelay(1500, usingProxy));

    // 🔥 AGUARDAR E CLICAR EM "REMIX" (popup que aparece)
    logger.info('⏳ Aguardando popup "Remix"...');
    await page.waitForSelector('button:has-text("Remix"), button:has-text("remix")', { timeout: getTimeout(DEFAULT_TIMEOUTS.elementVisible, usingProxy) });
    
    const remixButton = await page.locator('button:has-text("Remix"), button:has-text("remix")').first();
    await remixButton.click();
    logger.success('✅ Clicou em "Remix"');
    
    // Aguardar editor começar a carregar
    logger.info('⏳ Aguardando editor abrir...');
    await page.waitForTimeout(getDelay(DEFAULT_TIMEOUTS.longDelay, usingProxy));

    const executionTime = Date.now() - startTime;
    logger.success(`✅ Template selecionado e editor abrindo em ${executionTime}ms`);
    return { success: true, executionTime };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logger.error('❌ Erro ao selecionar template', error);
    logger.error(`URL: ${page.url()}`);
    
    // 🔥 FALLBACK: Se der erro, abrir template específico
    logger.warning('⚠️ Tentando fallback: abrindo template específico...');
    try {
      await fallbackToTemplate(page, userId, usingProxy);
      logger.success(`✅ Template fallback selecionado e editor abrindo em ${Date.now() - startTime}ms`);
      return { success: true, executionTime: Date.now() - startTime };
    } catch (fallbackError) {
      logger.error('❌ Erro também no fallback do template', fallbackError);
      throw new Error(`Erro ao selecionar template: ${error.message}. Fallback também falhou: ${fallbackError.message}`);
    }
  }
}

/**
 * Etapa 5: Publicar projeto
 */
export async function useTemplateAndPublish(page, userId = 1, usingProxy = false, simulatedErrors = []) {
  const startTime = Date.now();
  
  try {
    logger.step(5, 'Publicando projeto');

    // Aguardar editor carregar completamente (após clicar em Remix)
    logger.info('⏳ Aguardando editor carregar completamente...');
    await page.waitForTimeout(getDelay(DEFAULT_TIMEOUTS.veryLongDelay, usingProxy));
    
    // Tentar encontrar botão Publish com retry e refresh
    let publishButtonFound = false;
    const maxRetries = 2;
    
    // 🧪 SIMULAR ERRO DE PUBLISH se solicitado (na primeira tentativa)
    let shouldSimulatePublishError = simulatedErrors.includes('publish_error');
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`🔍 Tentativa ${attempt}/${maxRetries} de encontrar botão Publish...`);
        
        // Simular erro na primeira tentativa se solicitado
        if (shouldSimulatePublishError && attempt === 1) {
          logger.warning('🧪 SIMULANDO ERRO DE PUBLISH para testar retry com refresh...');
          shouldSimulatePublishError = false; // Só simular uma vez
          throw new Error('page.waitForSelector: Timeout 30000ms exceeded. Call log: - waiting for locator(\'button:has-text("Publish"), button:has-text("Publicar")\') to be visible');
        }
        
        // Usar pageLoad timeout (maior) pois o editor pode demorar mais para carregar com proxy
        await page.waitForSelector('button:has-text("Publish"), button:has-text("Publicar")', { 
          state: 'visible', 
          timeout: getTimeout(DEFAULT_TIMEOUTS.pageLoad, usingProxy)
        });
        logger.success('✅ Botão Publish encontrado!');
        publishButtonFound = true;
        break;
      } catch (error) {
        // Verificar se é o erro específico de timeout do Publish
        const isPublishTimeoutError = error.message && error.message.includes('waiting for locator(\'button:has-text("Publish"), button:has-text("Publicar")\') to be visible');
        
        if (isPublishTimeoutError && attempt >= maxRetries) {
          // 🔥 FALLBACK: Se deu timeout no Publish, voltar para etapa de template
          logger.warning('⚠️ Erro de timeout no botão Publish detectado. Fazendo fallback para template...');
          throw new Error('PUBLISH_TIMEOUT_FALLBACK_TO_TEMPLATE');
        }
        
        if (attempt < maxRetries) {
          logger.warning(`⚠️ Botão Publish não encontrado na tentativa ${attempt}, tentando refresh...`);
          // Fazer refresh da página
          await page.reload({ waitUntil: 'domcontentloaded', timeout: getTimeout(DEFAULT_TIMEOUTS.pageLoad, usingProxy) });
          await page.waitForTimeout(getDelay(DEFAULT_TIMEOUTS.mediumDelay, usingProxy));
          logger.info('🔄 Página recarregada, tentando novamente...');
        } else {
          logger.error('❌ Botão Publish não encontrado após todas as tentativas');
          throw error;
        }
      }
    }
    
    if (!publishButtonFound) {
      throw new Error('Botão Publish não encontrado após refresh');
    }

    // 1️⃣ Clicar no PRIMEIRO Publish (abre dropdown)
    const publishButton = page.locator('button:has-text("Publish"), button:has-text("Publicar")').first();
    await publishButton.click();
    logger.success('✅ Clicou no primeiro Publish (abrindo dropdown)');

    await page.waitForTimeout(getDelay(1500, usingProxy));

    // 2️⃣ Clicar no SEGUNDO Publish (dentro do dropdown)
    logger.info('⏳ Procurando segundo botão Publish no dropdown...');
    
    // Buscar todos os botões Publish visíveis
    const allPublishButtons = await page.locator('button:has-text("Publish"), button:has-text("Publicar")').all();
    logger.info(`📋 Encontrados ${allPublishButtons.length} botões Publish`);
    
    if (allPublishButtons.length > 1) {
      await allPublishButtons[1].click();
      logger.success('✅ Clicou no segundo Publish (confirmação)');
    } else {
      logger.warning('⚠️ Apenas 1 botão Publish - tentando clicar novamente');
      await allPublishButtons[0].click();
    }

    // Aguardar publicação começar
    logger.info('⏳ Aguardando publicação processar...');
    await page.waitForTimeout(getDelay(15000, usingProxy));
    
    // Verificar se há popup de confirmação ou status "publicado"
    logger.info('⏳ Verificando confirmação de publicação...');
    const hasConfirmation = await page.evaluate(() => {
      const body = document.body.innerText.toLowerCase();
      return body.includes('publicado') || 
             body.includes('published') || 
             body.includes('success') || 
             body.includes('live');
    });
    
    if (hasConfirmation) {
      logger.success('🎉 Publicação confirmada!');
    } else {
      logger.warning('⚠️ Confirmação não detectada, mas seguindo em frente...');
    }

    await page.waitForTimeout(getDelay(DEFAULT_TIMEOUTS.actionDelay, usingProxy)); // Segurança
    logger.success('✅ Publicação concluída!');

    const executionTime = Date.now() - startTime;
    logger.success(`✅ Template publicado em ${executionTime}ms`);

    return { success: true, executionTime };
  } catch (error) {
    // Verificar se é o erro específico que requer fallback para template
    const isPublishTimeoutError = error.message && (
      error.message.includes('waiting for locator(\'button:has-text("Publish"), button:has-text("Publicar")\') to be visible') ||
      error.message === 'PUBLISH_TIMEOUT_FALLBACK_TO_TEMPLATE'
    );
    
    if (isPublishTimeoutError) {
      logger.warning('⚠️ Timeout no Publish detectado. Fazendo fallback para etapa de template...');
      
      try {
        // 🔥 FALLBACK: Voltar para etapa de template
        await fallbackToTemplate(page, userId, usingProxy);
        
        // Após o fallback, tentar publicar novamente (recursivamente)
        logger.success(`✅ Fallback para template concluído. Tentando publicar novamente.`);
        return await useTemplateAndPublish(page, userId, usingProxy, simulatedErrors);
        
      } catch (fallbackError) {
        logger.error('❌ Erro também no fallback do template após publish timeout', fallbackError);
        const executionTime = Date.now() - startTime;
        return {
          success: false,
          error: `Erro ao publicar: ${error.message}. Fallback também falhou: ${fallbackError.message}`,
          executionTime
        };
      }
    }
    
    logger.error('❌ Erro ao publicar', error);
    const executionTime = Date.now() - startTime;
    return {
      success: false,
      error: error.message,
      executionTime
    };
  }
}
