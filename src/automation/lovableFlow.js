import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';
import { getTimeout, getDelay, DEFAULT_TIMEOUTS } from '../utils/timeouts.js';

/**
 * Função helper para fazer fallback para o template quando houver erros
 */
/**
 * Helper para aguardar botão "Use template" com fallback de refresh
 */
async function waitForUseTemplateButtonWithRefresh(page, usingProxy, context = '') {
  try {
    logger.info(`Procurando botão "Use template"${context ? ` (${context})` : ''}...`);
    await page.waitForSelector('button:has-text("Use template")', { timeout: getTimeout(DEFAULT_TIMEOUTS.elementVisible, usingProxy) });
    return true;
  } catch (error) {
    // Se der timeout, lançar erro para que selectTemplate possa tentar fallbackToTemplate primeiro
    // O refresh será feito em selectTemplate após tentar fallback
    throw error;
  }
}

/**
 * Helper para verificar banner de erro após clicar em Remix
 * Lança erro se encontrar "Ability to remix is limited for your account"
 */
async function checkRemixErrorBanner(page, usingProxy, context = '') {
  logger.info(`🔍 Verificando banner de erro de remix${context ? ` (${context})` : ''}...`);
  await page.waitForTimeout(getDelay(2000, usingProxy)); // Aguardar banner aparecer
  
  const hasRemixError = await page.evaluate(() => {
    const bodyText = document.body.innerText;
    
    // Padrões de erro de remix
    const remixErrorPatterns = [
      'ability to remix is limited for your account',
      'ability to remix is limited',
      'remix is limited',
      'remix.*limited',
      'conta.*não.*pode.*remixar',
      'não.*pode.*remixar',
      'limite.*remix'
    ];
    
    return remixErrorPatterns.some(pattern => {
      const regex = new RegExp(pattern, 'i');
      return regex.test(bodyText);
    });
  });
  
  if (hasRemixError) {
    const errorText = await page.evaluate(() => {
      const allText = document.body.innerText;
      const lines = allText.split('\n');
      
      const errorLine = lines.find(line => {
        const lowerLine = line.toLowerCase();
        return lowerLine.includes('remix') && lowerLine.includes('limited');
      });
      
      return errorLine || allText.substring(0, 300);
    });
    
    logger.error('❌ BANNER DE ERRO DE REMIX DETECTADO!');
    logger.error(`📝 Texto do erro: ${errorText.substring(0, 500)}`);
    
    // Lançar erro para invalidar a sessão
    throw new Error(`❌ Erro de conta - Ability to remix is limited for your account. Conta inválida para remix.`);
  }
  
  logger.success(`✅ Nenhum banner de erro de remix detectado${context ? ` (${context})` : ''}`);
}

export async function fallbackToTemplate(page, userId, usingProxy) {
  const fallbackTemplateUrl = config.templateProjectUrl;
  logger.warning('⚠️ Fazendo fallback para template específico...');
  logger.info(`📍 Navegando para: ${fallbackTemplateUrl}`);
  
  await page.goto(fallbackTemplateUrl, { 
    waitUntil: 'domcontentloaded', 
    timeout: getTimeout(DEFAULT_TIMEOUTS.pageLoad, usingProxy) 
  });
  await page.waitForTimeout(getDelay(DEFAULT_TIMEOUTS.mediumDelay, usingProxy));
  
  // Aguardar e clicar em "Use template" com fallback de refresh
  await waitForUseTemplateButtonWithRefresh(page, usingProxy, 'fallback');
  
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
  
  // 🔍 VERIFICAR BANNER DE ERRO DE REMIX
  await checkRemixErrorBanner(page, usingProxy, 'fallback');
  
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
    
    // Verificar se apareceu tela de Login (conta já existe)
    const isLoginPage = await page.evaluate(() => {
      const bodyText = document.body.innerText || '';
      const url = window.location.href;
      return bodyText.includes('Login') && 
             (bodyText.includes('Continuar com Google') || bodyText.includes('Continuar com GitHub')) &&
             (url.includes('/login') || bodyText.includes('Não tem uma conta?'));
    });
    
    if (isLoginPage) {
      logger.warning('⚠️ Tela de Login detectada - conta já existe!');
      throw new Error('ACCOUNT_ALREADY_EXISTS');
    }

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
    
    // Verificar se foi redirecionado para /login (conta já existe)
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('lovable.dev/login')) {
      logger.warning('⚠️ Redirecionado para /login - conta já existe!');
      throw new Error('ACCOUNT_ALREADY_EXISTS');
    }
    
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
    
    // Função helper para tentar encontrar o campo de senha
    const tryFindPasswordField = async () => {
      for (const selector of passwordSelectors) {
        try {
          const locator = page.locator(selector).first();
          await locator.waitFor({ state: 'visible', timeout: getTimeout(DEFAULT_TIMEOUTS.elementWait, usingProxy) });
          logger.info(`✅ Campo de senha encontrado com seletor: ${selector}`);
          return locator;
        } catch (e) {
          continue;
        }
      }
      return null;
    };
    
    passwordInputLocator = await tryFindPasswordField();
    
    if (!passwordInputLocator) {
      // Última tentativa: aguardar mais tempo
      logger.warning('⚠️ Campo de senha não encontrado, aguardando mais tempo...');
      await page.waitForTimeout(getDelay(DEFAULT_TIMEOUTS.longDelay, usingProxy));
      
      try {
        passwordInputLocator = page.locator('input[type="password"]').first();
        await passwordInputLocator.waitFor({ state: 'visible', timeout: getTimeout(DEFAULT_TIMEOUTS.elementVisible, usingProxy) });
        logger.info('✅ Campo de senha encontrado após espera adicional');
      } catch (e) {
        // 🔥 FALLBACK: Se o campo de senha não aparecer, fazer refresh e tentar novamente
        logger.warning('⚠️ Campo de senha não encontrado. Fazendo refresh e tentando novamente...');
        
        // Fazer refresh da página
        await page.reload({ waitUntil: 'domcontentloaded', timeout: getTimeout(DEFAULT_TIMEOUTS.pageLoad, usingProxy) });
        await page.waitForTimeout(getDelay(2000, usingProxy));
        logger.info('✅ Página recarregada');
        
        // Preencher email novamente
        const emailInputLocatorRetry = page.locator('#email');
        await emailInputLocatorRetry.waitFor({ state: 'visible', timeout: getTimeout(DEFAULT_TIMEOUTS.elementVisible, usingProxy) });
        await emailInputLocatorRetry.click();
        await page.waitForTimeout(getDelay(200, usingProxy));
        await emailInputLocatorRetry.fill(email);
        await page.waitForTimeout(getDelay(400, usingProxy));
        logger.success('✅ Email preenchido novamente');
        
        // Clicar em Continuar novamente
        const clickedRetry = await page.evaluate(() => {
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

        if (!clickedRetry) {
          throw new Error('❌ Botão Continuar não encontrado após refresh');
        }
        
        logger.success('✅ Clicou em Continuar novamente (após refresh)');
        await page.waitForTimeout(getDelay(2000, usingProxy));
        
        // Tentar encontrar o campo de senha novamente
        passwordInputLocator = await tryFindPasswordField();
        
        // Se ainda não encontrou após refresh, lançar erro
        if (!passwordInputLocator) {
          const currentUrlAfterRetry = page.url();
          const pageText = await page.evaluate(() => document.body.innerText.substring(0, 300));
          logger.error(`❌ Campo de senha não encontrado após refresh`);
          logger.error(`📍 URL: ${currentUrlAfterRetry}`);
          logger.error(`📝 Conteúdo da página: ${pageText}`);
          throw new Error('Campo de senha não apareceu após refresh e tentar novamente');
        }
        
        logger.info('✅ Campo de senha encontrado após refresh e nova tentativa');
      }
    }
    
    await passwordInputLocator.click();
    await page.waitForTimeout(getDelay(200, usingProxy));
    await passwordInputLocator.fill(password);
    await page.waitForTimeout(getDelay(400, usingProxy));
    logger.success('✅ Senha preenchida');
    
    // Procurar botão "Criar sua conta" - aguardar aparecer após preencher senha
    logger.info('Procurando botão "Criar sua conta"...');
    await page.waitForTimeout(getDelay(1000, usingProxy)); // Aguardar página estabilizar após preencher senha
    
    let createButtonClicked = false;
    
    // Estratégia 1: Buscar botão por texto exato "Criar sua conta" via JavaScript
    const buttonInfo = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => {
        const text = b.textContent.trim();
        return text === 'Criar sua conta' || text === 'Create account';
      });
      
      if (btn) {
        return {
          found: true,
          text: btn.textContent.trim(),
          disabled: btn.disabled,
          hasDisabledClass: btn.classList.contains('disabled') || btn.hasAttribute('disabled'),
          visible: btn.offsetParent !== null,
          inViewport: btn.getBoundingClientRect().top >= 0 && btn.getBoundingClientRect().bottom <= window.innerHeight
        };
      }
      return { found: false };
    });
    
    if (buttonInfo.found) {
      logger.info(`✅ Botão encontrado: "${buttonInfo.text}"`);
      logger.info(`   - Disabled: ${buttonInfo.disabled || buttonInfo.hasDisabledClass}`);
      logger.info(`   - Visible: ${buttonInfo.visible}`);
      logger.info(`   - In Viewport: ${buttonInfo.inViewport}`);
      
      // Se o botão estiver desabilitado, aguardar um pouco (pode estar validando senha)
      if (buttonInfo.disabled || buttonInfo.hasDisabledClass) {
        logger.info('⏳ Botão está desabilitado, aguardando habilitação...');
        await page.waitForTimeout(getDelay(2000, usingProxy));
        
        // Verificar novamente
        const buttonStillDisabled = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const btn = buttons.find(b => {
            const text = b.textContent.trim();
            return text === 'Criar sua conta' || text === 'Create account';
          });
          return btn ? (btn.disabled || btn.classList.contains('disabled')) : true;
        });
        
        if (buttonStillDisabled) {
          logger.warning('⚠️ Botão ainda está desabilitado após aguardar');
        }
      }
      
      // Tentar clicar usando múltiplas abordagens
      try {
        // Abordagem 1: Locator com texto exato
        logger.info('Tentando clicar via locator...');
        const buttonLocator = page.locator('button:has-text("Criar sua conta"), button:has-text("Create account")').first();
        await buttonLocator.waitFor({ state: 'visible', timeout: getTimeout(DEFAULT_TIMEOUTS.elementWait, usingProxy) });
        await buttonLocator.scrollIntoViewIfNeeded();
        await page.waitForTimeout(getDelay(500, usingProxy));
        
        // Verificar se está habilitado antes de clicar
        const isEnabled = await buttonLocator.isEnabled();
        if (!isEnabled) {
          logger.warning('⚠️ Botão está desabilitado, forçando clique via JavaScript...');
          // Forçar clique via JavaScript mesmo se desabilitado
          await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const btn = buttons.find(b => {
              const text = b.textContent.trim();
              return text === 'Criar sua conta' || text === 'Create account';
            });
            if (btn) {
              btn.removeAttribute('disabled');
              btn.classList.remove('disabled');
              btn.click();
            }
          });
          createButtonClicked = true;
          logger.success('✅ Clicou em "Criar sua conta" (via JavaScript forçado)');
        } else {
          await buttonLocator.click({ timeout: getTimeout(DEFAULT_TIMEOUTS.elementWait, usingProxy) });
          createButtonClicked = true;
          logger.success('✅ Clicou em "Criar sua conta" (via locator)');
        }
      } catch (locatorError) {
        logger.warning('⚠️ Clique via locator falhou, tentando JavaScript direto...');
        
        // Abordagem 2: JavaScript direto (mais confiável)
        const jsClicked = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const btn = buttons.find(b => {
            const text = b.textContent.trim();
            return text === 'Criar sua conta' || text === 'Create account';
          });
          
          if (btn) {
            // Remover atributos de desabilitado se existirem
            btn.removeAttribute('disabled');
            btn.classList.remove('disabled');
            
            // Scroll para o botão
            btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Aguardar um pouco e clicar
            setTimeout(() => {
              btn.click();
            }, 200);
            return true;
          }
          return false;
        });
        
        if (jsClicked) {
          await page.waitForTimeout(getDelay(800, usingProxy));
          createButtonClicked = true;
          logger.success('✅ Clicou em "Criar sua conta" (via JavaScript)');
        }
      }
    }
    
    // Estratégia 2: Se não encontrou, tentar seletores genéricos
    if (!createButtonClicked) {
      logger.warning('⚠️ Botão não encontrado por texto, tentando seletores genéricos...');
      const genericSelectors = [
        'button.w-full:has-text("Criar")',
        'button[type="submit"]',
        'button.bg-primary',
        'button:has-text("Criar")',
        'button:has-text("Create")'
      ];
      
      for (const selector of genericSelectors) {
        try {
          const buttonLocator = page.locator(selector).first();
          await buttonLocator.waitFor({ state: 'visible', timeout: getTimeout(DEFAULT_TIMEOUTS.elementWait, usingProxy) });
          await buttonLocator.scrollIntoViewIfNeeded();
          await page.waitForTimeout(getDelay(500, usingProxy));
          await buttonLocator.click({ timeout: getTimeout(DEFAULT_TIMEOUTS.elementWait, usingProxy) });
          createButtonClicked = true;
          logger.success(`✅ Clicou em botão (via seletor: ${selector})`);
          break;
        } catch (e) {
          continue;
        }
      }
    }
    
    if (!createButtonClicked) {
      // Debug: mostrar informações dos botões na página
      const pageButtons = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.map(b => ({
          text: b.textContent.trim(),
          disabled: b.disabled,
          hasDisabledClass: b.classList.contains('disabled'),
          visible: b.offsetParent !== null,
          type: b.type,
          classes: Array.from(b.classList).join(' ')
        }));
      });
      logger.error('❌ Botão "Criar sua conta" não encontrado ou não foi possível clicar');
      logger.error(`📝 Botões encontrados na página: ${JSON.stringify(pageButtons, null, 2)}`);
      throw new Error('❌ Botão "Criar sua conta" não encontrado ou não foi possível clicar');
    }

    // 🔍 VERIFICAR NOTIFICAÇÃO DE DOMÍNIO CANSADO IMEDIATAMENTE APÓS CLICAR EM CREATE
    // O banner pode aparecer logo após clicar, antes mesmo da URL mudar
    // Isso indica que o domínio está cansado/bloqueado
    logger.info('🔍 Verificando se há notificação de domínio não elegível (após Create)...');
    await page.waitForTimeout(getDelay(2000, usingProxy)); // Aguardar notificação aparecer
    
    const hasIneligibleNotification = await page.evaluate(() => {
      // PRIMEIRO: Tentar encontrar o elemento toast específico (mais preciso)
      const toastElement = document.querySelector('li[data-type="error"][data-sonner-toast]');
      if (toastElement) {
        const toastText = toastElement.innerText || toastElement.textContent || '';
        if (toastText.toLowerCase().includes('not eligible') || 
            toastText.toLowerCase().includes('referral program') ||
            toastText.toLowerCase().includes('sign-up will proceed without')) {
          return true;
        }
      }
      
      // SEGUNDO: Tentar encontrar o div específico com a descrição
      const descriptionDiv = document.querySelector('div[data-description].group-\\[\\.toast\\]\\:text-muted-foreground');
      if (descriptionDiv) {
        const descText = descriptionDiv.innerText || descriptionDiv.textContent || '';
        if (descText.toLowerCase().includes('sign-up will proceed without the referral bonus') ||
            descText.toLowerCase().includes('sign-up will proceed without')) {
          return true;
        }
      }
      
      // TERCEIRO: Tentar encontrar qualquer elemento que contenha o texto chave
      const allElements = document.querySelectorAll('*');
      for (const element of allElements) {
        const text = element.innerText || element.textContent || '';
        if (text.includes('Email address not eligible for referral program') ||
            text.includes('Your sign-up will proceed without the referral bonus') ||
            (text.includes('not eligible') && text.includes('referral program'))) {
          return true;
        }
      }
      
      // QUARTO: Verificar texto no body (fallback)
      const bodyText = document.body.innerText;
      // Procurar pela mensagem exata ou variações
      const ineligiblePatterns = [
        'Email address not eligible for referral program',
        'not eligible for referral program',
        'email address not eligible',
        'referral program',
        'sign-up will proceed without the referral bonus',
        'Your sign-up will proceed without the referral bonus',
        'email.*not eligible',
        'domínio.*não.*elegível',
        'não.*elegível.*programa'
      ];
      
      return ineligiblePatterns.some(pattern => {
        const regex = new RegExp(pattern, 'i');
        return regex.test(bodyText);
      });
    });
    
    if (hasIneligibleNotification) {
      const notificationText = await page.evaluate(() => {
        // PRIMEIRO: Tentar pegar o texto do elemento toast específico
        const toastElement = document.querySelector('li[data-type="error"][data-sonner-toast]');
        if (toastElement) {
          const toastText = toastElement.innerText || toastElement.textContent || '';
          if (toastText.toLowerCase().includes('not eligible') || 
              toastText.toLowerCase().includes('referral program')) {
            return toastText.trim();
          }
        }
        
        // FALLBACK: Tentar encontrar o texto no body
        const allText = document.body.innerText;
        const lines = allText.split('\n');
        const notificationLine = lines.find(line => 
          line.toLowerCase().includes('not eligible') || 
          line.toLowerCase().includes('referral program') ||
          line.toLowerCase().includes('não elegível')
        );
        return notificationLine || 'Notificação de domínio não elegível detectada';
      });
      
      logger.error('❌ DOMÍNIO CANSADO DETECTADO (após Create)!');
      logger.error(`📝 Notificação: ${notificationText}`);
      logger.error(`📧 Email usado: ${email}`);
      
      // Extrair domínio do email para incluir no erro
      const emailDomain = email.split('@')[1] || 'unknown';
      
      // Lançar erro que será categorizado como email_error (contém "email" e "domínio")
      throw new Error(`❌ Erro de email - Domínio não elegível para programa de indicação detectado. Email: ${email} | Domínio: ${emailDomain}`);
    }
    
    logger.success('✅ Nenhuma notificação de domínio não elegível detectada (após Create)');

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

    // 🔍 VERIFICAR NOVAMENTE NOTIFICAÇÃO DE DOMÍNIO CANSADO (caso apareça depois)
    // Após a URL mudar, pode aparecer notificação "Email address not eligible for referral program"
    // Isso indica que o domínio está cansado/bloqueado
    logger.info('🔍 Verificando novamente se há notificação de domínio não elegível (após URL mudar)...');
    await page.waitForTimeout(getDelay(2000, usingProxy)); // Aguardar notificação aparecer
    
    const hasIneligibleNotificationAfter = await page.evaluate(() => {
      // PRIMEIRO: Tentar encontrar o elemento toast específico (mais preciso)
      const toastElement = document.querySelector('li[data-type="error"][data-sonner-toast]');
      if (toastElement) {
        const toastText = toastElement.innerText || toastElement.textContent || '';
        if (toastText.toLowerCase().includes('not eligible') || 
            toastText.toLowerCase().includes('referral program') ||
            toastText.toLowerCase().includes('sign-up will proceed without')) {
          return true;
        }
      }
      
      // SEGUNDO: Tentar encontrar o div específico com data-description (texto chave: "Your sign-up will proceed without")
      const allDivsWithDescription = document.querySelectorAll('div[data-description]');
      for (const div of allDivsWithDescription) {
        const descText = div.innerText || div.textContent || '';
        if (descText.includes('Your sign-up will proceed without the referral bonus') ||
            descText.includes('sign-up will proceed without the referral bonus') ||
            descText.includes('sign-up will proceed without')) {
          return true;
        }
      }
      
      // TERCEIRO: Tentar encontrar qualquer elemento que contenha o texto chave
      const allElements = document.querySelectorAll('*');
      for (const element of allElements) {
        const text = element.innerText || element.textContent || '';
        if (text.includes('Email address not eligible for referral program') ||
            text.includes('Your sign-up will proceed without the referral bonus') ||
            (text.includes('not eligible') && text.includes('referral program'))) {
          return true;
        }
      }
      
      // QUARTO: Verificar texto no body (fallback)
      const bodyText = document.body.innerText;
      // Procurar pela mensagem exata ou variações (usando regex para melhor detecção)
      const ineligiblePatterns = [
        'Email address not eligible for referral program',
        'not eligible for referral program',
        'email address not eligible',
        'referral program',
        'sign-up will proceed without the referral bonus',
        'Your sign-up will proceed without the referral bonus',
        'email.*not eligible',
        'domínio.*não.*elegível',
        'não.*elegível.*programa'
      ];
      
      return ineligiblePatterns.some(pattern => {
        const regex = new RegExp(pattern, 'i');
        return regex.test(bodyText);
      });
    });
    
    if (hasIneligibleNotificationAfter) {
      const notificationText = await page.evaluate(() => {
        // PRIMEIRO: Tentar pegar o texto do elemento toast específico
        const toastElement = document.querySelector('li[data-type="error"][data-sonner-toast]');
        if (toastElement) {
          const toastText = toastElement.innerText || toastElement.textContent || '';
          if (toastText.toLowerCase().includes('not eligible') || 
              toastText.toLowerCase().includes('referral program')) {
            return toastText.trim();
          }
        }
        
        // FALLBACK: Tentar encontrar o texto no body
        const allText = document.body.innerText;
        const lines = allText.split('\n');
        const notificationLine = lines.find(line => 
          line.toLowerCase().includes('not eligible') || 
          line.toLowerCase().includes('referral program') ||
          line.toLowerCase().includes('não elegível')
        );
        return notificationLine || 'Notificação de domínio não elegível detectada';
      });
      
      logger.error('❌ DOMÍNIO CANSADO DETECTADO (após URL mudar)!');
      logger.error(`📝 Notificação: ${notificationText}`);
      logger.error(`📧 Email usado: ${email}`);
      
      // Extrair domínio do email para incluir no erro
      const emailDomain = email.split('@')[1] || 'unknown';
      
      // Lançar erro que será categorizado como email_error (contém "email" e "domínio")
      throw new Error(`❌ Erro de email - Domínio não elegível para programa de indicação detectado. Email: ${email} | Domínio: ${emailDomain}`);
    }
    
    logger.success('✅ Nenhuma notificação de domínio não elegível detectada (após URL mudar)');

    // 🔍 VERIFICAR BANNERS DE ERRO NA PÁGINA DE VERIFICAÇÃO DE EMAIL
    // Após o cadastro, quando a página muda para "Verifique sua caixa de entrada",
    // pode aparecer banners de erro sobre código de referência ou email inválido
    logger.info('🔍 Verificando banners de erro na página de verificação...');
    await page.waitForTimeout(getDelay(3000, usingProxy)); // Aguardar mais tempo para banners aparecerem
    
    const hasErrorBanner = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      
      // Padrões de erro a procurar
      const errorPatterns = [
        // Código de referência atingiu limite
        'referral code has reached its usage limit',
        'referral code.*reached.*usage limit',
        'código de referência.*atingiu.*limite',
        'código.*atingiu.*limite de uso',
        // Email inválido
        'email.*invalid',
        'email.*inválido',
        'invalid email',
        'email inválido',
        'this email.*not valid',
        'este email.*não.*válido'
      ];
      
      return errorPatterns.some(pattern => {
        const regex = new RegExp(pattern, 'i');
        return regex.test(bodyText);
      });
    });
    
    if (hasErrorBanner) {
      const errorText = await page.evaluate(() => {
        // Tentar encontrar o texto exato do banner de erro
        const allText = document.body.innerText;
        const lines = allText.split('\n');
        
        // Procurar linha que contenha erro de referência ou email
        const errorLine = lines.find(line => {
          const lowerLine = line.toLowerCase();
          return lowerLine.includes('referral code') && lowerLine.includes('limit') ||
                 lowerLine.includes('email') && (lowerLine.includes('invalid') || lowerLine.includes('inválido')) ||
                 lowerLine.includes('not valid') || lowerLine.includes('não.*válido');
        });
        
        return errorLine || allText.substring(0, 300);
      });
      
      logger.error('❌ BANNER DE ERRO DETECTADO NA PÁGINA DE VERIFICAÇÃO!');
      logger.error(`📝 Texto do erro: ${errorText.substring(0, 500)}`);
      logger.error(`📧 Email usado: ${email}`);
      
      // Extrair tipo de erro
      const errorTextLower = errorText.toLowerCase();
      let errorType = 'EMAIL_INVALID';
      let errorMessage = 'Email inválido ou código de referência atingiu limite de uso';
      
      if (errorTextLower.includes('referral code') && errorTextLower.includes('limit')) {
        errorType = 'REFERRAL_CODE_LIMIT';
        errorMessage = 'Código de referência atingiu limite de uso';
      } else if (errorTextLower.includes('email') && (errorTextLower.includes('invalid') || errorTextLower.includes('inválido'))) {
        errorType = 'EMAIL_INVALID';
        errorMessage = 'Email inválido detectado';
      }
      
      // Lançar erro para invalidar a sessão
      throw new Error(`❌ Erro de email - ${errorMessage}. Email: ${email} | Tipo: ${errorType}`);
    }
    
    logger.success('✅ Nenhum banner de erro detectado na página de verificação');

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

    // Aguardar e clicar em "Use template" - se der timeout, tenta fallback ANTES de refresh
    try {
      await waitForUseTemplateButtonWithRefresh(page, usingProxy);
    } catch (error) {
      // Se der timeout, tentar fallbackToTemplate ANTES de fazer refresh
      if (error.message && error.message.includes('Timeout')) {
        logger.warning('⚠️ Timeout ao procurar botão "Use template". Tentando fallback para template específico ANTES de refresh...');
        try {
          await fallbackToTemplate(page, userId, usingProxy);
          logger.success('✅ Fallback para template específico funcionou!');
          // Se o fallback funcionou, continuar o fluxo normalmente
          await page.waitForTimeout(getDelay(1500, usingProxy));
          
          // Aguardar e clicar em "REMIX" (popup que aparece)
          logger.info('⏳ Aguardando popup "Remix"...');
          await page.waitForSelector('button:has-text("Remix"), button:has-text("remix")', { timeout: getTimeout(DEFAULT_TIMEOUTS.elementVisible, usingProxy) });
          
          const remixButton = await page.locator('button:has-text("Remix"), button:has-text("remix")').first();
          await remixButton.click();
          logger.success('✅ Clicou em "Remix"');
          
          // 🔍 VERIFICAR BANNER DE ERRO DE REMIX
          await checkRemixErrorBanner(page, usingProxy);
          
          // Aguardar editor começar a carregar
          logger.info('⏳ Aguardando editor abrir...');
          await page.waitForTimeout(getDelay(DEFAULT_TIMEOUTS.longDelay, usingProxy));
          
          const executionTime = Date.now() - startTime;
          logger.success(`✅ Template selecionado via fallback e editor abrindo em ${executionTime}ms`);
          return { success: true, executionTime };
        } catch (fallbackError) {
          logger.warning('⚠️ Fallback para template específico falhou. Tentando refresh agora...');
          // Se fallback falhou, fazer refresh e tentar novamente
          const currentUrl = page.url();
          await page.reload({ waitUntil: 'domcontentloaded', timeout: getTimeout(DEFAULT_TIMEOUTS.pageLoad, usingProxy) });
          await page.waitForTimeout(getDelay(DEFAULT_TIMEOUTS.mediumDelay, usingProxy));
          
          logger.info('Tentando novamente após refresh...');
          try {
            await page.waitForSelector('button:has-text("Use template")', { timeout: getTimeout(DEFAULT_TIMEOUTS.elementVisible, usingProxy) });
            logger.success('✅ Botão "Use template" encontrado após refresh');
          } catch (retryError) {
            logger.error(`❌ Botão "Use template" ainda não encontrado após refresh. URL: ${currentUrl}`);
            throw retryError; // Lançar erro se ainda não aparecer
          }
        }
      } else {
        throw error; // Re-lançar se não for timeout
      }
    }
    
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
    
    // 🔍 VERIFICAR BANNER DE ERRO DE REMIX
    await checkRemixErrorBanner(page, usingProxy);
    
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
 * Intercepta requisição de publicação e faz múltiplas requisições simultâneas
 * Segue a mesma lógica da extensão Chrome
 */
export async function interceptAndMultiplyRequests(page, numRequests, userId, usingProxy) {
  const startTime = Date.now();
  let projectId = null;
  let authToken = null;
  let requestIntercepted = false;
  let interceptionResolve = null;
  let interceptionPromise = new Promise((resolve) => {
    interceptionResolve = resolve;
  });
  
  const results = {
    sucessos: 0,
    falhas: 0,
    completadas: 0,
    total: numRequests - 1 // Número de requisições adicionais (a primeira já acontece)
  };

  logger.info(`🔧 Configurando interceptação: ${numRequests} requisições totais (${results.total} adicionais)`);

  // Configurar interceptação usando page.route()
  // Usar função para verificar URL completa incluindo query string
  await page.route('**/projects/*/deployments**', async (route) => {
    const request = route.request();
    const url = request.url();
    const method = request.method();
    
    // Verificar se é POST e se a URL contém async=true
    if (method !== 'POST' || !url.includes('async=true')) {
      await route.continue();
      return;
    }

    // Se já interceptamos, apenas continuar
    if (requestIntercepted) {
      await route.continue();
      return;
    }

    logger.info(`🎯 Requisição de publicação detectada! Project ID: ${projectId}`);
    requestIntercepted = true;

    // Extrair projectId da URL (já temos a URL da verificação acima)
    const projectIdMatch = url.match(/projects\/([^\/]+)/);
    if (projectIdMatch) {
      projectId = projectIdMatch[1];
    } else {
      logger.error(`❌ Não foi possível extrair projectId da URL`);
      await route.continue();
      interceptionResolve({
        success: false,
        error: 'Não foi possível extrair projectId'
      });
      return;
    }

    // Extrair token Authorization dos headers
    const headers = request.headers();
    authToken = headers['authorization'] || headers['Authorization'];
    
    if (!authToken) {
      logger.error(`❌ Token de autorização não encontrado nos headers`);
      await route.continue();
      interceptionResolve({
        success: false,
        error: 'Token de autorização não encontrado'
      });
      return;
    }

    // Continuar a requisição original normalmente
    await route.continue();

    // Fazer requisições adicionais simultâneas em paralelo - MÁXIMA VELOCIDADE
    logger.info(`⚡ Disparando ${results.total} requisições simultâneas (máxima velocidade)...`);
    
    // Criar todas as requisições instantaneamente, sem delays
    const additionalRequests = [];
    
    for (let i = 0; i < results.total; i++) {
      // Fazer requisição usando fetch dentro do contexto do navegador - SEM LOGS INDIVIDUAIS
      const requestPromise = page.evaluate(async ({ projectId, authToken }) => {
        try {
          const response = await fetch(`https://api.lovable.dev/projects/${projectId}/deployments?async=true`, {
            method: 'POST',
            headers: {
              'accept': '*/*',
              'accept-language': 'pt-BR,pt;q=0.9',
              'authorization': authToken,
              'content-type': 'application/json',
              'origin': 'https://lovable.dev',
              'referer': 'https://lovable.dev/',
              'sec-fetch-dest': 'empty',
              'sec-fetch-mode': 'cors',
              'sec-fetch-site': 'same-site'
            },
            credentials: 'include'
          });

          return {
            success: response.ok,
            status: response.status
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }, { projectId, authToken });

      additionalRequests.push(requestPromise);
    }

    // Aguardar todas as requisições adicionais e processar resultados - SEM LOGS INDIVIDUAIS
    Promise.allSettled(additionalRequests).then((responses) => {
      // Processar resultados rapidamente, sem logs individuais
      responses.forEach((result) => {
        results.completadas++;
        
        if (result.status === 'fulfilled') {
          const data = result.value;
          if (data.success) {
            results.sucessos++;
          } else {
            results.falhas++;
          }
        } else {
          results.falhas++;
        }
      });

      const tempoTotal = Date.now() - startTime;
      const creditosEstimados = (results.sucessos + 1) * 10; // +1 pela requisição original
      const taxaSucesso = results.total > 0 ? ((results.sucessos / results.total) * 100).toFixed(2) : 0;

      // Log resumido apenas
      logger.info(`✅ Requisições concluídas: ${results.sucessos + 1} sucessos, ${results.falhas} falhas (${tempoTotal}ms, ${taxaSucesso}% sucesso, ${creditosEstimados} créditos)`);

      interceptionResolve({
        success: true,
        projectId,
        sucessos: results.sucessos + 1,
        falhas: results.falhas,
        creditosEstimados,
        tempoTotal
      });
    }).catch((error) => {
      logger.error('❌ Erro ao processar requisições adicionais:', error);
      interceptionResolve({
        success: false,
        error: error.message
      });
    });
  });

  // Retornar função para limpar a interceptação e promise para aguardar
  return {
    cleanup: () => page.unroute('**/projects/*/deployments**').catch(() => {}),
    waitForCompletion: async () => {
      // Aguardar até que a interceptação aconteça (máximo 60 segundos) - SEM LOGS EXCESSIVOS
      const maxWait = 60000;
      const checkInterval = 500; // Verificar a cada 500ms para resposta mais rápida
      let waited = 0;
      
      while (!requestIntercepted && waited < maxWait) {
        await page.waitForTimeout(checkInterval);
        waited += checkInterval;
      }

      if (!requestIntercepted) {
        logger.warning(`⚠️ Interceptação não foi acionada após ${(waited / 1000).toFixed(1)}s`);
        await page.unroute('**/projects/*/deployments**').catch(() => {});
        return {
          success: false,
          error: 'Interceptação não foi acionada'
        };
      }

      // Aguardar conclusão das requisições adicionais
      const result = await interceptionPromise;
      
      // Limpar interceptação imediatamente
      await page.unroute('**/projects/*/deployments**').catch(() => {});
      
      return result;
    }
  };
}

/**
 * Etapa 5: Publicar projeto
 */
export async function useTemplateAndPublish(page, userId = 1, usingProxy = false, simulatedErrors = [], checkCreditsBanner = false, enableConcurrentRequests = false, concurrentRequests = 100) {
  const startTime = Date.now();
  
  try {
    logger.step(5, 'Publicando projeto');

    // ✅ VERIFICAR SE AINDA ESTÁ NA PÁGINA DO TEMPLATE
    // Se estiver, precisa clicar em "Use Template" primeiro
    logger.info('🔍 Verificando se está na página do template...');
    try {
      // Tentar encontrar botão "Use Template" (timeout curto para verificação rápida)
      await page.waitForSelector('button:has-text("Use template"), button:has-text("Use Template")', { 
        timeout: getTimeout(3000, usingProxy),
        state: 'visible'
      });
      
      // Se encontrou o botão, está na página do template ainda
      logger.warning('⚠️ Ainda está na página do template. Clicando em "Use Template" primeiro...');
      
      const useTemplateButton = await page.locator('button:has-text("Use template"), button:has-text("Use Template")').first();
      await useTemplateButton.click();
      logger.success('✅ Clicou em "Use Template"');
      
      await page.waitForTimeout(getDelay(1500, usingProxy));
      
      // Aguardar e clicar em "REMIX" (popup que aparece)
      logger.info('⏳ Aguardando popup "Remix"...');
      await page.waitForSelector('button:has-text("Remix"), button:has-text("remix")', { 
        timeout: getTimeout(DEFAULT_TIMEOUTS.elementVisible, usingProxy) 
      });
      
      const remixButton = await page.locator('button:has-text("Remix"), button:has-text("remix")').first();
      await remixButton.click();
      logger.success('✅ Clicou em "Remix"');
      
      // 🔍 VERIFICAR BANNER DE ERRO DE REMIX
      await checkRemixErrorBanner(page, usingProxy, 'useTemplateAndPublish');
      
      // Aguardar editor começar a carregar
      logger.info('⏳ Aguardando editor abrir...');
      await page.waitForTimeout(getDelay(DEFAULT_TIMEOUTS.longDelay, usingProxy));
      
    } catch (templateError) {
      // Se não encontrou o botão "Use Template", assume que já está no editor
      logger.info('✅ Já está no editor (botão "Use Template" não encontrado)');
    }

    // Aguardar editor carregar completamente (após clicar em Remix)
    logger.info('⏳ Aguardando editor carregar completamente...');
    await page.waitForTimeout(getDelay(DEFAULT_TIMEOUTS.veryLongDelay, usingProxy));
    
    // Se checkCreditsBanner estiver ativo, procurar o banner de créditos antes de publicar
    let bannerNotFound = false;
    if (checkCreditsBanner) {
      logger.info('🔍 Verificando banner de créditos no editor...');
      try {
        // Procurar pelo banner superior de créditos (texto sobre referral/bonus credits)
        const bannerFound = await page.evaluate(() => {
          const bodyText = document.body.innerText;
          // Procurar por textos relacionados a créditos de referral
          return bodyText.includes('10 credits') || 
                 bodyText.includes('10 créditos') ||
                 bodyText.includes('bonus credits') ||
                 bodyText.includes('referral') && bodyText.includes('credits');
        });
        
        if (bannerFound) {
          logger.success('✅ Banner de créditos encontrado no editor!');
        } else {
          // Tentar encontrar elementos específicos do banner
          try {
            await page.waitForSelector('text=/referral.*credits|bonus.*credits|10.*credits/i', { 
              timeout: getTimeout(3000, usingProxy) // Timeout curto para verificação rápida
            });
            logger.success('✅ Banner de créditos encontrado no editor (via seletor)!');
          } catch (e) {
            logger.error('❌ Banner de créditos não encontrado no editor');
            logger.warning('⚠️ Continuando publicação mesmo sem banner (será marcado como falha)');
            bannerNotFound = true;
          }
        }
      } catch (error) {
        if (error.message === 'Banner de crédito não encontrado na etapa final') {
          logger.warning('⚠️ Banner não encontrado, mas continuando publicação (será marcado como falha)');
          bannerNotFound = true;
        } else {
          logger.warning('⚠️ Erro ao verificar banner, mas continuando...', error.message);
        }
      }
    }
    
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

    // Configurar interceptação de requisições simultâneas ANTES de clicar (para máxima velocidade)
    let interceptionHandler = null;
    if (enableConcurrentRequests) {
      interceptionHandler = await interceptAndMultiplyRequests(page, concurrentRequests, userId, usingProxy);
    }

    // 1️⃣ Clicar no PRIMEIRO Publish (abre dropdown)
    const publishButton = page.locator('button:has-text("Publish"), button:has-text("Publicar")').first();
    await publishButton.click();
    logger.success('✅ Clicou no primeiro Publish (abrindo dropdown)');

    // Delay mínimo apenas para o dropdown aparecer
    await page.waitForTimeout(100); // Delay mínimo de 100ms

    // 2️⃣ Clicar no SEGUNDO Publish (dentro do dropdown) - MÁXIMA VELOCIDADE
    const allPublishButtons = await page.locator('button:has-text("Publish"), button:has-text("Publicar")').all();
    
    if (allPublishButtons.length > 1) {
      await allPublishButtons[1].click();
      logger.success('✅ Clicou no segundo Publish (confirmação)');
    } else {
      await allPublishButtons[0].click();
    }

    // Se interceptação estiver ativa, aguardar conclusão
    if (interceptionHandler) {
      logger.info('⏳ Aguardando conclusão das requisições simultâneas...');
      const interceptionResult = await interceptionHandler.waitForCompletion();
      
      if (interceptionResult.success) {
        logger.success(`✅ Requisições simultâneas concluídas: ${interceptionResult.sucessos} sucessos, ${interceptionResult.falhas} falhas`);
        logger.info(`💰 Créditos estimados: ${interceptionResult.creditosEstimados}`);
      } else {
        logger.warning(`⚠️ Interceptação não completou: ${interceptionResult.error || 'Erro desconhecido'}`);
      }
      
      // Limpar interceptação
      interceptionHandler.cleanup();
    }

    // Aguardar popup "You just shipped!" aparecer (verificar a cada 500ms, máximo 1 minuto)
    logger.info('⏳ Aguardando popup "You just shipped!" aparecer...');
    
    const maxWait = 60000; // 1 minuto máximo
    const checkInterval = 500; // Verificar a cada 500ms
    let waited = 0;
    let popupDetected = false;
    
    while (!popupDetected && waited < maxWait) {
      // Verificar se popup apareceu
      popupDetected = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        const lowerText = bodyText.toLowerCase();
        
        // Procurar por "You just shipped!" ou variações
        return lowerText.includes('you just shipped') ||
               lowerText.includes('just shipped') ||
               lowerText.includes('publicado') ||
               lowerText.includes('published') ||
               lowerText.includes('success') ||
               lowerText.includes('live') ||
               // Procurar também em elementos específicos de popup/modal
               document.querySelector('[class*="shipped"], [class*="success"], [class*="published"]') !== null;
      });
      
      if (popupDetected) {
        logger.success('🎉 Popup "You just shipped!" detectado! Encerrando sessão imediatamente...');
        break;
      }
      
      // Aguardar antes da próxima verificação
      await page.waitForTimeout(checkInterval);
      waited += checkInterval;
    }
    
    if (!popupDetected) {
      logger.warning(`⚠️ Popup não detectado após ${(waited / 1000).toFixed(1)}s, mas encerrando sessão...`);
    }
    
    logger.success('✅ Publicação concluída! Encerrando sessão...');

    const executionTime = Date.now() - startTime;
    
    // Se o banner não foi encontrado, marcar como falha mesmo tendo publicado
    if (bannerNotFound) {
      logger.warning('⚠️ Publicação concluída, mas banner de créditos não foi encontrado - marcando como falha');
      return {
        success: false,
        error: 'Banner de crédito não encontrado na etapa final',
        executionTime
      };
    }
    
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
