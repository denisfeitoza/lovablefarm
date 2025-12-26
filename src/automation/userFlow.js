import { chromium } from 'playwright';
import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';
import { emailService } from '../services/emailService.js';
import { proxyService } from '../services/proxyService.js';
import { signupOnLovable, verifyEmailInSameSession, completeOnboardingQuiz, selectTemplate, useTemplateAndPublish } from './lovableFlow.js';
import os from 'os';
import path from 'path';
import fs from 'fs';

/**
 * Executa o fluxo completo de um usuário
 * @param {number} userId - ID do usuário
 * @param {string} referralLink - Link de indicação (obrigatório)
 * @param {string} domain - Domínio específico para o email (opcional)
 */
export async function executeUserFlow(userId, referralLink, domain = null) {
  const startTime = Date.now();
  const result = {
    userId,
    success: false,
    email: null,
    steps: {},
    error: null,
    executionTime: 0
  };

  let context = null;
  let page = null;
  let tempDir = null;

  // Validar link de indicação
  if (!referralLink) {
    throw new Error('Link de indicação é obrigatório');
  }

  try {
    logger.info(`\n${'='.repeat(60)}`);
    logger.info(`🚀 Iniciando fluxo do usuário ${userId}`);
    if (domain) logger.info(`📧 Usando domínio específico: ${domain}`);
    logger.info(`${'='.repeat(60)}\n`);

    // 1. Gerar email temporário único (com domínio específico se fornecido)
    logger.info('📧 Gerando email temporário...');
    const emailData = await emailService.generateEmail(userId, domain);
    result.email = emailData.email;
    logger.success(`Email gerado: ${emailData.email}`);

    // 2. Configurar proxy (se habilitado)
    const proxyString = proxyService.getRandomProxy();
    const proxyConfig = proxyString ? proxyService.getProxyConfig(proxyString) : null;
    
    if (proxyConfig) {
      logger.info('🌐 Usando proxy', { proxy: proxyConfig.server });
    }

    // 3. Criar diretório temporário único (simula modo incógnito isolado)
    tempDir = path.join(os.tmpdir(), `playwright-incognito-${userId}-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    logger.info(`📁 Diretório temporário: ${tempDir}`);

    // 4. Iniciar navegador em MODO INCÓGNITO REAL (launchPersistentContext)
    logger.info('🌐 Iniciando navegador em MODO INCÓGNITO REAL...');
    
    const contextOptions = {
      headless: config.headless,
      viewport: generateRandomViewport(),
      userAgent: generateRandomUserAgent(),
      locale: generateRandomLocale(),
      timezoneId: generateRandomTimezone(),
      permissions: ['geolocation'],
      geolocation: generateRandomGeolocation(),
      colorScheme: Math.random() > 0.5 ? 'dark' : 'light',
      deviceScaleFactor: Math.random() > 0.5 ? 1 : 2,
      isMobile: false,
      hasTouch: Math.random() > 0.7,
      acceptDownloads: false,
      ignoreHTTPSErrors: true,
      args: [
        // ============================================
        // MODO INCÓGNITO / PRIVADO (PRIORIDADE MÁXIMA)
        // ============================================
        '--incognito',                    // ✅ Modo anônimo REAL do Chrome
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-background-networking',
        '--disable-extensions',
        '--disable-sync',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-first-run',
        '--no-default-browser-check'
      ]
    };

    if (proxyConfig) {
      contextOptions.proxy = proxyConfig;
    }

    // ✅ USAR launchPersistentContext (modo incógnito REAL)
    context = await chromium.launchPersistentContext(tempDir, contextOptions);
    
    logger.info('✅ Contexto criado em modo incógnito (via --incognito flag)');
    
    // Fechar páginas extras que possam ter sido abertas
    const pages = context.pages();
    for (let i = 1; i < pages.length; i++) {
      await pages[i].close().catch(() => {});
    }
    
    // Limpar TUDO no contexto antes de usar
    await context.clearCookies();
    await context.clearPermissions();
    
    // Adicionar scripts AVANÇADOS para evitar detecção de automação e bot
    await context.addInitScript(() => {
      // Limpar TUDO antes de iniciar (storage, cookies, cache, indexedDB)
      try {
        // LocalStorage
        if (window.localStorage) {
          localStorage.clear();
        }
        
        // SessionStorage
        if (window.sessionStorage) {
          sessionStorage.clear();
        }
        
        // Cookies
        if (document.cookie) {
          document.cookie.split(";").forEach(c => {
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, `=;expires=${new Date(0).toUTCString()};path=/`);
          });
        }
        
        // IndexedDB
        if (window.indexedDB) {
          try {
            indexedDB.databases().then(dbs => {
              dbs.forEach(db => indexedDB.deleteDatabase(db.name));
            }).catch(() => {});
          } catch (e) {}
        }
        
        // Cache Storage
        if (window.caches) {
          caches.keys().then(names => {
            names.forEach(name => caches.delete(name));
          }).catch(() => {});
        }
        
        console.log('🧹 Storage completamente limpo - Sessão 100% anônima');
      } catch (e) {
        console.log('Erro ao limpar storage:', e);
      }

      // Remover webdriver flag
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });

      // Adicionar plugins realistas
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          {
            0: {type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format"},
            description: "Portable Document Format",
            filename: "internal-pdf-viewer",
            length: 1,
            name: "Chrome PDF Plugin"
          },
          {
            0: {type: "application/pdf", suffixes: "pdf", description: "Portable Document Format"},
            description: "Portable Document Format",
            filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
            length: 1,
            name: "Chrome PDF Viewer"
          },
          {
            0: {type: "application/x-nacl", suffixes: "", description: "Native Client Executable"},
            description: "Native Client Executable",
            filename: "internal-nacl-plugin",
            length: 2,
            name: "Native Client"
          }
        ],
      });

      // Adicionar languages variadas
      Object.defineProperty(navigator, 'languages', {
        get: () => ['pt-BR', 'pt', 'en-US', 'en'],
      });

      // Override de Chrome runtime
      window.chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
      };

      // Override de permissões
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );

      // Randomizar hardware concurrency
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => Math.floor(Math.random() * 8) + 2
      });

      // Randomizar deviceMemory
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => [2, 4, 8][Math.floor(Math.random() * 3)]
      });

      // Adicionar canvas fingerprint aleatório
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(type) {
        if (type === 'image/png' && this.width === 0 && this.height === 0) {
          return 'data:image/png;base64,iVBORw0KGg';
        }
        return originalToDataURL.apply(this, arguments);
      };

      // WebGL Fingerprinting Protection
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        // Randomizar vendor e renderer para cada sessão
        if (parameter === 37445) { // UNMASKED_VENDOR_WEBGL
          const vendors = ['Intel Inc.', 'Google Inc.', 'NVIDIA Corporation', 'AMD'];
          return vendors[Math.floor(Math.random() * vendors.length)];
        }
        if (parameter === 37446) { // UNMASKED_RENDERER_WEBGL
          const renderers = [
            'ANGLE (Intel, Intel(R) UHD Graphics 630, OpenGL 4.1)',
            'ANGLE (NVIDIA, NVIDIA GeForce GTX 1060, OpenGL 4.5)',
            'ANGLE (AMD, AMD Radeon RX 580, OpenGL 4.5)',
            'ANGLE (Intel, Intel(R) Iris(TM) Graphics 640, OpenGL 4.1)'
          ];
          return renderers[Math.floor(Math.random() * renderers.length)];
        }
        return getParameter.apply(this, arguments);
      };
    });

    // ✅ USAR a página que já foi criada automaticamente (NÃO criar nova)
    page = context.pages()[0] || await context.newPage();
    
    logger.info(`✅ Usando página em modo incógnito (total de páginas: ${context.pages().length})`);
    
    // Adicionar headers extras para parecer mais humano
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    });

    // 4. Realizar cadastro na Lovable
    logger.info('\n📝 Etapa 1: Cadastro na Lovable');
    logger.info(`🔗 Usando link de indicação: ${referralLink}`);
    const password = generateRandomPassword();
    
    // Salvar credenciais no resultado para o dashboard
    result.credentials = {
      email: emailData.email,
      password: password
    };
    
    const signupResult = await signupOnLovable(page, emailData.email, password, userId, referralLink);
    result.steps.signup = signupResult.executionTime;

    // 5. Aguardar email de verificação
    logger.info('\n📬 Etapa 2: Aguardando Email de Verificação');
    const verificationEmail = await emailService.waitForVerificationEmail(
      emailData, // Passa o objeto completo com email, proxyId, etc
      40, // 40 tentativas × 3s = 120s total
      3000 // 3 segundos entre tentativas
    );
    
    const verificationLink = emailService.extractVerificationLink(verificationEmail);
    
    // 6. Clicar no link de verificação NA MESMA SESSÃO
    logger.info('\n✅ Etapa 3: Clicando em Link de Verificação (mesma sessão)');
    const verifyResult = await verifyEmailInSameSession(page, verificationLink, userId);
    result.steps.emailVerification = verifyResult.executionTime;

    // 7. Completar quiz de onboarding
    logger.info('\n📝 Etapa 4: Completando Quiz de Onboarding');
    const quizResult = await completeOnboardingQuiz(page, userId);
    result.steps.onboardingQuiz = quizResult.executionTime;

    // 8. Selecionar template
    logger.info('\n🎨 Etapa 5: Selecionando Template');
    const templateResult = await selectTemplate(page, userId);
    result.steps.selectTemplate = templateResult.executionTime;

    // 9. Usar template e publicar
    logger.info('\n🚀 Etapa 6: Usando Template e Publicando');
    const publishResult = await useTemplateAndPublish(page, userId);
    result.steps.useTemplateAndPublish = publishResult.executionTime;

    // 10. Sucesso!
    result.success = true;
    result.creditsEarned = 10; // Assumindo 10 créditos por indicação
    result.executionTime = Date.now() - startTime;

    logger.info(`\n${'='.repeat(60)}`);
    logger.success(`✅ Usuário ${userId} completou o fluxo com sucesso!`);
    logger.success(`💰 Créditos gerados: ${result.creditsEarned}`);
    logger.success(`⏱️  Tempo total: ${result.executionTime}ms`);
    logger.info(`${'='.repeat(60)}\n`);

  } catch (error) {
    result.success = false;
    result.error = error.message || 'Erro desconhecido';
    result.executionTime = Date.now() - startTime;
    
    // Determinar qual etapa falhou
    if (!result.steps.signup) {
      result.failedStep = 'Cadastro';
    } else if (!result.steps.emailVerification) {
      result.failedStep = 'Verificação de Email';
    } else if (!result.steps.onboardingQuiz) {
      result.failedStep = 'Quiz de Onboarding';
    } else if (!result.steps.selectTemplate) {
      result.failedStep = 'Seleção de Template';
    } else if (!result.steps.useTemplateAndPublish) {
      result.failedStep = 'Usar Template / Publicar';
    } else {
      result.failedStep = 'Desconhecida';
    }

    logger.error(`❌ Usuário ${userId} falhou na etapa: ${result.failedStep}`);
    logger.error(`❌ Erro: ${error.message}`);

    // Tirar screenshot final do erro
    if (page) {
      try {
        await page.screenshot({ 
          path: `reports/error-user-${userId}-final-${Date.now()}.png`,
          fullPage: true 
        });
      } catch (e) {
        // Ignorar erro de screenshot
      }
    }
  } finally {
    // NÃO FECHAR NAVEGADOR EM CASO DE ERRO (debug mode)
    if (result.success) {
      // Sucesso: fechar tudo normalmente e limpar diretório temporário
      // NÃO fechar page separadamente - já será fechada com o context
      if (context) await context.close().catch(() => {});
      
      // Limpar diretório temporário
      if (tempDir) {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
          logger.info(`🧹 Diretório temporário removido: ${tempDir}`);
        } catch (e) {
          logger.warning(`⚠️ Não foi possível remover o diretório: ${e.message}`);
        }
      }
      
      logger.info('🧹 Recursos limpos');
    } else {
      // ERRO: NUNCA FECHAR - deixar aberto indefinidamente
      logger.error('🚨 ERRO DETECTADO - NAVEGADOR MANTIDO ABERTO INDEFINIDAMENTE');
      logger.warning('⚠️ Navegador NÃO será fechado automaticamente');
      logger.warning('⚠️ Feche manualmente quando terminar de debugar');
      logger.info(`📍 URL atual: ${page ? await page.url().catch(() => 'indisponível') : 'indisponível'}`);
      logger.info(`📁 Diretório temporário mantido: ${tempDir}`);
      // NÃO fechar automaticamente - deixar aberto para sempre
    }
  }

  return result;
}

/**
 * Gera User-Agent aleatório muito variado
 */
function generateRandomUserAgent() {
  const chromeVersions = ['119.0.0.0', '120.0.0.0', '121.0.0.0', '122.0.0.0'];
  const firefoxVersions = ['120.0', '121.0', '122.0', '123.0'];
  const safariVersions = ['17.1', '17.2', '17.3'];
  
  const userAgents = [
    // Chrome Windows
    `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersions[Math.floor(Math.random() * chromeVersions.length)]} Safari/537.36`,
    // Chrome Mac
    `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersions[Math.floor(Math.random() * chromeVersions.length)]} Safari/537.36`,
    // Chrome Linux
    `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersions[Math.floor(Math.random() * chromeVersions.length)]} Safari/537.36`,
    // Firefox
    `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${firefoxVersions[Math.floor(Math.random() * firefoxVersions.length)]}) Gecko/20100101 Firefox/${firefoxVersions[Math.floor(Math.random() * firefoxVersions.length)]}`,
    // Safari
    `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${safariVersions[Math.floor(Math.random() * safariVersions.length)]} Safari/605.1.15`
  ];
  
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

/**
 * Gera viewport aleatório (resoluções comuns)
 */
function generateRandomViewport() {
  const viewports = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1536, height: 864 },
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 1600, height: 900 },
    { width: 2560, height: 1440 }
  ];
  
  return viewports[Math.floor(Math.random() * viewports.length)];
}

/**
 * Gera locale aleatório (focando em português/inglês)
 */
function generateRandomLocale() {
  const locales = [
    'pt-BR',
    'pt-PT', 
    'en-US',
    'en-GB',
    'es-ES'
  ];
  
  return locales[Math.floor(Math.random() * locales.length)];
}

/**
 * Gera timezone aleatório (Brasil e outros)
 */
function generateRandomTimezone() {
  const timezones = [
    'America/Sao_Paulo',
    'America/Rio_Branco',
    'America/Manaus',
    'America/Fortaleza',
    'America/Recife',
    'America/Bahia'
  ];
  
  return timezones[Math.floor(Math.random() * timezones.length)];
}

/**
 * Gera geolocalização aleatória (Brasil)
 */
function generateRandomGeolocation() {
  // Coordenadas de diferentes cidades brasileiras
  const locations = [
    { latitude: -23.5505, longitude: -46.6333 }, // São Paulo
    { latitude: -22.9068, longitude: -43.1729 }, // Rio de Janeiro
    { latitude: -15.7939, longitude: -47.8828 }, // Brasília
    { latitude: -12.9714, longitude: -38.5014 }, // Salvador
    { latitude: -25.4284, longitude: -49.2733 }, // Curitiba
    { latitude: -30.0346, longitude: -51.2177 }, // Porto Alegre
    { latitude: -3.7172, longitude: -38.5433 },  // Fortaleza
    { latitude: -8.0476, longitude: -34.8770 }   // Recife
  ];
  
  return locations[Math.floor(Math.random() * locations.length)];
}

/**
 * Gera senha aleatória
 */
function generateRandomPassword() {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const special = '!@#$%&*';
  
  // GARANTIR requisitos mínimos:
  // - Pelo menos 8 caracteres
  // - Pelo menos um número (0-9)
  let password = '';
  
  // Adicionar pelo menos um número (OBRIGATÓRIO)
  password += numbers[Math.floor(Math.random() * numbers.length)];
  
  // Adicionar pelo menos uma letra minúscula
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  
  // Adicionar pelo menos uma letra maiúscula
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  
  // Adicionar caractere especial
  password += special[Math.floor(Math.random() * special.length)];
  
  // Completar até 12 caracteres
  const allChars = lowercase + uppercase + numbers + special;
  for (let i = password.length; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Embaralhar para não ter padrão
  password = password.split('').sort(() => Math.random() - 0.5).join('');
  
  return password;
}

