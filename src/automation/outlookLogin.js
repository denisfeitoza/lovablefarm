import { logger } from '../utils/logger.js';
import { getTimeout, getDelay } from '../utils/timeouts.js';

const DEFAULT_TIMEOUTS = {
  pageLoad: 30000,
  elementVisible: 10000,
  navigation: 15000
};

/**
 * Realiza login no Outlook usando credenciais
 * @param {Page} page - Página do Playwright
 * @param {string} email - Email do Outlook
 * @param {string} password - Senha do Outlook
 * @param {boolean} usingProxy - Se está usando proxy (para ajustar timeouts)
 * @returns {Promise<Object>} Resultado do login com informações da sessão
 */
export async function loginToOutlook(page, email, password, usingProxy = false) {
  const startTime = Date.now();
  
  try {
    logger.step(1, 'Login no Outlook');
    logger.info(`📧 Email: ${email}`);
    
    // 1. Navegar para o login da Microsoft
    logger.info('🌐 Navegando para login.microsoftonline.com...');
    await page.goto('https://login.microsoftonline.com', { 
      waitUntil: 'domcontentloaded', 
      timeout: getTimeout(DEFAULT_TIMEOUTS.pageLoad, usingProxy) 
    });
    await page.waitForTimeout(getDelay(2000, usingProxy));
    logger.success('✅ Página de login carregada');
    
    // 2. Preencher campo de email
    logger.info('📝 Preenchendo email...');
    
    // Múltiplos seletores para o campo de email
    const emailSelectors = [
      'input[type="email"]',
      'input[name="loginfmt"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="Email" i]',
      'input[placeholder*="telefone" i]',
      'input[placeholder*="Skype" i]',
      'input[id*="i0116"]',
      'input[aria-label*="email" i]'
    ];
    
    let emailInput = null;
    for (const selector of emailSelectors) {
      try {
        await page.waitForSelector(selector, { 
          timeout: getTimeout(5000, usingProxy),
          state: 'visible' 
        });
        emailInput = await page.locator(selector).first();
        if (await emailInput.isVisible()) {
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!emailInput) {
      throw new Error('❌ Campo de email não encontrado');
    }
    
    await emailInput.click();
    await page.waitForTimeout(getDelay(300, usingProxy));
    await emailInput.fill(email);
    await page.waitForTimeout(getDelay(500, usingProxy));
    logger.success('✅ Email preenchido');
    
    // 3. Clicar no botão "Avançar" ou pressionar Enter
    logger.info('🔘 Clicando em Avançar...');
    
    // Múltiplos seletores para o botão Avançar
    const nextButtonSelectors = [
      'input[type="submit"][value*="Avançar" i]',
      'input[type="submit"][value*="Next" i]',
      'button:has-text("Avançar")',
      'button:has-text("Next")',
      'input[id*="idSIButton"]',
      'button[id*="idSIButton"]',
      'input[type="submit"]',
      'button[type="submit"]'
    ];
    
    let nextButton = null;
    for (const selector of nextButtonSelectors) {
      try {
        const buttons = await page.locator(selector).all();
        for (const btn of buttons) {
          if (await btn.isVisible()) {
            const text = await btn.textContent().catch(() => '');
            const value = await btn.getAttribute('value').catch(() => '');
            if (text.includes('Avançar') || text.includes('Next') || 
                value.includes('Avançar') || value.includes('Next') ||
                selector.includes('submit')) {
              nextButton = btn;
              break;
            }
          }
        }
        if (nextButton) break;
      } catch (e) {
        continue;
      }
    }
    
    // Se não encontrou botão, tentar via JavaScript
    if (!nextButton) {
      logger.info('⚠️ Botão não encontrado via seletores, tentando via JavaScript...');
      const clicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        const nextBtn = buttons.find(btn => {
          const text = (btn.textContent || '').trim();
          const value = (btn.value || '').trim();
          return (text.includes('Avançar') || text.includes('Next') || 
                  value.includes('Avançar') || value.includes('Next')) &&
                 btn.offsetParent !== null; // Verifica se está visível
        });
        if (nextBtn) {
          nextBtn.click();
          return true;
        }
        return false;
      });
      
      if (!clicked) {
        // Última tentativa: pressionar Enter
        logger.info('⚠️ Tentando pressionar Enter...');
        await emailInput.press('Enter');
      }
    } else {
      await nextButton.click();
    }
    
    logger.success('✅ Clicou em Avançar');
    await page.waitForTimeout(getDelay(2000, usingProxy));
    
    // 4. Verificar se apareceu tela de verificação de email
    logger.info('🔍 Verificando se apareceu tela de verificação de email...');
    await page.waitForTimeout(getDelay(1500, usingProxy)); // Aguardar página carregar
    
    const hasEmailVerification = await page.evaluate(() => {
      const bodyText = document.body.innerText || '';
      return bodyText.includes('Verifique seu email') || 
             bodyText.includes('Verify your email') ||
             bodyText.includes('Enviaremos um código') ||
             bodyText.includes('We will send a code') ||
             bodyText.includes('Enviar código') ||
             bodyText.includes('Send code');
    });
    
    if (hasEmailVerification) {
      logger.info('📧 Tela de verificação de email detectada!');
      logger.info('🔘 Procurando e clicando em "Use sua senha"...');
      
      // Aguardar o elemento aparecer na página
      await page.waitForTimeout(getDelay(1500, usingProxy));
      
      let clicked = false;
      
      // Estratégia 1: Usar o ID específico do elemento (mais confiável)
      logger.info('🔍 Estratégia 1: Buscando pelo ID idA_PWD_SwitchToPassword...');
      try {
        await page.waitForSelector('#idA_PWD_SwitchToPassword', { 
          timeout: getTimeout(5000, usingProxy),
          state: 'visible' 
        });
        
        const usePasswordElement = page.locator('#idA_PWD_SwitchToPassword');
        if (await usePasswordElement.isVisible()) {
          await usePasswordElement.click();
          clicked = true;
          logger.success('✅ Clicou em "Use sua senha" via ID');
        }
      } catch (e) {
        logger.warning('⚠️ Elemento com ID não encontrado, tentando outras estratégias...');
      }
      
      if (!clicked) {
        // Estratégia 2: Buscar por role="button" com o texto
        logger.info('🔍 Estratégia 2: Buscando por role="button" com texto...');
        clicked = await page.evaluate(() => {
          // Buscar span com role="button" que contém "Use sua senha"
          const buttons = Array.from(document.querySelectorAll('span[role="button"]'));
          for (const btn of buttons) {
            const text = (btn.textContent || btn.innerText || '').trim();
            const isVisible = btn.offsetParent !== null;
            
            if (isVisible && (text === 'Use sua senha' || text === 'Use your password')) {
              try {
                btn.click();
                return true;
              } catch (e) {
                // Tentar via evento
                const clickEvent = new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                });
                btn.dispatchEvent(clickEvent);
                return true;
              }
            }
          }
          return false;
        });
        
        if (clicked) {
          logger.success('✅ Clicou em "Use sua senha" via role="button"');
        }
      }
      
      if (!clicked) {
        // Estratégia 3: Buscar por texto em todos os elementos
        logger.info('🔍 Estratégia 3: Buscando por texto em todos os elementos...');
        clicked = await page.evaluate(() => {
          const allElements = Array.from(document.querySelectorAll('*'));
          
          for (const el of allElements) {
            const text = (el.textContent || el.innerText || '').trim();
            const isVisible = el.offsetParent !== null && 
                             window.getComputedStyle(el).display !== 'none' &&
                             window.getComputedStyle(el).visibility !== 'hidden';
            
            if (isVisible && (
              text === 'Use sua senha' || 
              text === 'Use your password'
            )) {
              try {
                el.click();
                return true;
              } catch (e) {
                const clickEvent = new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                });
                el.dispatchEvent(clickEvent);
                return true;
              }
            }
          }
          return false;
        });
        
        if (clicked) {
          logger.success('✅ Clicou em "Use sua senha" via busca de texto');
        }
      }
      
      if (!clicked) {
        logger.error('❌ Não foi possível encontrar ou clicar em "Use sua senha"');
        logger.info('💡 Tentando continuar mesmo assim...');
      } else {
        await page.waitForTimeout(getDelay(2000, usingProxy));
      }
    }
    
    // 5. Aguardar página de senha carregar
    logger.info('⏳ Aguardando página de senha...');
    
    // Aguardar URL mudar ou campo de senha aparecer
    await Promise.race([
      page.waitForURL(/login\.live\.com|login\.microsoftonline\.com/, { timeout: getTimeout(DEFAULT_TIMEOUTS.navigation, usingProxy) }),
      page.waitForSelector('input[type="password"]', { timeout: getTimeout(DEFAULT_TIMEOUTS.elementVisible, usingProxy) })
    ]).catch(() => {
      logger.warning('⚠️ Timeout aguardando página de senha, continuando...');
    });
    
    await page.waitForTimeout(getDelay(1000, usingProxy));
    
    // 6. Preencher campo de senha
    logger.info('🔒 Preenchendo senha...');
    
    const passwordSelectors = [
      'input[type="password"]',
      'input[name="passwd"]',
      'input[id*="i0118"]',
      'input[aria-label*="senha" i]',
      'input[aria-label*="password" i]'
    ];
    
    let passwordInput = null;
    for (const selector of passwordSelectors) {
      try {
        await page.waitForSelector(selector, { 
          timeout: getTimeout(5000, usingProxy),
          state: 'visible' 
        });
        passwordInput = await page.locator(selector).first();
        if (await passwordInput.isVisible()) {
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!passwordInput) {
      throw new Error('❌ Campo de senha não encontrado');
    }
    
    await passwordInput.click();
    await page.waitForTimeout(getDelay(300, usingProxy));
    await passwordInput.fill(password);
    await page.waitForTimeout(getDelay(500, usingProxy));
    logger.success('✅ Senha preenchida');
    
    // 7. Clicar no botão "Entrar"
    logger.info('🔘 Clicando em Entrar...');
    
    const loginButtonSelectors = [
      'input[type="submit"][value*="Entrar" i]',
      'input[type="submit"][value*="Sign in" i]',
      'button:has-text("Entrar")',
      'button:has-text("Sign in")',
      'input[id*="idSIButton"]',
      'button[id*="idSIButton"]'
    ];
    
    let loginButton = null;
    for (const selector of loginButtonSelectors) {
      try {
        const buttons = await page.locator(selector).all();
        for (const btn of buttons) {
          if (await btn.isVisible()) {
            const text = await btn.textContent().catch(() => '');
            const value = await btn.getAttribute('value').catch(() => '');
            if (text.includes('Entrar') || text.includes('Sign in') || 
                value.includes('Entrar') || value.includes('Sign in')) {
              loginButton = btn;
              break;
            }
          }
        }
        if (loginButton) break;
      } catch (e) {
        continue;
      }
    }
    
    // Se não encontrou, tentar via JavaScript
    if (!loginButton) {
      logger.info('⚠️ Botão Entrar não encontrado via seletores, tentando via JavaScript...');
      const clicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        const loginBtn = buttons.find(btn => {
          const text = (btn.textContent || '').trim();
          const value = (btn.value || '').trim();
          return (text.includes('Entrar') || text.includes('Sign in') || 
                  value.includes('Entrar') || value.includes('Sign in')) &&
                 btn.offsetParent !== null;
        });
        if (loginBtn) {
          loginBtn.click();
          return true;
        }
        return false;
      });
      
      if (!clicked) {
        // Última tentativa: pressionar Enter
        logger.info('⚠️ Tentando pressionar Enter no campo de senha...');
        await passwordInput.press('Enter');
      }
    } else {
      await loginButton.click();
    }
    
    logger.success('✅ Clicou em Entrar');
    
    // 8. Aguardar página processar após clicar em Entrar
    await page.waitForTimeout(getDelay(3000, usingProxy));
    
    // Verificar se apareceu tela informativa "Uma observação rápida sobre sua conta Microsoft"
    logger.info('🔍 Verificando se apareceu tela informativa da Microsoft...');
    const hasInfoScreen = await page.evaluate(() => {
      const bodyText = document.body.innerText || '';
      return bodyText.includes('Uma observação rápida sobre sua conta Microsoft') || 
             bodyText.includes('A quick note about your Microsoft account') ||
             bodyText.includes('Seus itens importantes estão aqui') ||
             bodyText.includes('Your important items are here') ||
             bodyText.includes('A sua privacidade é nossa prioridade') ||
             bodyText.includes('Your privacy is our priority');
    });
    
    if (hasInfoScreen) {
      logger.info('📋 Tela informativa detectada! Clicando em OK...');
      
      // Procurar botão OK
      const okButtonSelectors = [
        'button:has-text("OK")',
        'button:has-text("Ok")',
        'input[type="submit"][value*="OK" i]',
        'input[type="button"][value*="OK" i]',
        'button[type="submit"]',
        'input[type="submit"]'
      ];
      
      let okClicked = false;
      for (const selector of okButtonSelectors) {
        try {
          const buttons = await page.locator(selector).all();
          for (const btn of buttons) {
            if (await btn.isVisible()) {
              const text = await btn.textContent().catch(() => '');
              const value = await btn.getAttribute('value').catch(() => '');
              if (text.includes('OK') || text.includes('Ok') || value.includes('OK') || value.includes('Ok')) {
                await btn.click();
                okClicked = true;
                logger.success('✅ Clicou em OK');
                break;
              }
            }
          }
          if (okClicked) break;
        } catch (e) {
          continue;
        }
      }
      
      // Se não encontrou via seletores, tentar via JavaScript
      if (!okClicked) {
        okClicked = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
          const okBtn = buttons.find(btn => {
            const text = (btn.textContent || '').trim();
            const value = (btn.value || '').trim();
            return (text === 'OK' || text === 'Ok' || value === 'OK' || value === 'Ok') &&
                   btn.offsetParent !== null;
          });
          
          if (okBtn) {
            okBtn.click();
            return true;
          }
          return false;
        });
        
        if (okClicked) {
          logger.success('✅ Clicou em OK via JavaScript');
        } else {
          logger.warning('⚠️ Botão OK não encontrado, mas continuando...');
        }
      }
      
      // Aguardar navegação após clicar em OK
      try {
        await page.waitForNavigation({ 
          timeout: getTimeout(5000, usingProxy),
          waitUntil: 'domcontentloaded' 
        }).catch(() => {
          // Se não houver navegação, continuar
        });
      } catch (e) {
        // Navegação pode já ter acontecido
      }
      await page.waitForTimeout(getDelay(2000, usingProxy));
    }
    
    // Verificar se apareceu tela "Vamos proteger sua conta" (pede email alternativo)
    logger.info('🔍 Verificando se apareceu tela "Vamos proteger sua conta"...');
    await page.waitForTimeout(getDelay(2000, usingProxy)); // Aguardar página carregar
    
    let hasProtectAccountScreen = false;
    try {
      hasProtectAccountScreen = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        return bodyText.includes('Vamos proteger sua conta') || 
               bodyText.includes("Let's protect your account") ||
               bodyText.includes('Adicione outra maneira de verificar') ||
               bodyText.includes('Add another way to verify') ||
               bodyText.includes('Ignorar por enquanto') ||
               bodyText.includes('Skip for now') ||
               bodyText.includes('Que informações de segurança') ||
               bodyText.includes('What security info');
      });
    } catch (e) {
      // Página pode ter navegado, continuar
      logger.warning('⚠️ Erro ao verificar tela de proteção de conta');
    }
    
    if (hasProtectAccountScreen) {
      logger.info('🛡️ Tela "Vamos proteger sua conta" detectada! Clicando em "Ignorar por enquanto"...');
      
      // Aguardar elemento aparecer
      await page.waitForTimeout(getDelay(1000, usingProxy));
      
      let skipClicked = false;
      
      // Estratégia 1: Buscar por texto completo via JavaScript (mais confiável)
      logger.info('🔍 Estratégia 1: Buscando "Ignorar por enquanto" via JavaScript...');
      skipClicked = await page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('*'));
        
        for (const el of allElements) {
          const text = (el.textContent || el.innerText || '').trim();
          const isVisible = el.offsetParent !== null && 
                           window.getComputedStyle(el).display !== 'none' &&
                           window.getComputedStyle(el).visibility !== 'hidden';
          
          // Verificar se contém "Ignorar por enquanto" ou "Skip for now"
          if (isVisible && (
            text.includes('Ignorar por enquanto') || 
            text.includes('Skip for now') ||
            (text.includes('Ignorar') && text.includes('dias')) ||
            (text.includes('Skip') && text.includes('days'))
          )) {
            try {
              el.click();
              return true;
            } catch (e) {
              // Tentar via evento
              const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
              });
              el.dispatchEvent(clickEvent);
              return true;
            }
          }
        }
        return false;
      });
      
      if (skipClicked) {
        logger.success('✅ Clicou em "Ignorar por enquanto" via JavaScript');
      } else {
        // Estratégia 2: Tentar seletores CSS
        logger.info('🔍 Estratégia 2: Tentando seletores CSS...');
        const skipSelectors = [
          'a:has-text("Ignorar")',
          'a:has-text("Skip")',
          'button:has-text("Ignorar")',
          'button:has-text("Skip")',
          'span:has-text("Ignorar")',
          'span:has-text("Skip")',
          'div:has-text("Ignorar")',
          'div:has-text("Skip")'
        ];
        
        for (const selector of skipSelectors) {
          try {
            const elements = await page.locator(selector).all();
            for (const el of elements) {
              if (await el.isVisible()) {
                const text = await el.textContent().catch(() => '');
                if (text.includes('Ignorar') || text.includes('Skip')) {
                  await el.click();
                  skipClicked = true;
                  logger.success(`✅ Clicou em "Ignorar por enquanto" via seletor: ${selector}`);
                  break;
                }
              }
            }
            if (skipClicked) break;
          } catch (e) {
            continue;
          }
        }
      }
      
      if (!skipClicked) {
        logger.warning('⚠️ Link "Ignorar por enquanto" não encontrado, mas continuando...');
      }
      
      // Aguardar navegação após clicar em Ignorar
      try {
        await page.waitForNavigation({ 
          timeout: getTimeout(5000, usingProxy),
          waitUntil: 'domcontentloaded' 
        }).catch(() => {});
      } catch (e) {
        // Navegação pode já ter acontecido
      }
      await page.waitForTimeout(getDelay(2000, usingProxy));
    }
    
    // Navegar direto para o Outlook após login (sem cancelar passkey)
    logger.info('📧 Navegando para o Outlook...');
    try {
      await page.goto('https://outlook.live.com/mail/0/', { 
        waitUntil: 'domcontentloaded', 
        timeout: getTimeout(DEFAULT_TIMEOUTS.pageLoad, usingProxy) 
      });
      await page.waitForTimeout(getDelay(3000, usingProxy));
      logger.success('✅ Navegou para o Outlook');
      
      // Verificar e fechar banner de privacidade/consentimento se aparecer
      logger.info('🔍 Verificando se apareceu banner de privacidade...');
      try {
        // Aguardar um pouco para o banner aparecer (se existir)
        await page.waitForTimeout(getDelay(2000, usingProxy));
        
        const privacyBannerClosed = await page.evaluate(() => {
          // Procurar por texto relacionado a privacidade/consentimento
          const bodyText = document.body.innerText.toLowerCase();
          const hasPrivacyText = bodyText.includes('processamos dados') || 
                                 bodyText.includes('process data') ||
                                 bodyText.includes('política de privacidade') ||
                                 bodyText.includes('privacy policy') ||
                                 bodyText.includes('fornecedores processam');
          
          if (!hasPrivacyText) {
            return { closed: false, reason: 'Banner não encontrado' };
          }
          
          // Procurar por botões de aceitar/rejeitar privacidade
          const buttons = Array.from(document.querySelectorAll('button'));
          const acceptButton = buttons.find(btn => {
            const text = btn.textContent.trim().toLowerCase();
            const isVisible = btn.offsetParent !== null;
            return isVisible && (
              text === 'aceitar' || 
              text === 'aceitar tudo' || 
              text === 'accept' || 
              text === 'accept all' ||
              (text.includes('aceitar') && !text.includes('rejeitar'))
            );
          });
          
          const rejectButton = buttons.find(btn => {
            const text = btn.textContent.trim().toLowerCase();
            const isVisible = btn.offsetParent !== null;
            return isVisible && (
              text === 'rejeitar' || 
              text === 'reject' ||
              (text.includes('rejeitar') && !text.includes('aceitar'))
            );
          });
          
          // Se encontrar botão de aceitar, clicar nele (preferência)
          if (acceptButton) {
            acceptButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => acceptButton.click(), 100);
            return { closed: true, method: 'accept' };
          }
          
          // Se não encontrar aceitar, tentar rejeitar
          if (rejectButton) {
            rejectButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => rejectButton.click(), 100);
            return { closed: true, method: 'reject' };
          }
          
          return { closed: false, reason: 'Botões não encontrados' };
        });
        
        if (privacyBannerClosed.closed) {
          logger.success(`✅ Banner de privacidade fechado (método: ${privacyBannerClosed.method})`);
          await page.waitForTimeout(getDelay(1500, usingProxy)); // Aguardar banner desaparecer
        } else {
          logger.info(`ℹ️ ${privacyBannerClosed.reason || 'Nenhum banner de privacidade encontrado'}`);
        }
      } catch (privacyError) {
        logger.warning(`⚠️ Erro ao verificar banner de privacidade: ${privacyError.message}`);
        // Continuar mesmo se houver erro
      }
      
      // Procurar e clicar no último email de verificação da Lovable
      logger.info('🔍 Procurando último email de verificação da Lovable...');
      await page.waitForTimeout(getDelay(3000, usingProxy)); // Aguardar emails carregarem
      
      let emailClicked = false;
      
      // Estratégia 1: Procurar por texto e encontrar elemento pai clicável (mais confiável)
      logger.info('🔍 Estratégia 1: Procurando texto e elemento pai clicável...');
      emailClicked = await page.evaluate(() => {
        // Procurar todos os nós de texto
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );
        
        let node;
        const candidates = [];
        
        while (node = walker.nextNode()) {
          const text = node.textContent.toLowerCase().trim();
          // Procurar especificamente por "verify your email for lovable.dev"
          if (text.includes('verify your email') && 
              (text.includes('lovable.dev') || text.includes('lovable')) &&
              !text.includes('microsoft')) {
            // Encontrar elemento pai que seja clicável
            let parent = node.parentElement;
            let depth = 0;
            while (parent && parent !== document.body && depth < 10) {
              const style = window.getComputedStyle(parent);
              const isVisible = parent.offsetParent !== null && 
                               style.display !== 'none' &&
                               style.visibility !== 'hidden';
              
              if (isVisible) {
                // Verificar se o elemento tem eventos de clique ou é interativo
                const tagName = parent.tagName.toLowerCase();
                const hasClick = parent.onclick !== null || 
                                parent.getAttribute('onclick') !== null ||
                                tagName === 'a' ||
                                tagName === 'button' ||
                                parent.getAttribute('role') === 'button' ||
                                parent.getAttribute('tabindex') !== null;
                
                if (hasClick || parent.style.cursor === 'pointer') {
                  candidates.push({
                    element: parent,
                    depth: depth,
                    text: text
                  });
                }
              }
              parent = parent.parentElement;
              depth++;
            }
          }
        }
        
        // Ordenar por profundidade (menor = mais próximo do texto)
        candidates.sort((a, b) => a.depth - b.depth);
        
        // Tentar clicar no primeiro candidato (mais próximo do texto)
        for (const candidate of candidates) {
          try {
            candidate.element.click();
            return true;
          } catch (e) {
            // Tentar via evento
            const clickEvent = new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window,
              button: 0
            });
            candidate.element.dispatchEvent(clickEvent);
            return true;
          }
        }
        
        return false;
      });
      
      if (!emailClicked) {
        // Estratégia 2: Procurar por seletores CSS específicos do Outlook
        logger.info('🔍 Estratégia 2: Procurando por seletores CSS do Outlook...');
        try {
          const emailSelectors = [
            '[role="listitem"]',
            '[role="option"]',
            '.ms-List-cell',
            '[data-convid]',
            'div[tabindex]',
            '[aria-label*="email"]'
          ];
          
          for (const selector of emailSelectors) {
            try {
              const elements = await page.locator(selector).all();
              for (const el of elements) {
                const text = await el.textContent().catch(() => '');
                const lowerText = text.toLowerCase();
                if (lowerText.includes('verify your email') && 
                    (lowerText.includes('lovable.dev') || lowerText.includes('lovable')) &&
                    !lowerText.includes('microsoft')) {
                  // Tentar clicar
                  await el.click({ timeout: 2000 }).catch(() => {});
                  await page.waitForTimeout(500);
                  emailClicked = true;
                  logger.success(`✅ Clicou no email via seletor: ${selector}`);
                  break;
                }
              }
              if (emailClicked) break;
            } catch (e) {
              continue;
            }
          }
        } catch (e) {
          logger.warning('⚠️ Erro ao tentar seletores CSS');
        }
      }
      
      if (!emailClicked) {
        // Estratégia 3: Procurar por todos os elementos e tentar clicar
        logger.info('🔍 Estratégia 3: Busca ampla em todos os elementos...');
        emailClicked = await page.evaluate(() => {
          const allElements = Array.from(document.querySelectorAll('*'));
          
          for (const el of allElements) {
            const text = (el.textContent || '').toLowerCase();
            const isVisible = el.offsetParent !== null;
            
            if (isVisible && 
                text.includes('verify your email') && 
                (text.includes('lovable.dev') || text.includes('lovable')) &&
                !text.includes('microsoft')) {
              try {
                el.click();
                return true;
              } catch (e) {
                const clickEvent = new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                });
                el.dispatchEvent(clickEvent);
                return true;
              }
            }
          }
          return false;
        });
        
        if (emailClicked) {
          logger.success('✅ Clicou no email via busca ampla');
        }
      }
      
      if (emailClicked) {
        logger.success('✅ Clicou no email de verificação');
        await page.waitForTimeout(getDelay(3000, usingProxy));
        
        // Procurar e clicar no link de verificação
        logger.info('🔗 Procurando link de verificação no email...');
        await page.waitForTimeout(getDelay(2000, usingProxy));
        
        let linkClicked = false;
        let verificationLink = null;
        
        // Estratégia 1: Procurar por link com href do lovable.dev (mais específico)
        logger.info('🔍 Estratégia 1: Procurando link do lovable.dev...');
        const linkResult = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a[href]'));
          
          for (const link of links) {
            const href = (link.getAttribute('href') || '').toLowerCase();
            const isVisible = link.offsetParent !== null;
            
            // Procurar link do lovable.dev com verifyEmail, oobCode ou action
            if (isVisible && 
                href.includes('lovable.dev') && 
                (href.includes('verify') || href.includes('verifyemail') || href.includes('oobcode') || href.includes('action'))) {
              return link.href; // Retornar o href completo
            }
          }
          return null;
        });
        
        if (linkResult) {
          verificationLink = linkResult;
          logger.info(`✅ Link encontrado: ${verificationLink.substring(0, 100)}...`);
        } else {
          // Estratégia 2: Procurar qualquer link do lovable.dev
          logger.info('🔍 Estratégia 2: Procurando qualquer link do lovable.dev...');
          const anyLovableLink = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href]'));
            
            for (const link of links) {
              const href = (link.getAttribute('href') || '').toLowerCase();
              const isVisible = link.offsetParent !== null;
              
              if (isVisible && href.includes('lovable.dev')) {
                return link.href;
              }
            }
            return null;
          });
          
          if (anyLovableLink) {
            verificationLink = anyLovableLink;
            logger.info(`✅ Link do lovable.dev encontrado: ${verificationLink.substring(0, 100)}...`);
          }
        }
        
        // Se encontrou o link, navegar para ele
        if (verificationLink) {
          try {
            logger.info('🔗 Navegando para o link de verificação...');
            await page.goto(verificationLink, { 
              waitUntil: 'domcontentloaded', 
              timeout: getTimeout(DEFAULT_TIMEOUTS.pageLoad, usingProxy) 
            });
            linkClicked = true;
            logger.success('✅ Navegou para o link de verificação');
          } catch (e) {
            logger.warning(`⚠️ Erro ao navegar para o link: ${e.message}`);
            // Tentar clicar no link se a navegação falhar
            try {
              const clicked = await page.evaluate((linkUrl) => {
                const links = Array.from(document.querySelectorAll('a[href]'));
                for (const link of links) {
                  if (link.href === linkUrl) {
                    link.click();
                    return true;
                  }
                }
                return false;
              }, verificationLink);
              
              if (clicked) {
                linkClicked = true;
                logger.success('✅ Clicou no link de verificação');
              }
            } catch (e2) {
              logger.warning(`⚠️ Erro ao clicar no link: ${e2.message}`);
            }
          }
        } else {
          logger.warning('⚠️ Link de verificação não encontrado no email');
        }
        
        if (linkClicked) {
          logger.success('✅ Clicou no link de verificação');
          await page.waitForTimeout(getDelay(3000, usingProxy));
        } else {
          logger.warning('⚠️ Link de verificação não encontrado no email');
        }
      } else {
        logger.warning('⚠️ Email de verificação da Lovable não encontrado ou não foi possível clicar');
      }
    } catch (e) {
      logger.warning(`⚠️ Erro ao navegar para o Outlook: ${e.message}`);
    }
    
    // Verificar se apareceu tela de verificação de segurança (que pede código por email)
    logger.info('🔍 Verificando se apareceu tela de verificação de segurança...');
    let hasSecurityVerification = false;
    try {
      hasSecurityVerification = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        return bodyText.includes('Ajude-nos a proteger sua conta') || 
               bodyText.includes('Help us protect your account') ||
               bodyText.includes('Detectamos algo incomum') ||
               bodyText.includes('We detected something unusual') ||
               bodyText.includes('Email para') && bodyText.includes('Tenho um código') ||
               bodyText.includes('Email to') && bodyText.includes('I have a code');
      });
    } catch (e) {
      // Página pode ter navegado, continuar
      logger.warning('⚠️ Erro ao verificar tela de verificação de segurança (página pode ter navegado)');
    }
    
    if (hasSecurityVerification) {
      const executionTime = Date.now() - startTime;
      logger.error('❌ Tela de verificação de segurança detectada!');
      logger.error('📧 Email cadastrado com email de verificação - não é possível prosseguir');
      
      return {
        success: false,
        email,
        error: 'Email cadastrado com email de verificação',
        executionTime,
        requiresVerification: true
      };
    }
    
    const currentUrl = page.url();
    const executionTime = Date.now() - startTime;
    
    logger.success(`✅ Clicou em Entrar - aguardando próximo passo`);
    logger.info(`📍 URL atual: ${currentUrl}`);
    
    // Delay removido - modo produção
    
    return {
      success: true,
      email,
      url: currentUrl,
      executionTime
    };
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logger.error(`❌ Erro no login do Outlook: ${error.message}`);
    
    return {
      success: false,
      email,
      error: error.message,
      executionTime
    };
  }
}

