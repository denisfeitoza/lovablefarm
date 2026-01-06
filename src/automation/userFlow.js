import { chromium } from 'playwright';
import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';
import { emailService } from '../services/emailService.js';
import { proxyService } from '../services/proxyService.js';
import { outlookCredentialsService } from '../services/outlookCredentialsService.js';
import { getTimeout, getDelay } from '../utils/timeouts.js';
import { signupOnLovable, verifyEmailInSameSession, completeOnboardingQuiz, selectTemplate, useTemplateAndPublish, fallbackToTemplate, loginToLovable, checkPublishedProjects, findCreditsBanner } from './lovableFlow.js';
import { loginToOutlook } from './outlookLogin.js';
import os from 'os';
import path from 'path';
import fs from 'fs';

/**
 * Verifica se está no quiz e preenche se necessário antes de lançar erro
 * @param {Page} page - Página do Playwright
 * @param {number} userId - ID do usuário
 * @param {boolean} usingProxy - Se está usando proxy
 * @returns {Promise<boolean>} true se preencheu o quiz e pode continuar, false caso contrário
 */
async function checkAndCompleteQuizIfNeeded(page, userId, usingProxy) {
  try {
    const currentUrl = page.url();
    
    // Verificar se está no quiz
    if (currentUrl.includes('/getting-started') || 
        currentUrl.includes('/onboarding') || 
        currentUrl.includes('/quiz')) {
      logger.warning('⚠️ Detectado quiz antes de erro! Preenchendo quiz primeiro...');
      logger.info(`📍 URL atual: ${currentUrl}`);
      
      try {
        const quizResult = await completeOnboardingQuiz(page, userId, null, usingProxy);
        logger.success(`✅ Quiz preenchido com sucesso! Tempo: ${quizResult.executionTime}ms`);
        
        // Aguardar redirect após preencher quiz
        await page.waitForTimeout(getDelay(2000, usingProxy));
        
        // Verificar URL após preencher quiz
        const urlAfterQuiz = page.url();
        logger.info(`📍 URL após preencher quiz: ${urlAfterQuiz}`);
        
        // Se ainda está no quiz, aguardar mais
        if (urlAfterQuiz.includes('/getting-started') || 
            urlAfterQuiz.includes('/onboarding') || 
            urlAfterQuiz.includes('/quiz')) {
          logger.warning('⚠️ Ainda está no quiz após preencher. Aguardando redirect...');
          await page.waitForTimeout(getDelay(3000, usingProxy));
        }
        
        return true; // Quiz preenchido, pode continuar
      } catch (quizError) {
        logger.error(`❌ Erro ao preencher quiz: ${quizError.message}`);
        return false; // Não conseguiu preencher quiz
      }
    }
    
    return false; // Não está no quiz
  } catch (e) {
    logger.warning(`⚠️ Erro ao verificar URL para quiz: ${e.message}`);
    return false;
  }
}

/**
 * Executa o fluxo completo de um usuário
 * @param {number} userId - ID do usuário
 * @param {string} referralLink - Link de indicação (obrigatório)
 * @param {string} domain - Domínio específico para o email (opcional)
 * @param {string} proxyString - Proxy específico para usar (opcional)
 * @param {Array} simulatedErrors - Lista de erros a simular para testar fallbacks (opcional)
 * @param {boolean} turboMode - Se true, pula quiz e seleção de template, vai direto para fallback (opcional)
 * @param {boolean} checkCreditsBanner - Se true, verifica banner de créditos no editor antes de publicar (só funciona com turboMode) (opcional)
 * @param {boolean} enableConcurrentRequests - Se true, ativa teste de requisições simultâneas (opcional)
 * @param {number} concurrentRequests - Número de requisições simultâneas a fazer (padrão: 100) (opcional)
 * @param {boolean} useOutlook - Se true, usa credenciais do Outlook em vez de email temporário (opcional)
 */
export async function executeUserFlow(userId, referralLink, domain = null, proxyString = null, simulatedErrors = [], turboMode = false, checkCreditsBanner = false, enableConcurrentRequests = false, concurrentRequests = 100, useOutlook = false) {
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
  let outlookEmail = null; // Declarar no escopo principal para acessar no catch

  // Validar link de indicação
  if (!referralLink) {
    throw new Error('Link de indicação é obrigatório');
  }

  try {
    logger.info(`\n${'='.repeat(60)}`);
    logger.info(`🚀 Iniciando fluxo do usuário ${userId}`);
    if (domain) logger.info(`📧 Usando domínio específico: ${domain}`);
    logger.info(`📬 Modo Outlook recebido: ${useOutlook} (tipo: ${typeof useOutlook})`);
    if (useOutlook) {
      logger.info(`📧 Usando modo Outlook (credenciais reais)`);
    } else {
      logger.info(`📧 Usando modo Inbound (email temporário)`);
    }
    logger.info(`${'='.repeat(60)}\n`);

    // 1. Obter email (Outlook ou temporário)
    let emailData = null;
    let outlookCredential = null;
    // outlookEmail já declarado no escopo principal
    let outlookPassword = null;
    
    // Verificar explicitamente se useOutlook é true (suporta boolean e string)
    const shouldUseOutlook = useOutlook === true || useOutlook === 'true' || (useOutlook !== false && useOutlook !== 'false' && useOutlook !== undefined && useOutlook !== null);
    
    logger.info(`🔍 Verificação useOutlook: valor=${useOutlook}, tipo=${typeof useOutlook}, shouldUseOutlook=${shouldUseOutlook}`);
    
    if (shouldUseOutlook) {
      // Modo Outlook: obter credencial disponível (o retry será feito durante o cadastro)
      logger.info('📧 Obtendo credencial Outlook disponível...');
      outlookCredential = outlookCredentialsService.getNextUnusedCredential();
      
      if (!outlookCredential) {
        throw new Error('❌ Nenhuma credencial Outlook disponível. Adicione credenciais na interface.');
      }
      
      outlookEmail = outlookCredential.email;
      outlookPassword = outlookCredential.password;
      
      emailData = { email: outlookEmail };
      result.email = outlookEmail;
      logger.success(`✅ Credencial Outlook obtida: ${outlookEmail}`);
    } else {
      // Modo normal: gerar email temporário
    logger.info('📧 Gerando email temporário...');
      logger.info(`⚠️ useOutlook é ${useOutlook} (tipo: ${typeof useOutlook}), usando modo Inbound`);
      emailData = await emailService.generateEmail(userId, domain);
    result.email = emailData.email;
    logger.success(`Email gerado: ${emailData.email}`);
    }

    // 2. Configurar proxy (usar proxy específico se fornecido, senão tentar obter um)
    let finalProxyString = proxyString;
    if (!finalProxyString && config.proxyEnabled) {
      finalProxyString = proxyService.getRandomProxy();
    }
    const proxyConfig = finalProxyString ? proxyService.getProxyConfig(finalProxyString) : null;
    const usingProxy = !!proxyConfig;
    
    if (proxyConfig) {
      logger.info('🌐 Usando proxy', { 
        proxy: proxyConfig.server,
        hasAuth: !!(proxyConfig.username && proxyConfig.password)
      });
      logger.info('⏱️ Timeouts aumentados para navegação com proxy');
    } else {
      logger.info('🌐 Usando IP local (sem proxy)');
    }

    // 3. Criar diretório temporário único (simula modo incógnito isolado)
    tempDir = path.join(os.tmpdir(), `playwright-incognito-${userId}-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    logger.info(`📁 Diretório temporário: ${tempDir}`);

    // 4. Iniciar navegador em MODO INCÓGNITO REAL (launchPersistentContext)
    logger.info('🌐 Iniciando navegador em MODO INCÓGNITO REAL...');
    
    const contextOptions = {
      headless: config.headless,
      args: [
        '--incognito'  // APENAS modo anônimo básico
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
    
    // SEM scripts - navegador 100% nativo

    // ✅ USAR a página que já foi criada automaticamente
    page = context.pages()[0] || await context.newPage();
    
    logger.info(`✅ Navegador anônimo iniciado (${context.pages().length} página)`);

    // 4. Realizar cadastro na Lovable PRIMEIRO (antes do login no Outlook)
    logger.info('\n📝 Etapa 1: Cadastro na Lovable');
    logger.info(`🔗 Usando link de indicação: ${referralLink}`);
    
    let password;
    let signupResult;
    
    if (useOutlook) {
      // Modo Outlook: usar senha do Outlook e fazer retry automático se conta já existir
      password = outlookPassword;
      let maxRetries = 5;
      let retryCount = 0;
      let cadastroSucesso = false;
      
      while (retryCount < maxRetries && !cadastroSucesso) {
        try {
          logger.info(`🔄 Tentativa ${retryCount + 1}/${maxRetries} com credencial: ${outlookEmail}`);
          signupResult = await signupOnLovable(page, emailData.email, password, userId, referralLink, usingProxy);
          result.steps.signup = signupResult.executionTime;
          cadastroSucesso = true;
          logger.success(`✅ Cadastro bem-sucedido com ${outlookEmail}`);
        } catch (signupError) {
          // Se a conta já existe, fazer login e seguir o fluxo
          if (signupError.message === 'ACCOUNT_ALREADY_EXISTS') {
            logger.warning(`⚠️ Conta ${outlookEmail} já existe - fazendo login para verificar...`);
            
            try {
              // Fazer login no Lovable (NÃO vai pro Outlook)
              logger.info('🔐 Fazendo login na conta existente...');
              const loginResult = await loginToLovable(page, outlookEmail, outlookPassword, usingProxy);
              
              if (loginResult.success) {
                logger.success('✅ Login bem-sucedido!');
                
                result.steps.signup = loginResult.executionTime;
                
                // Verificar URL atual para saber se está no quiz
                const currentUrl = page.url();
                logger.info(`📍 URL após login: ${currentUrl}`);
                
                // CRÍTICO: Verificar se a conta precisa verificar email antes de pular
                // Mesmo que a conta exista, pode não ter verificado o email ainda
                logger.info('🔍 Verificando se conta precisa verificar email...');
                await page.waitForTimeout(getDelay(2000, usingProxy)); // Aguardar página estabilizar
                
                // PRIMEIRO: Verificar URL - se contém /verify-email, PRECISA verificar
                const currentUrlAfterLogin = page.url();
                const urlNeedsVerification = currentUrlAfterLogin.includes('/verify-email') || 
                                              currentUrlAfterLogin.includes('verify-email') ||
                                              currentUrlAfterLogin.includes('verifyemail');
                
                if (urlNeedsVerification) {
                  logger.warning(`⚠️ URL indica que precisa verificar email: ${currentUrlAfterLogin}`);
                  logger.warning('⚠️ Conta precisa verificar email! Não pulando verificação.');
                  result.skipEmailVerification = false; // NÃO pular - precisa verificar
                  result.steps.emailVerification = false; // Ainda não verificou
                  logger.info('📧 URL contém /verify-email - continuando para verificação no Outlook...');
                  cadastroSucesso = true; // Login foi bem-sucedido, mas precisa verificar email
                  break; // Sair do loop de retry - vai para verificação de email no Outlook
                }
                
                // SEGUNDO: Verificar conteúdo da página
                const needsEmailVerification = await page.evaluate(() => {
                  const bodyText = document.body.innerText.toLowerCase();
                  const url = window.location.href.toLowerCase();
                  
                  // Verificar se há mensagem de verificação de email
                  const hasVerificationMessage = bodyText.includes('verify your email') ||
                                                 bodyText.includes('verifique seu email') ||
                                                 bodyText.includes('verificar email') ||
                                                 bodyText.includes('check your email') ||
                                                 bodyText.includes('confirme seu email') ||
                                                 bodyText.includes('email verification') ||
                                                 url.includes('verify-email') ||
                                                 url.includes('verifyemail');
                  
                  // Verificar se está bloqueado por falta de verificação
                  const isBlocked = bodyText.includes('please verify') ||
                                   bodyText.includes('por favor verifique') ||
                                   bodyText.includes('email not verified') ||
                                   bodyText.includes('email não verificado');
                  
                  return hasVerificationMessage || isBlocked;
                });
                
                if (needsEmailVerification) {
                  logger.warning('⚠️ Conta precisa verificar email! Não pulando verificação.');
                  result.skipEmailVerification = false; // NÃO pular - precisa verificar
                  result.steps.emailVerification = false; // Ainda não verificou
                  logger.info('📧 Conta precisa verificar email - continuando para verificação no Outlook...');
                  // Marcar cadastroSucesso para sair do loop de retry, mas NÃO pular verificação de email
                  cadastroSucesso = true; // Login foi bem-sucedido, mas precisa verificar email
                  break; // Sair do loop de retry - vai para verificação de email no Outlook
                } else {
                  logger.success('✅ Conta não precisa verificar email - pode pular verificação');
                  // IMPORTANTE: Marcar skipEmailVerification APENAS se não precisar verificar
                  result.skipEmailVerification = true;
                  result.steps.emailVerification = true;
                }
                
                // NOVO FLUXO: Verificar se tem quiz na tela (getting-started)
                if (currentUrl.includes('/getting-started')) {
                  // TEM QUIZ NA TELA
                  if (turboMode) {
                    // Modo Turbo: Pular quiz e procurar banner no editor
                    logger.info('⚡ Modo Turbo + Quiz detectado: Pulando quiz e procurando banner no editor...');
                    cadastroSucesso = true;
                    // O fluxo continuará depois (turbo mode vai para fallback e procura banner no editor)
                    break; // Sair do loop - o fluxo continuará depois
                  } else {
                    // Modo Normal: Preencher quiz, depois ir pro template e procurar banner
                    logger.info('📝 Quiz detectado (getting-started): Preenchendo quiz, depois template -> banner...');
                    cadastroSucesso = true;
                    // O fluxo continuará normalmente: quiz será preenchido depois, depois template, depois banner
                    break; // Sair do loop - o fluxo continuará depois
                  }
                } else {
                  // NÃO TEM QUIZ - Verificar se tem projeto publicado
                  const projectsInfo = await checkPublishedProjects(page, usingProxy);
                  
                  if (!projectsInfo.hasPublishedProject) {
                    // Não tem projeto publicado - ir pro template e procurar banner
                    logger.info('📊 Conta não tem projeto publicado - indo pro template e procurando banner...');
                    
                    // Procurar banner de créditos (aguarda 5 segundos internamente)
                    const bannerInfo = await findCreditsBanner(page, usingProxy);
                      
                    if (bannerInfo.found) {
                      logger.success('🎉 Banner de créditos encontrado! Seguindo fluxo normal para publicar projeto...');
                      cadastroSucesso = true;
                      result.steps.creditsBannerCheck = true;
                      break; // Sair do loop - continuar fluxo normal
                    } else {
                      // Banner não encontrado - publicar e sair (mesmo fluxo normal)
                      logger.warning('⚠️ Banner de créditos não encontrado. Continuando fluxo normal (publicar e sair)...');
                      cadastroSucesso = true;
                      result.steps.creditsBannerCheck = false;
                      break; // Continuar fluxo normal - vai publicar e sair
                    }
                  } else {
                    logger.info(`📊 Conta já tem ${projectsInfo.publishedCount} projeto(s) publicado(s).`);
                    // Conta já tem projeto, marcar como sucesso mas não continuar fluxo
                    result.success = true;
                    result.creditsEarned = 0;
                    cadastroSucesso = true;
                    break;
                  }
                }
              }
            } catch (loginError) {
              // Se o erro é "Execution context was destroyed", pode ser que o login funcionou (navegação ocorreu)
              if (loginError.message.includes('Execution context was destroyed') || 
                  loginError.message.includes('navigation')) {
                logger.warning('⚠️ Navegação detectada durante login - verificando se funcionou...');
                
                // Aguardar navegação completar
                try {
                  await page.waitForNavigation({ 
                    waitUntil: 'domcontentloaded', 
                    timeout: getTimeout(5000, usingProxy) 
                  }).catch(() => {
                    // Navegação pode já ter acontecido
                  });
                } catch (e) {
                  // Ignorar erro de navegação
                }
                
                await page.waitForTimeout(getDelay(2000, usingProxy));
                
                // Verificar URL atual
                let currentUrl = '';
                try {
                  currentUrl = page.url();
                  logger.info(`📍 URL após possível navegação: ${currentUrl}`);
                } catch (e) {
                  logger.warning('⚠️ Não foi possível obter URL, mas continuando...');
                  // Tentar aguardar mais um pouco
                  await page.waitForTimeout(getDelay(2000, usingProxy));
                  try {
                    currentUrl = page.url();
                  } catch (e2) {
                    // Se ainda não conseguir, assumir que pode ter funcionado
                    logger.warning('⚠️ Ainda não foi possível obter URL, mas assumindo que login pode ter funcionado');
                    currentUrl = 'lovable.dev'; // Valor padrão para passar na verificação
                  }
                }
                
                // CRÍTICO: Se ainda está em /login, login FALHOU - NÃO continuar
                if (currentUrl.includes('/login')) {
                  logger.error(`❌ Login falhou - ainda na página de login (URL: ${currentUrl})`);
                  logger.error('❌ NÃO continuando fluxo - login não foi bem-sucedido');
                  result.skipEmailVerification = false; // Não fez login, pode fechar navegador
                  // Lançar erro para parar o fluxo
                  throw new Error('Erro ao fazer login: credenciais inválidas ou senha incorreta. URL ainda em /login');
                }
                
                // Se não está mais na página de login, assumir que login funcionou
                if (currentUrl.includes('lovable.dev')) {
                  logger.success('✅ Login parece ter funcionado (navegação detectada, não está mais em /login)');
                  
                  // IMPORTANTE: Marcar skipEmailVerification ANTES de verificar projetos
                  // Isso garante que o navegador NÃO será fechado mesmo se houver erro
                  result.skipEmailVerification = true;
                  result.steps.signup = Date.now() - startTime;
                  result.steps.emailVerification = true;
                  
                  // Verificar se tem projeto publicado (só se não estiver no quiz)
                  try {
                    const currentUrlCheck = page.url();
                    if (currentUrlCheck.includes('/getting-started')) {
                      // Se está no quiz, não verificar projetos - continuar fluxo
                      logger.info('📝 Está no quiz, continuando fluxo...');
                      cadastroSucesso = true;
                      break;
                    }
                    
                    const projectsInfo = await checkPublishedProjects(page, usingProxy);
                    
                    if (!projectsInfo.hasPublishedProject) {
                      logger.info('📊 Conta não tem projeto publicado - procurando banner de créditos...');
                      
                      // Procurar banner de créditos
                      const bannerInfo = await findCreditsBanner(page, usingProxy);
                      
                      if (bannerInfo.found) {
                        logger.success('🎉 Banner de créditos encontrado! Seguindo fluxo normal para publicar projeto...');
                        
                        // Se tiver banner, seguir o fluxo normal
                        cadastroSucesso = true;
                        result.steps.creditsBannerCheck = true;
                        break; // Sair do loop de retry - navegador NÃO será fechado
                      } else {
                        logger.warning('⚠️ Banner de créditos não encontrado.');
                        // Continuar para tentar próxima credencial
                        result.skipEmailVerification = false; // Resetar se não tiver banner
                      }
                    } else {
                      logger.info(`📊 Conta já tem ${projectsInfo.publishedCount} projeto(s) publicado(s).`);
                      result.success = true;
                      result.creditsEarned = 0;
                      cadastroSucesso = true;
                      break; // Sair do loop - navegador NÃO será fechado
                    }
                  } catch (checkError) {
                    logger.error(`❌ Erro ao verificar projetos/banner: ${checkError.message}`);
                    // Se deu erro mas está logado, tentar continuar mesmo assim
                    if (!currentUrl.includes('/login')) {
                      logger.warning('⚠️ Erro ao verificar, mas parece estar logado - continuando fluxo...');
                      cadastroSucesso = true;
                      // skipEmailVerification já está true, manter
                      break; // Continuar fluxo - navegador NÃO será fechado
                    } else {
                      result.skipEmailVerification = false; // Resetar se não estiver logado
                    }
                  }
                } else {
                  // Ainda está na página de login, login falhou DEFINITIVAMENTE
                  logger.error(`❌ Login falhou - ainda na página de login (URL: ${currentUrl})`);
                  logger.error('❌ NÃO continuando fluxo - login não foi bem-sucedido');
                  result.skipEmailVerification = false; // Não fez login, pode fechar navegador
                  // Lançar erro para parar o fluxo imediatamente
                  throw new Error('Erro ao fazer login: credenciais inválidas ou senha incorreta. URL ainda em /login');
                }
              } else {
                logger.error(`❌ Erro ao fazer login: ${loginError.message}`);
              }
              
              // Se chegou aqui e não conseguiu usar a conta, tentar próxima credencial
              // MAS só se cadastroSucesso ainda for false E skipEmailVerification não estiver definido
              // IMPORTANTE: Só marcar como usada se foi erro de LOGIN (não conseguiu fazer login)
              if (!cadastroSucesso && !result.skipEmailVerification) {
                // Verificar se o erro foi de login (credenciais inválidas)
                const isLoginError = loginError.message.includes('credenciais inválidas') ||
                                   loginError.message.includes('senha incorreta') ||
                                   loginError.message.includes('password') ||
                                   loginError.message.includes('invalid') ||
                                   loginError.message.includes('login falhou') ||
                                   loginError.message.includes('Login falhou');
                
                // Só marcar como usada se foi erro de login
                if (isLoginError) {
                outlookCredentialsService.markAsUsed(outlookEmail);
                  logger.warning(`⚠️ Credencial ${outlookEmail} marcada como usada (erro de login)`);
                } else {
                  logger.info(`ℹ️ Credencial ${outlookEmail} NÃO marcada como usada (erro não é de login: ${loginError.message})`);
                }
                retryCount++;
                
                if (retryCount >= maxRetries) {
                  throw new Error('❌ Limite de tentativas atingido');
                }
                
                const nextCredential = outlookCredentialsService.getNextUnusedCredential();
                if (!nextCredential) {
                  throw new Error('❌ Nenhuma credencial disponível');
                }
                
                outlookEmail = nextCredential.email;
                outlookPassword = nextCredential.password;
                emailData = { email: outlookEmail };
                result.email = outlookEmail;
                password = outlookPassword;
                
                await page.goto(referralLink, { waitUntil: 'domcontentloaded', timeout: getTimeout(30000, usingProxy) });
                await page.waitForTimeout(getDelay(2000, usingProxy));
                continue;
              } else if (result.skipEmailVerification && !cadastroSucesso) {
                // Se skipEmailVerification está true mas cadastroSucesso é false,
                // significa que fez login mas não encontrou banner - continuar mesmo assim
                logger.warning('⚠️ Login funcionou mas não encontrou banner - continuando fluxo mesmo assim');
                cadastroSucesso = true; // Forçar para continuar
                break; // Sair do loop e continuar fluxo
              }
            }
            
            // Se chegou aqui, não conseguiu usar a conta existente, tentar próxima
            // IMPORTANTE: Só marcar como usada se foi erro de LOGIN
            // Se foi outro erro (banner não encontrado, etc), NÃO marcar como usada
            const isLoginError = loginError && (
              loginError.message.includes('credenciais inválidas') ||
              loginError.message.includes('senha incorreta') ||
              loginError.message.includes('password') ||
              loginError.message.includes('invalid') ||
              loginError.message.includes('login falhou') ||
              loginError.message.includes('Login falhou')
            );
            
            if (isLoginError) {
            outlookCredentialsService.markAsUsed(outlookEmail);
              logger.warning(`⚠️ Credencial ${outlookEmail} marcada como usada (erro de login)`);
            } else {
              logger.info(`ℹ️ Credencial ${outlookEmail} NÃO marcada como usada (erro não é de login)`);
            }
            retryCount++;
            
            // Verificar se ainda há tentativas disponíveis
            if (retryCount >= maxRetries) {
              logger.error(`❌ Limite de tentativas (${maxRetries}) atingido`);
              throw new Error('❌ Todas as credenciais tentadas já possuem conta cadastrada');
            }
            
            // Obter próxima credencial
            logger.info(`🔍 Buscando próxima credencial disponível...`);
            const stats = outlookCredentialsService.getStats();
            logger.info(`📊 Estatísticas: ${stats.unused} disponíveis de ${stats.total} total`);
            
            const nextCredential = outlookCredentialsService.getNextUnusedCredential();
            if (!nextCredential) {
              logger.error(`❌ Nenhuma credencial disponível encontrada (${stats.unused} disponíveis de ${stats.total} total)`);
              throw new Error(`❌ Todas as credenciais disponíveis já possuem conta cadastrada. Adicione mais credenciais ou resete o status das existentes.`);
            }
            
            outlookEmail = nextCredential.email;
            outlookPassword = nextCredential.password;
            emailData = { email: outlookEmail };
            result.email = outlookEmail;
            password = outlookPassword;
            logger.success(`✅ Nova credencial Outlook obtida: ${outlookEmail}`);
            
            // Navegar de volta para a página de cadastro antes de tentar novamente
            logger.info('🔄 Navegando de volta para página de cadastro...');
            await page.goto(referralLink, { waitUntil: 'domcontentloaded', timeout: getTimeout(30000, usingProxy) });
            await page.waitForTimeout(getDelay(2000, usingProxy));
            logger.info('✅ Página de cadastro recarregada, tentando novamente...');
            
            continue; // Tentar novamente com nova credencial
          }
          // Se for outro erro, lançar normalmente
          throw signupError;
        }
      }
      
      if (!cadastroSucesso) {
        throw new Error('❌ Todas as credenciais tentadas já possuem conta cadastrada');
      }
    } else {
      // Modo normal: gerar senha aleatória
      password = generateRandomPassword();
      signupResult = await signupOnLovable(page, emailData.email, password, userId, referralLink, usingProxy);
      result.steps.signup = signupResult.executionTime;
    }
    
    // Salvar credenciais no resultado para o dashboard
    result.credentials = {
      email: emailData.email,
      password: password
    };

    // 5. Aguardar email de verificação
    // IMPORTANTE: Só pular se realmente não precisar verificar
    // Se result.skipEmailVerification é true MAS result.steps.emailVerification é false, significa que precisa verificar
    let skipEmailVerification = result.skipEmailVerification === true && result.steps.emailVerification === true; // Só pular se ambos confirmarem que não precisa verificar
    
    if (!skipEmailVerification) {
      logger.info('\n📬 Etapa 2: Aguardando Email de Verificação');
    } else {
      logger.info('\n📬 Etapa 2: Verificação de Email (PULADA - conta já existe e está logada)');
    }
    
    let verificationLink = null;
    
    if (skipEmailVerification) {
      // Se já está logado (conta existente), pular verificação de email
      logger.info('⏭️  Pulando verificação de email - conta já existe e está logada');
      result.steps.emailVerification = true;
      
      // Verificar URL atual após login
      const currentUrl = page.url();
      logger.info(`📍 URL atual após login: ${currentUrl}`);
      
      // NÃO navegar - manter na página atual (quiz, dashboard, etc)
      // O fluxo continuará normalmente: quiz -> template -> fallback -> publicar
      if (currentUrl.includes('/getting-started') || currentUrl.includes('/onboarding') || currentUrl.includes('/quiz')) {
        logger.info('✅ Está no quiz, continuando fluxo normalmente (quiz -> template -> fallback -> publicar)...');
        // Não navegar - continuar na página atual
      } else if (currentUrl.includes('/dashboard')) {
        logger.info('✅ Está no dashboard, continuando fluxo normalmente...');
        // Não navegar - continuar na página atual
      } else {
        // Só navegar se não estiver em nenhuma página relevante
        logger.info('🔄 Navegando para dashboard...');
        await page.goto('https://lovable.dev/dashboard', { 
          waitUntil: 'domcontentloaded', 
          timeout: getTimeout(30000, usingProxy) 
        });
        await page.waitForTimeout(getDelay(2000, usingProxy));
      }
    } else if (useOutlook) {
      // Modo Outlook: fazer login no Outlook e buscar email de verificação
      logger.info('📧 Fazendo login no Outlook para buscar email de verificação...');
      
      // Fazer login no Outlook
      logger.info('\n🔐 Login no Outlook');
      const outlookLoginResult = await loginToOutlook(page, outlookEmail, outlookPassword, usingProxy);
      result.steps.outlookLogin = outlookLoginResult.executionTime;
      
      if (!outlookLoginResult.success) {
        // Se o erro é de verificação de segurança, marcar credencial como usada e lançar erro específico
        if (outlookLoginResult.requiresVerification) {
          logger.error(`❌ Email ${outlookEmail} requer verificação de segurança`);
          logger.error('📧 Email cadastrado com email de verificação - não é possível prosseguir');
          throw new Error(`Email cadastrado com email de verificação: ${outlookEmail}`);
        }
        throw new Error(`❌ Falha no login do Outlook: ${outlookLoginResult.error}`);
      }
      
      logger.success('✅ Login no Outlook concluído');
      
      // CRÍTICO: Verificar se loginToOutlook já clicou no link de verificação
      // Se já está no Lovable (não está mais no Outlook), significa que o link já foi clicado
      const currentUrlAfterOutlookLogin = page.url();
      logger.info(`📍 URL após loginToOutlook: ${currentUrlAfterOutlookLogin}`);
      
      const alreadyClickedLink = currentUrlAfterOutlookLogin.includes('lovable.dev') && 
                                 !currentUrlAfterOutlookLogin.includes('outlook.live.com') &&
                                 !currentUrlAfterOutlookLogin.includes('outlook.com');
      
      if (alreadyClickedLink) {
        logger.info('✅ Link de verificação já foi clicado pelo loginToOutlook!');
        logger.info('⏳ Aguardando redirect completar...');
        
        // Aguardar redirect completar e VERIFICAR se realmente saiu do Outlook
        let redirectCompleted = false;
        let currentUrl = currentUrlAfterOutlookLogin;
        
        try {
          await page.waitForURL(url => {
            const urlStr = url.toString();
            // Verificar se NÃO está mais no Outlook E não está mais em auth/action (ou se está em página válida)
            const notInOutlook = !urlStr.includes('outlook.live.com') && !urlStr.includes('outlook.com');
            const notInAuthAction = !urlStr.includes('auth/action') && !urlStr.includes('verify-email');
            const isInLovable = urlStr.includes('lovable.dev');
            const isInValidPage = urlStr.includes('/dashboard') || 
                                  urlStr.includes('/getting-started') || 
                                  urlStr.includes('/quiz') ||
                                  urlStr.includes('/onboarding') ||
                                  urlStr === 'https://lovable.dev/' ||
                                  urlStr === 'https://lovable.dev';
            
            return notInOutlook && (notInAuthAction || isInValidPage) && isInLovable;
          }, { timeout: getTimeout(30000, usingProxy) });
          
          redirectCompleted = true;
          currentUrl = page.url();
          logger.success(`✅ Redirect do link de verificação completado! URL: ${currentUrl}`);
        } catch (e) {
          // Verificar URL atual para ver onde está
          try {
            currentUrl = page.url();
            logger.warning(`⚠️ Timeout aguardando redirect. URL atual: ${currentUrl}`);
            
            // Se ainda está no Outlook, isso é um problema
            if (currentUrl.includes('outlook.live.com') || currentUrl.includes('outlook.com')) {
              logger.error('❌ Ainda está no Outlook após clicar no link de verificação!');
              throw new Error('Erro ao verificar email: não saiu do Outlook após clicar no link de verificação');
            }
            
            // Se está no Lovable mas ainda em auth/action, verificar se é erro de link inválido
            if (currentUrl.includes('lovable.dev') && currentUrl.includes('auth/action')) {
              // Verificar se há mensagem de erro de link inválido
              const hasInvalidLinkError = await page.evaluate(() => {
                const bodyText = document.body.innerText.toLowerCase();
                return bodyText.includes('invalid') || 
                       bodyText.includes('inválido') ||
                       bodyText.includes('expired') ||
                       bodyText.includes('expirado') ||
                       bodyText.includes('link has been used') ||
                       bodyText.includes('link já foi usado') ||
                       bodyText.includes('already been used') ||
                       bodyText.includes('já foi usado');
              });
              
              if (hasInvalidLinkError) {
                logger.error('❌ Link de verificação inválido ou já foi usado!');
                logger.error('⚠️ Isso pode acontecer se o link foi clicado duas vezes');
                // Tentar navegar para dashboard como fallback
                logger.info('🔄 Tentando navegar para dashboard como fallback...');
                try {
                  await page.goto('https://lovable.dev/dashboard', { 
                    waitUntil: 'domcontentloaded', 
                    timeout: getTimeout(30000, usingProxy) 
                  });
                  await page.waitForTimeout(getDelay(2000, usingProxy));
                  currentUrl = page.url();
                  if (currentUrl.includes('lovable.dev') && !currentUrl.includes('auth/action')) {
                    logger.success(`✅ Navegou para dashboard após erro de link. URL: ${currentUrl}`);
                    redirectCompleted = true;
                  } else {
                    throw new Error('Link de verificação inválido ou já foi usado - não foi possível navegar para dashboard');
                  }
                } catch (navError) {
                  throw new Error('Link de verificação inválido ou já foi usado - não foi possível navegar para dashboard');
                }
              } else {
                // Se não é erro, aguardar mais um pouco
                logger.info('⏳ Ainda em auth/action, aguardando mais tempo...');
                await page.waitForTimeout(getDelay(5000, usingProxy));
                
                // Verificar novamente
                currentUrl = page.url();
                if (currentUrl.includes('outlook.live.com') || currentUrl.includes('outlook.com')) {
                  throw new Error('Erro ao verificar email: voltou para o Outlook após aguardar');
                }
                
                // Se ainda está em auth/action, tentar navegar para dashboard
                if (currentUrl.includes('auth/action')) {
                  logger.warning('⚠️ Ainda em auth/action após aguardar. Tentando navegar para dashboard...');
                  try {
                    await page.goto('https://lovable.dev/dashboard', { 
                      waitUntil: 'domcontentloaded', 
                      timeout: getTimeout(30000, usingProxy) 
                    });
                    await page.waitForTimeout(getDelay(2000, usingProxy));
                    currentUrl = page.url();
                    logger.info(`✅ Navegou para dashboard. URL: ${currentUrl}`);
                    redirectCompleted = true;
                  } catch (navError) {
                    logger.error(`❌ Erro ao navegar para dashboard: ${navError.message}`);
                    // Continuar mesmo assim - pode estar logado
                    redirectCompleted = true;
                  }
                } else {
                  redirectCompleted = true;
                  logger.success(`✅ Redirect completado após espera adicional. URL: ${currentUrl}`);
                }
              }
            } else if (currentUrl.includes('lovable.dev')) {
              // Está no Lovable, considerar sucesso
              redirectCompleted = true;
              logger.success(`✅ Está no Lovable. URL: ${currentUrl}`);
            }
          } catch (urlError) {
            logger.error(`❌ Erro ao verificar URL após redirect: ${urlError.message}`);
            throw new Error(`Erro ao verificar email: ${urlError.message}`);
          }
        }
        
        // VERIFICAÇÃO FINAL: Garantir que está no Lovable antes de continuar
        if (!redirectCompleted || !currentUrl.includes('lovable.dev')) {
          const finalCheckUrl = page.url();
          logger.error(`❌ Não está no Lovable após verificação! URL: ${finalCheckUrl}`);
          throw new Error(`Erro ao verificar email: não está no Lovable após clicar no link. URL atual: ${finalCheckUrl}`);
        }
        
        logger.success(`✅ Confirmação: Está no Lovable (${currentUrl}) - pode continuar o fluxo`);
        
        result.steps.emailVerification = Date.now() - startTime;
      } else {
        // loginToOutlook NÃO clicou no link, fazer o processo aqui
        logger.info('📧 loginToOutlook não clicou no link - navegando para o Outlook e buscando email de verificação...');
      await page.goto('https://outlook.live.com/mail/0/', { 
        waitUntil: 'domcontentloaded', 
        timeout: getTimeout(30000, usingProxy) 
      });
      await page.waitForTimeout(getDelay(3000, usingProxy));
      
      // Buscar e clicar no email de verificação
      logger.info('🔍 Procurando email de verificação da Lovable...');
      await page.waitForTimeout(getDelay(2000, usingProxy));
      
      // Clicar no email
      const emailClicked = await page.evaluate(() => {
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
          if (text.includes('verify your email') && 
              (text.includes('lovable.dev') || text.includes('lovable')) &&
              !text.includes('microsoft')) {
            let parent = node.parentElement;
            let depth = 0;
            while (parent && parent !== document.body && depth < 10) {
              const style = window.getComputedStyle(parent);
              const isVisible = parent.offsetParent !== null && 
                               style.display !== 'none' &&
                               style.visibility !== 'hidden';
              
              if (isVisible) {
                const tagName = parent.tagName.toLowerCase();
                const hasClick = parent.onclick !== null || 
                                parent.getAttribute('onclick') !== null ||
                                tagName === 'a' ||
                                tagName === 'button' ||
                                parent.getAttribute('role') === 'button' ||
                                parent.getAttribute('tabindex') !== null;
                
                if (hasClick || parent.style.cursor === 'pointer') {
                  candidates.push({ element: parent, depth: depth });
                }
              }
              parent = parent.parentElement;
              depth++;
            }
          }
        }
        
        candidates.sort((a, b) => a.depth - b.depth);
        
        for (const candidate of candidates) {
          try {
            candidate.element.click();
            return true;
          } catch (e) {
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
        throw new Error('❌ Não foi possível abrir o email de verificação no Outlook');
      }
      
      logger.success('✅ Email de verificação aberto');
      await page.waitForTimeout(getDelay(3000, usingProxy));
      
      // Extrair link de verificação do email
      logger.info('🔗 Extraindo link de verificação do email...');
      verificationLink = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href]'));
        
        for (const link of links) {
          const href = (link.getAttribute('href') || '').toLowerCase();
          const isVisible = link.offsetParent !== null;
          
          if (isVisible && 
              href.includes('lovable.dev') && 
              (href.includes('verify') || href.includes('verifyemail') || href.includes('oobcode') || href.includes('action'))) {
            return link.href;
          }
        }
        
        // Fallback: procurar qualquer link do lovable.dev
        for (const link of links) {
          const href = (link.getAttribute('href') || '').toLowerCase();
          if (href.includes('lovable.dev')) {
            return link.href;
          }
        }
        
        return null;
      });
      
      if (!verificationLink) {
        throw new Error('❌ Link de verificação não encontrado no email');
      }
      
      logger.success(`✅ Link de verificação encontrado: ${verificationLink.substring(0, 80)}...`);
      
      // Navegar para o link de verificação (volta para o Lovable)
      logger.info('🔗 Navegando para o link de verificação...');
      await page.goto(verificationLink, { 
        waitUntil: 'domcontentloaded', 
        timeout: getTimeout(30000, usingProxy) 
      });
      await page.waitForTimeout(getDelay(2000, usingProxy));
      
      logger.success('✅ Link de verificação clicado, voltando para o Lovable');
      
      // Aguardar redirect completar e VERIFICAR se realmente saiu do Outlook
      let redirectCompleted = false;
      let currentUrl = '';
      
      try {
        await page.waitForURL(url => {
          const urlStr = url.toString();
          // Verificar se NÃO está mais no Outlook E não está mais em auth/action
          const notInOutlook = !urlStr.includes('outlook.live.com') && !urlStr.includes('outlook.com');
          const notInAuthAction = !urlStr.includes('auth/action') && !urlStr.includes('verify-email');
          const isInLovable = urlStr.includes('lovable.dev');
          
          return notInOutlook && notInAuthAction && isInLovable;
        }, { timeout: getTimeout(30000, usingProxy) });
        
        redirectCompleted = true;
        currentUrl = page.url();
        logger.success(`✅ Redirect do link de verificação completado! URL: ${currentUrl}`);
      } catch (e) {
        // Verificar URL atual para ver onde está
        try {
          currentUrl = page.url();
          logger.warning(`⚠️ Timeout aguardando redirect. URL atual: ${currentUrl}`);
          
          // Se ainda está no Outlook, isso é um problema
          if (currentUrl.includes('outlook.live.com') || currentUrl.includes('outlook.com')) {
            logger.error('❌ Ainda está no Outlook após clicar no link de verificação!');
            throw new Error('Erro ao verificar email: não saiu do Outlook após clicar no link de verificação');
          }
          
          // Se está no Lovable mas ainda em auth/action, aguardar mais um pouco
          if (currentUrl.includes('lovable.dev') && currentUrl.includes('auth/action')) {
            logger.info('⏳ Ainda em auth/action, aguardando mais tempo...');
            await page.waitForTimeout(getDelay(5000, usingProxy));
            
            // Verificar novamente
            currentUrl = page.url();
            if (currentUrl.includes('outlook.live.com') || currentUrl.includes('outlook.com')) {
              throw new Error('Erro ao verificar email: voltou para o Outlook após aguardar');
            }
            
            redirectCompleted = true;
            logger.success(`✅ Redirect completado após espera adicional. URL: ${currentUrl}`);
          } else if (currentUrl.includes('lovable.dev')) {
            // Está no Lovable, considerar sucesso
            redirectCompleted = true;
            logger.success(`✅ Está no Lovable. URL: ${currentUrl}`);
          }
        } catch (urlError) {
          logger.error(`❌ Erro ao verificar URL após redirect: ${urlError.message}`);
          throw new Error(`Erro ao verificar email: ${urlError.message}`);
        }
      }
      
      // VERIFICAÇÃO FINAL: Garantir que está no Lovable antes de continuar
      if (!redirectCompleted || !currentUrl.includes('lovable.dev')) {
        const finalCheckUrl = page.url();
        logger.error(`❌ Não está no Lovable após verificação! URL: ${finalCheckUrl}`);
        throw new Error(`Erro ao verificar email: não está no Lovable após clicar no link. URL atual: ${finalCheckUrl}`);
      }
      
      logger.success(`✅ Confirmação: Está no Lovable (${currentUrl}) - pode continuar o fluxo`);
      
      result.steps.emailVerification = Date.now() - startTime;
      }
    } else {
      // Modo normal: usar serviço de email temporário
    const verificationEmail = await emailService.waitForVerificationEmail(
      emailData, // Passa o objeto completo com email, proxyId, etc
      5, // 5 tentativas × 3s = 15s total
      3000 // 3 segundos entre tentativas
    );
    
      // Extrair link de verificação
    try {
      verificationLink = emailService.extractVerificationLink(verificationEmail);
    } catch (linkError) {
      logger.error('❌ Erro ao extrair link de verificação:', linkError.message);
      // Se não encontrou o link, fazer fallback para template (como se a verificação tivesse falhado)
      logger.warning('⚠️ Link de verificação não encontrado no email. Fazendo fallback para template...');
      await fallbackToTemplate(page, userId, usingProxy);
      result.steps.emailVerification = 0; // Marcado como pulado (fallback usado)
      
      // Continuar fluxo a partir do template (independente do modo)
      if (turboMode) {
        result.steps.onboardingQuiz = 0; // Marcado como pulado
        result.steps.selectTemplate = 0; // Marcado como pulado
        logger.info('\n🚀 Etapa 6: Usando Template e Publicando (Modo Turbo - Fallback)');
        const publishResult = await useTemplateAndPublish(page, userId, usingProxy, simulatedErrors, checkCreditsBanner);
        result.steps.useTemplateAndPublish = publishResult.executionTime;
        
        // Se a publicação falhou (ex: banner não encontrado), marcar como falha mas não lançar erro
        // O projeto foi publicado, mas não encontrou o banner, então é uma falha
        if (!publishResult.success) {
          result.success = false;
          result.error = publishResult.error || 'Erro ao publicar projeto';
          result.failedStep = 'Banner de Créditos no Editor';
          logger.warning(`⚠️ Publicação concluída, mas marcada como falha: ${result.error}`);
          return result;
        }
      } else {
        // Modo normal: continuar com quiz e depois publicar
        logger.info('\n📝 Etapa 4: Completando Quiz de Onboarding (Fallback)');
        const quizResult = await completeOnboardingQuiz(page, userId, emailData.email, usingProxy);
        result.steps.onboardingQuiz = quizResult.executionTime;
        
        logger.info('\n🎨 Etapa 5: Seleção de Template (já no template via fallback)');
        result.steps.selectTemplate = 0; // Já estamos no template
        
        logger.info('\n🚀 Etapa 6: Usando Template e Publicando (Fallback)');
        const publishResult = await useTemplateAndPublish(page, userId, usingProxy, simulatedErrors, false);
        result.steps.useTemplateAndPublish = publishResult.executionTime;
        
        // Se a publicação falhou (ex: banner não encontrado), marcar como falha mas não lançar erro
        // O projeto foi publicado, mas não encontrou o banner, então é uma falha
        if (!publishResult.success) {
          result.success = false;
          result.error = publishResult.error || 'Erro ao publicar projeto';
          result.failedStep = 'Banner de Créditos no Editor';
          logger.warning(`⚠️ Publicação concluída, mas marcada como falha: ${result.error}`);
          return result;
        }
      }
      
      // Marcar como sucesso após fallback
      result.success = true;
      result.creditsEarned = 10;
      result.executionTime = Date.now() - startTime;
      logger.success(`✅ Usuário ${userId} completou via fallback após erro no link!`);
      return result;
      }
    }
    
    // 6. Se não estava no modo Outlook, clicar no link de verificação NA MESMA SESSÃO
    if (!useOutlook) {
    logger.info('\n✅ Etapa 3: Clicando em Link de Verificação (mesma sessão)');
    const verifyResult = await verifyEmailInSameSession(page, verificationLink, userId, usingProxy);
    result.steps.emailVerification = verifyResult.executionTime;
    } else {
      // No modo Outlook, já clicamos no link e voltamos para o Lovable
      logger.info('\n✅ Etapa 3: Link de verificação já foi clicado (modo Outlook)');
    }

    // Se modo turbo está ativo, pular quiz e seleção de template, ir direto para fallback
    if (turboMode) {
      logger.info('\n⚡ Modo Turbo ativo: Pulando quiz e seleção de template, indo direto para template fallback');
      
      // CRÍTICO: Verificar se está no Lovable antes de tentar ir para o template
      const currentUrlBeforeTemplate = page.url();
      logger.info(`📍 URL antes de ir para template: ${currentUrlBeforeTemplate}`);
      
      // Se ainda está no Outlook, isso é um erro crítico
      if (currentUrlBeforeTemplate.includes('outlook.live.com') || currentUrlBeforeTemplate.includes('outlook.com')) {
        logger.error('❌ ERRO CRÍTICO: Ainda está no Outlook! Não pode continuar para template.');
        logger.error(`📍 URL atual: ${currentUrlBeforeTemplate}`);
        throw new Error('Erro ao verificar email: ainda está no Outlook após clicar no link de verificação. URL: ' + currentUrlBeforeTemplate);
      }
      
      // Se não está no Lovable, tentar navegar para o dashboard primeiro
      if (!currentUrlBeforeTemplate.includes('lovable.dev')) {
        logger.warning('⚠️ Não está no Lovable, navegando para dashboard primeiro...');
        try {
          await page.goto('https://lovable.dev/dashboard', { 
            waitUntil: 'domcontentloaded', 
            timeout: getTimeout(30000, usingProxy) 
          });
          await page.waitForTimeout(getDelay(2000, usingProxy));
          
          // Verificar novamente
          const urlAfterNav = page.url();
          if (urlAfterNav.includes('outlook.live.com') || urlAfterNav.includes('outlook.com')) {
            throw new Error('Erro: voltou para o Outlook ao tentar navegar para dashboard');
          }
          logger.success(`✅ Navegou para dashboard. URL: ${urlAfterNav}`);
        } catch (navError) {
          logger.error(`❌ Erro ao navegar para dashboard: ${navError.message}`);
          throw new Error(`Erro ao navegar para Lovable após verificação: ${navError.message}`);
        }
      }
      
      // Se estava no quiz, já pulou - agora vai pro editor
      await fallbackToTemplate(page, userId, usingProxy);
      result.steps.onboardingQuiz = 0; // Marcado como pulado
      result.steps.selectTemplate = 0; // Marcado como pulado
      
      // 9. Usar template e publicar (já estamos no template após o fallback)
      logger.info('\n🚀 Etapa 6: Usando Template e Publicando (Modo Turbo)');
      // checkCreditsBanner = true para procurar banner no editor
      const publishResult = await useTemplateAndPublish(page, userId, usingProxy, simulatedErrors, true, enableConcurrentRequests, concurrentRequests);
      result.steps.useTemplateAndPublish = publishResult.executionTime;
      
      // Se a publicação falhou (ex: banner não encontrado), marcar como falha mas não lançar erro
      if (!publishResult.success) {
        result.success = false;
        result.error = publishResult.error || 'Erro ao publicar projeto';
        result.failedStep = 'Banner de Créditos no Editor';
        logger.warning(`⚠️ Publicação concluída, mas marcada como falha: ${result.error}`);
        return result;
      }
    } else {
      // Modo normal: completar todas as etapas
      // 7. Completar quiz de onboarding (se estiver no quiz)
      const currentUrlBeforeQuiz = page.url();
      if (currentUrlBeforeQuiz.includes('/getting-started') || currentUrlBeforeQuiz.includes('/onboarding') || currentUrlBeforeQuiz.includes('/quiz')) {
        logger.info('\n📝 Etapa 4: Completando Quiz de Onboarding');
        const quizResult = await completeOnboardingQuiz(page, userId, emailData.email, usingProxy);
        result.steps.onboardingQuiz = quizResult.executionTime;
      } else {
        logger.info('\n📝 Etapa 4: Quiz de Onboarding (PULADO - não está no quiz)');
        result.steps.onboardingQuiz = 0;
      }

      // 7.5. Após o quiz, procurar popup de créditos e/ou banner
      if (result.skipEmailVerification) {
        logger.info('🔍 Procurando popup de créditos e/ou banner após o quiz...');
        try {
          // Aguardar um pouco para popup aparecer
          await page.waitForTimeout(getDelay(3000, usingProxy));
          
          // Procurar popup de créditos (pode aparecer como modal/dialog)
          const hasCreditsPopup = await page.evaluate(() => {
            const bodyText = document.body.innerText.toLowerCase();
            const hasPopup = bodyText.includes('10 credits') || 
                           bodyText.includes('10 créditos') || 
                           bodyText.includes('bonus credits') ||
                           bodyText.includes('referral');
            
            // Verificar se há algum modal/dialog visível
            const modals = document.querySelectorAll('[role="dialog"], .modal, [class*="modal"], [class*="popup"], [class*="dialog"]');
            const visibleModal = Array.from(modals).find(modal => {
              const style = window.getComputedStyle(modal);
              return style.display !== 'none' && style.visibility !== 'hidden';
            });
            
            return hasPopup || !!visibleModal;
          });
          
          if (hasCreditsPopup) {
            logger.success('🎉 Popup de créditos detectado após o quiz!');
            result.steps.creditsBannerCheck = true;
          } else {
            // Se não encontrou popup, verificar se está no dashboard antes de procurar banner
            const currentUrlAfterQuiz = page.url();
            if (currentUrlAfterQuiz.includes('/dashboard')) {
              logger.info('🔍 Popup não encontrado, procurando banner no dashboard...');
              const bannerInfoAfterQuiz = await findCreditsBanner(page, usingProxy);
            if (bannerInfoAfterQuiz.found) {
              logger.success('🎉 Banner de créditos encontrado após o quiz!');
              result.steps.creditsBannerCheck = true;
            } else {
              logger.warning('⚠️ Popup e banner de créditos não encontrados após o quiz');
              }
            }
          }
        } catch (bannerError) {
          logger.warning(`⚠️ Erro ao verificar popup/banner após quiz: ${bannerError.message}`);
        }
      }

      // 8. Selecionar template
      logger.info('\n🎨 Etapa 5: Selecionando Template');
      const templateResult = await selectTemplate(page, userId, usingProxy, simulatedErrors);
      result.steps.selectTemplate = templateResult.executionTime;

      // 9. Usar template e publicar
      logger.info('\n🚀 Etapa 6: Usando Template e Publicando');
      const publishResult = await useTemplateAndPublish(page, userId, usingProxy, simulatedErrors, false, enableConcurrentRequests, concurrentRequests); // checkCreditsBanner só funciona com turboMode
      result.steps.useTemplateAndPublish = publishResult.executionTime;
      
      // Se a publicação falhou (ex: banner não encontrado), marcar como falha mas não lançar erro
      // O projeto foi publicado, mas não encontrou o banner, então é uma falha
      if (!publishResult.success) {
        result.success = false;
        result.error = publishResult.error || 'Erro ao publicar projeto';
        result.failedStep = 'Banner de Créditos no Editor';
        logger.warning(`⚠️ Publicação concluída, mas marcada como falha: ${result.error}`);
        return result;
      }
    }

    // 10. Sucesso!
    result.success = true;
    result.creditsEarned = 10; // Assumindo 10 créditos por indicação
    result.executionTime = Date.now() - startTime;

    logger.info(`\n${'='.repeat(60)}`);
    logger.success(`✅ Usuário ${userId} completou o fluxo com sucesso!`);
    logger.success(`💰 Créditos gerados: ${result.creditsEarned}`);
    logger.success(`⏱️  Tempo total: ${result.executionTime}ms`);
    logger.info(`${'='.repeat(60)}\n`);
    
    // IMPORTANTE: Marcar credencial Outlook como usada quando o fluxo completar com sucesso
    // Isso deve acontecer sempre que o login foi bem-sucedido e o projeto foi publicado
    if (useOutlook && outlookEmail) {
      outlookCredentialsService.markAsUsed(outlookEmail);
      logger.info(`✅ Credencial Outlook ${outlookEmail} marcada como usada (fluxo completo)`);
    }

  } catch (error) {
    // ANTES DE LANÇAR ERRO: Verificar se está no quiz e preencher se necessário
    let shouldRetry = false;
    try {
      const isInQuiz = await checkAndCompleteQuizIfNeeded(page, userId, usingProxy);
      if (isInQuiz) {
        logger.info('🔄 Quiz preenchido! Tentando continuar o fluxo...');
        shouldRetry = true;
        
        // Tentar continuar o fluxo baseado na etapa atual
        try {
          // Se estava tentando ir para template, tentar novamente
          if (error.message.includes('template') || error.message.includes('Use template') || error.message.includes('timeout') || error.message.includes('Timeout')) {
            logger.info('🔄 Tentando ir para template novamente após preencher quiz...');
            
            if (turboMode) {
              await fallbackToTemplate(page, userId, usingProxy);
              result.steps.onboardingQuiz = Date.now() - startTime;
              result.steps.selectTemplate = 0;
              
              // Continuar com publicação
              logger.info('\n🚀 Etapa 6: Usando Template e Publicando (Modo Turbo - após quiz)');
              const publishResult = await useTemplateAndPublish(page, userId, usingProxy, simulatedErrors, checkCreditsBanner, enableConcurrentRequests, concurrentRequests);
              result.steps.useTemplateAndPublish = publishResult.executionTime;
              
              if (publishResult.success) {
                result.success = true;
                result.creditsEarned = 10;
                result.executionTime = Date.now() - startTime;
                logger.success(`✅ Usuário ${userId} completou o fluxo após preencher quiz!`);
                
                if (useOutlook && outlookEmail) {
                  outlookCredentialsService.markAsUsed(outlookEmail);
                  logger.info(`✅ Credencial Outlook ${outlookEmail} marcada como usada (fluxo completo)`);
                }
                
                return result; // Sucesso após preencher quiz
              }
            } else {
              // Modo normal: completar quiz normalmente
              result.steps.onboardingQuiz = Date.now() - startTime;
              
              // Continuar com seleção de template
              logger.info('\n🎨 Etapa 5: Selecionando Template');
              const templateResult = await selectTemplate(page, userId, usingProxy, simulatedErrors);
              result.steps.selectTemplate = templateResult.executionTime;
              
              // Continuar com publicação
              logger.info('\n🚀 Etapa 6: Usando Template e Publicando');
              const publishResult = await useTemplateAndPublish(page, userId, usingProxy, simulatedErrors, false, enableConcurrentRequests, concurrentRequests);
              result.steps.useTemplateAndPublish = publishResult.executionTime;
              
              if (publishResult.success) {
                result.success = true;
                result.creditsEarned = 10;
                result.executionTime = Date.now() - startTime;
                logger.success(`✅ Usuário ${userId} completou o fluxo após preencher quiz!`);
                
                if (useOutlook && outlookEmail) {
                  outlookCredentialsService.markAsUsed(outlookEmail);
                  logger.info(`✅ Credencial Outlook ${outlookEmail} marcada como usada (fluxo completo)`);
                }
                
                return result; // Sucesso após preencher quiz
              }
            }
          }
        } catch (retryError) {
          logger.error(`❌ Erro ao tentar continuar após preencher quiz: ${retryError.message}`);
          // Continuar para lançar o erro original
        }
      }
    } catch (checkError) {
      logger.warning(`⚠️ Erro ao verificar quiz antes de lançar erro: ${checkError.message}`);
    }
    
    // Se não conseguiu recuperar, lançar erro normalmente
    result.success = false;
    result.error = error.message || 'Erro desconhecido';
    result.executionTime = Date.now() - startTime;
    
    // Determinar qual etapa falhou baseado no erro e nos steps completados
    const errorMessage = error.message || '';
    
    // Verificar se o erro é específico de navegação/Outlook
    if (errorMessage.includes('Outlook') || errorMessage.includes('outlook.live.com') || errorMessage.includes('outlook.com')) {
      result.failedStep = 'Verificação de Email (navegação)';
    } else if (errorMessage.includes('ERR_ABORTED') || errorMessage.includes('net::')) {
      // Erro de navegação - verificar qual etapa estava tentando
      if (!result.steps.emailVerification) {
        result.failedStep = 'Verificação de Email (navegação)';
      } else if (!result.steps.onboardingQuiz && !result.steps.selectTemplate) {
        result.failedStep = 'Navegação para Template';
      } else {
        result.failedStep = 'Navegação';
      }
    } else if (!result.steps.signup) {
      result.failedStep = 'Cadastro';
    } else if (!result.steps.emailVerification) {
      result.failedStep = 'Verificação de Email';
    } else if (!result.steps.onboardingQuiz && !result.steps.selectTemplate && !result.steps.useTemplateAndPublish) {
      // Se não completou nenhuma etapa após verificação, provavelmente erro de navegação
      result.failedStep = 'Navegação após Verificação';
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
  } finally {
    // FECHAR NAVEGADOR sempre que o fluxo terminar (sucesso ou erro)
    // O fluxo já terminou, então sempre fechar o navegador
    try {
      if (!result.success) {
        logger.error('🚨 ERRO DETECTADO - Fechando navegador após registro do erro');
        try {
          logger.info(`📍 URL atual: ${page ? page.url() : 'indisponível'}`);
        } catch (e) {
          logger.info('📍 URL atual: indisponível');
        }
      } else {
        // Fluxo terminou com sucesso - fechar navegador
        logger.info('✅ Fluxo concluído com sucesso - fechando navegador');
      }
      
      // FECHAR NAVEGADOR SEMPRE - tentar múltiplas formas para garantir
      if (context) {
        let browserClosed = false;
        
        try {
          // Método 1: Fechar todas as páginas primeiro
          try {
            const pages = context.pages();
            for (const p of pages) {
              try {
                await Promise.race([
                  p.close(),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
                ]).catch(() => {});
              } catch (e) {
                // Ignorar erro ao fechar página individual
              }
            }
          } catch (e) {
            // Ignorar erro ao fechar páginas
          }
          
          // Método 2: Fechar o contexto (navegador) com timeout
          try {
            await Promise.race([
              context.close(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
            ]);
            browserClosed = true;
            logger.info('🧹 Navegador fechado com sucesso');
          } catch (closeError) {
            logger.warning(`⚠️ Erro ao fechar contexto: ${closeError.message}`);
            
            // Método 3: Tentar fechar o browser diretamente
            try {
              const browser = context.browser();
              if (browser) {
                await Promise.race([
                  browser.close(),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
                ]).catch(() => {});
                browserClosed = true;
                logger.info('🧹 Navegador fechado via browser.close()');
              }
            } catch (e) {
              // Ignorar erro
            }
          }
          
          // Se ainda não fechou, tentar método alternativo
          if (!browserClosed) {
            logger.warning('⚠️ Tentando método alternativo para fechar navegador...');
            try {
              // Forçar fechamento usando kill se disponível
              if (context.browser && context.browser().process) {
                context.browser().process().kill('SIGTERM').catch(() => {});
                browserClosed = true;
                logger.info('🧹 Navegador fechado via kill');
              }
            } catch (e) {
              logger.error('❌ Não foi possível fechar o navegador por nenhum método');
            }
          }
        } catch (finalError) {
          logger.error(`❌ Erro crítico ao fechar navegador: ${finalError.message}`);
        }
      }
      
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
    } catch (cleanupError) {
      logger.warning(`⚠️ Erro durante limpeza: ${cleanupError.message}`);
      // Tentar fechar navegador mesmo em caso de erro na limpeza
      if (context) {
        try {
          await context.close().catch(() => {});
          logger.info('🧹 Navegador fechado (tentativa de recuperação)');
        } catch (e) {
          logger.error('❌ Não foi possível fechar o navegador');
        }
      }
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

