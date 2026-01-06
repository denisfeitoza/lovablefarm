import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';

/**
 * Realiza o cadastro do usuário
 */
export async function signup(page, email, password) {
  const startTime = Date.now();
  
  try {
    logger.step(1, 'Iniciando cadastro');

    // Navegar para o link de indicação
    await page.goto(config.referralLink, { 
      waitUntil: 'networkidle',
      timeout: config.timeout 
    });
    
    await page.waitForTimeout(config.delayBetweenActions);

    // Procurar campo de email (múltiplos seletores possíveis)
    const emailSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[placeholder*="email" i]',
      '#email'
    ];

    let emailInput = null;
    for (const selector of emailSelectors) {
      emailInput = await page.$(selector);
      if (emailInput) break;
    }

    if (!emailInput) {
      throw new Error('Campo de email não encontrado');
    }

    // Preencher email
    await emailInput.fill(email);
    logger.info('Email preenchido', { email });
    await page.waitForTimeout(500);

    // Procurar campo de senha
    const passwordSelectors = [
      'input[type="password"]',
      'input[name="password"]',
      '#password'
    ];

    let passwordInput = null;
    for (const selector of passwordSelectors) {
      passwordInput = await page.$(selector);
      if (passwordInput) break;
    }

    if (!passwordInput) {
      throw new Error('Campo de senha não encontrado');
    }

    // Preencher senha
    await passwordInput.fill(password);
    logger.info('Senha preenchida');
    await page.waitForTimeout(500);

    // Procurar botão de submit
    const submitSelectors = [
      'button[type="submit"]',
      'button:has-text("Sign up")',
      'button:has-text("Create account")',
      'button:has-text("Register")',
      'button:has-text("Cadastrar")',
      'button:has-text("Criar conta")'
    ];

    let submitButton = null;
    for (const selector of submitSelectors) {
      try {
        submitButton = await page.$(selector);
        if (submitButton && await submitButton.isVisible()) break;
      } catch (e) {
        continue;
      }
    }

    if (!submitButton) {
      throw new Error('Botão de submit não encontrado');
    }

    // Clicar no botão de submit
    await submitButton.click();
    logger.success('Formulário de cadastro enviado');

    // Aguardar navegação ou mensagem de sucesso
    try {
      await page.waitForNavigation({ 
        timeout: 10000,
        waitUntil: 'networkidle' 
      });
    } catch (e) {
      // Pode não haver navegação, apenas uma mensagem
      logger.info('Sem navegação após submit');
    }

    await page.waitForTimeout(config.delayBetweenActions);

    const executionTime = Date.now() - startTime;
    logger.success(`Cadastro concluído em ${executionTime}ms`);

    return {
      success: true,
      executionTime
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logger.error('Erro no cadastro', error);
    

    return {
      success: false,
      error: error.message,
      executionTime
    };
  }
}

/**
 * Verifica email através do link de verificação
 * APENAS aceita links no formato: https://lovable.dev/auth/action?mode=verifyEmail&...
 */
export async function verifyEmail(page, verificationLink) {
  const startTime = Date.now();
  
  try {
    logger.step(2, 'Verificando email');

    // Validar formato do link ANTES de navegar
    const isValidLovableLink = verificationLink.includes('lovable.dev/auth/action') &&
                                verificationLink.includes('mode=verifyEmail') &&
                                verificationLink.includes('oobCode=');
    
    if (!isValidLovableLink) {
      throw new Error(`Link de verificação inválido. Formato esperado: https://lovable.dev/auth/action?mode=verifyEmail&oobCode=...\nRecebido: ${verificationLink.substring(0, 100)}`);
    }

    logger.info('✅ Link de verificação validado', {
      url: verificationLink.substring(0, 80) + '...',
      hasMode: verificationLink.includes('mode=verifyEmail'),
      hasOobCode: verificationLink.includes('oobCode=')
    });

    // Navegar para o link de verificação
    await page.goto(verificationLink, { 
      waitUntil: 'networkidle',
      timeout: config.timeout 
    });

    await page.waitForTimeout(config.delayBetweenActions);

    // Aguardar confirmação (pode ser automática ou requerer clique)
    try {
      // Procurar por mensagem de sucesso
      const successSelectors = [
        'text=verified',
        'text=confirmed',
        'text=success',
        'text=verificado',
        'text=confirmado'
      ];

      let verified = false;
      for (const selector of successSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          verified = true;
          break;
        } catch (e) {
          continue;
        }
      }

      if (!verified) {
        // Procurar botão de confirmação
        const confirmButtons = [
          'button:has-text("Confirm")',
          'button:has-text("Verify")',
          'button:has-text("Continue")',
          'button:has-text("Confirmar")',
          'button:has-text("Verificar")',
          'button:has-text("Continuar")'
        ];

        for (const selector of confirmButtons) {
          try {
            const button = await page.$(selector);
            if (button && await button.isVisible()) {
              await button.click();
              logger.info('Botão de confirmação clicado');
              await page.waitForTimeout(2000);
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }
    } catch (e) {
      logger.warning('Verificação pode ter sido automática');
    }

    const executionTime = Date.now() - startTime;
    logger.success(`Email verificado em ${executionTime}ms`);

    return {
      success: true,
      executionTime
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logger.error('Erro na verificação de email', error);

    return {
      success: false,
      error: error.message,
      executionTime
    };
  }
}

