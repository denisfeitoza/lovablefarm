import Inbound from 'inboundemail';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { generateRandomUsername } from '../utils/nameGenerator.js';
import { domainManager } from '../web/queue/DomainManager.js';

/**
 * EmailService usando Inbound.new com domínio customizado equipeartificial.com
 */
class EmailService {
  constructor() {
    this.apiKey = config.inboundApiKey;
    this.domain = config.inboundDomain;
    this.client = null;
    this.usedEmails = new Set();
    this.emailData = new Map();
  }

  /**
   * Inicializa o cliente Inbound.new
   */
  async initialize() {
    if (!this.client) {
      this.client = new Inbound({ apiKey: this.apiKey });
      logger.info('✅ Cliente Inbound.new inicializado');
    }
  }

  /**
   * Gera um novo email usando domínio customizado (com alternância global ou específica)
   * No Inbound.new, emails são criados automaticamente quando o primeiro email chega
   */
  async generateEmail(userId, specificDomain = null) {
    try {
      await this.initialize();
      
      // Obter domínio: Específico (da fila) ou Próximo (alternância global)
      const domain = specificDomain || domainManager.getNextDomain();
      
      // Gerar username aleatório até encontrar um não usado
      let email;
      let attempts = 0;
      do {
        const username = generateRandomUsername();
        email = `${username}@${domain}`;
        attempts++;
        
        // Proteção contra loop infinito
        if (attempts > 100) {
          throw new Error('Não foi possível gerar email único após 100 tentativas');
        }
      } while (this.usedEmails.has(email));
      
      logger.info(`📧 Email gerado: ${email} (domínio: ${domain}${specificDomain ? ' - específico' : ' - global'})`);
      logger.info(`ℹ️  No Inbound.new, o email será criado automaticamente quando o primeiro email chegar`);

      this.usedEmails.add(email);
      
      // Armazenar dados
      this.emailData.set(userId, {
        email,
        username,
        domain: domain,
        createdAt: new Date()
      });
      
      logger.info(`✅ Email gerado e pronto para uso: ${email}`);
      
      // Extrair username do email para retorno
      const username = email.split('@')[0];
      
      return {
        email,
        username,
        domain: domain
      };
    } catch (error) {
      logger.error(`Erro ao gerar email`, error);
      throw new Error(`Falha ao gerar email: ${error.message}`);
    }
  }

  /**
   * Obtém emails recebidos para um endereço específico
   * Filtra manualmente para garantir que só retorna emails para o endereço exato
   */
  async getMessages(emailAddress) {
    try {
      await this.initialize();
      
      // Listar emails - usar limit menor e filtrar manualmente
      const response = await this.client.emails.list({
        limit: 100, // Buscar mais para garantir que encontramos o email correto
        to: emailAddress // Filtrar por destinatário (pode retornar emails relacionados)
      });
      
      if (!response.data || response.data.length === 0) {
        return [];
      }
      
      // ✅ FILTRAR MANUALMENTE: Garantir que só retornamos emails para o endereço EXATO
      // A API pode retornar emails relacionados, então filtramos aqui
      const exactMatches = response.data.filter(email => {
        // Verificar campo 'to' (pode ser string ou array)
        const toField = email.to || email.recipient || email.email || '';
        const toArray = Array.isArray(toField) ? toField : [toField];
        
        // Verificar se o emailAddress está na lista de destinatários (case-insensitive)
        return toArray.some(recipient => {
          const recipientStr = typeof recipient === 'string' ? recipient : (recipient.email || recipient.address || '');
          return recipientStr.toLowerCase().trim() === emailAddress.toLowerCase().trim();
        });
      });
      
      logger.info(`📧 API retornou ${response.data.length} email(s), ${exactMatches.length} para ${emailAddress} (filtrado)`);
      
      return exactMatches;
    } catch (error) {
      logger.error('Erro ao buscar emails', error);
      return [];
    }
  }

  /**
   * Obtém conteúdo completo de um email
   */
  async getEmailContent(emailId) {
    try {
      await this.initialize();
      
      const email = await this.client.emails.retrieve(emailId);
      
      return email;
    } catch (error) {
      logger.error('Erro ao buscar conteúdo do email', error);
      throw error;
    }
  }

  /**
   * Aguarda email de verificação
   */
  async waitForVerificationEmail(emailData, maxAttempts = 5, delayMs = 3000) {
    const { email } = emailData;
    
    logger.info('🔍 Monitorando chegada de email de verificação...', { 
      email,
      maxAttempts, 
      delayMs,
      totalWaitTime: `${(maxAttempts * delayMs) / 1000}s`
    });

    // Aguardar alguns segundos antes da primeira verificação
    logger.info('⏳ Aguardando 5 segundos antes de verificar...');
    await this.delay(5000);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        logger.info(`📬 Verificando inbox de ${email}... (${attempt}/${maxAttempts})`);
        
        const messages = await this.getMessages(email);
        
        // Log detalhado para diagnóstico
        if (messages && messages.length > 0) {
          logger.info(`✉️  ${messages.length} email(s) encontrado(s) para ${email}`);
          
          // Listar todos os emails recebidos para debug
          messages.forEach((msg, idx) => {
            logger.info(`  📧 Email ${idx + 1}: De: ${msg.from || 'N/A'} | Assunto: ${msg.subject || 'N/A'}`);
          });
          
          // Procurar email de verificação da Lovable
          for (const msg of messages) {
            const from = msg.from || '';
            const subject = msg.subject || '';
            const to = msg.to || [];
            
            const isFromLovable = 
              from.toLowerCase().includes('lovable') ||
              from.toLowerCase().includes('noreply') ||
              from.toLowerCase().includes('no-reply');
            
            const isVerification = 
              subject.toLowerCase().includes('verif') ||
              subject.toLowerCase().includes('confirm') ||
              subject.toLowerCase().includes('activate') ||
              subject.toLowerCase().includes('ative');
            
            // IMPORTANTE: IGNORAR emails de créditos/referral
            const isCreditsEmail = 
              subject.toLowerCase().includes('credits') ||
              subject.toLowerCase().includes('friend') ||
              subject.toLowerCase().includes('referral') ||
              subject.toLowerCase().includes('créditos');
            
            // Verificar se o email foi enviado PARA o endereço correto
            const isToCorrectEmail = to.some(recipient => 
              recipient.toLowerCase() === email.toLowerCase()
            );
            
            if (isFromLovable && isVerification && !isCreditsEmail && isToCorrectEmail) {
              logger.success('✅ Email de verificação encontrado!', {
                subject,
                from,
                attempt,
                timeElapsed: `${(attempt * delayMs) / 1000}s`
              });
              
              // Buscar conteúdo completo se necessário
              let fullEmail = msg;
              let emailBody = msg.html || msg.text || '';
              
              // Se não tem conteúdo, tentar buscar
              if (!emailBody && msg.id) {
                try {
                  logger.info(`📥 Buscando conteúdo completo do email ${msg.id}...`);
                  fullEmail = await this.getEmailContent(msg.id);
                  emailBody = fullEmail.html || fullEmail.text || '';
                  logger.success('✅ Conteúdo do email recuperado');
                } catch (contentError) {
                  logger.warning(`⚠️ Não foi possível buscar conteúdo completo do email: ${contentError.message}`);
                  logger.warning(`⚠️ Tentando extrair link do assunto ou campos disponíveis...`);
                  
                  // Tentar extrair link de outros campos se disponível
                  if (msg.body) {
                    emailBody = msg.body;
                  } else if (msg.content) {
                    emailBody = typeof msg.content === 'string' ? msg.content : (msg.content.html || msg.content.text || '');
                  }
                  
                  // Se ainda não tem, usar o que já temos
                  if (!emailBody) {
                    logger.warning(`⚠️ Nenhum conteúdo disponível, mas email foi encontrado - continuando...`);
                    emailBody = ''; // Continuar mesmo sem conteúdo, o link pode estar na URL do email
                  }
                }
              }
              
              return {
                id: msg.id,
                subject,
                from,
                body: emailBody,
                raw: fullEmail // Incluir email completo para debug
              };
            }
          }
          
          logger.info('📧 Emails encontrados não são de verificação');
        } else {
          logger.info(`📭 Inbox vazia para ${email} - aguardando...`);
          
          // Na última tentativa, fazer uma verificação final mais detalhada
          if (attempt === maxAttempts) {
            logger.warning(`⚠️ Nenhum email encontrado após ${maxAttempts} tentativas`);
            logger.warning(`⚠️ Verificando se email ${email} está acessível...`);
            
            // Tentar uma última verificação para ver se há algum problema com o email
            try {
              const finalCheck = await this.getMessages(email);
              logger.info(`🔍 Verificação final: API respondeu (${finalCheck ? finalCheck.length : 0} emails)`);
            } catch (finalError) {
              logger.error(`❌ ERRO CRÍTICO: Email ${email} não está acessível na API`);
              logger.error(`❌ Erro: ${finalError.message}`);
              throw new Error(`Email ${email} não está acessível. Verifique se o domínio está configurado corretamente no Inbound.new`);
            }
          }
        }

        // Aguardar antes da próxima tentativa
        if (attempt < maxAttempts) {
          logger.info(`⏳ Aguardando ${delayMs}ms antes da próxima tentativa...`);
          await this.delay(delayMs);
        }
      } catch (error) {
        // Se for erro de API (não timeout), pode ser problema de configuração
        if (error.message.includes('não está acessível') || error.message.includes('API')) {
          throw error; // Re-lançar erros críticos
        }
        
        logger.warning(`⚠️  Erro na tentativa ${attempt}/${maxAttempts}`, { 
          error: error.message,
          email: email
        });
        
        // Aguardar antes de tentar novamente
        if (attempt < maxAttempts) {
          await this.delay(delayMs);
        }
      }
    }

    // Se não encontrou o email após todas as tentativas, esperar mais 5 segundos antes de falhar
    logger.warning(`⚠️ Email de verificação não encontrado após ${maxAttempts} tentativas para ${email}`);
    logger.warning(`⚠️ Aguardando mais 5 segundos antes de marcar como falha...`);
    await this.delay(5000);
    
    // Fazer uma última verificação antes de falhar
    try {
      const lastCheck = await this.getMessages(email);
      if (lastCheck && lastCheck.length > 0) {
        logger.info(`📧 Encontrados ${lastCheck.length} email(s) na verificação final - processando...`);
        // Processar emails encontrados na última verificação
        for (const msg of lastCheck) {
          const from = msg.from || '';
          const subject = msg.subject || '';
          const to = msg.to || [];
          
          const isFromLovable = 
            from.toLowerCase().includes('lovable') ||
            from.toLowerCase().includes('noreply') ||
            from.toLowerCase().includes('no-reply');
          
          const isVerification = 
            subject.toLowerCase().includes('verif') ||
            subject.toLowerCase().includes('confirm') ||
            subject.toLowerCase().includes('activate') ||
            subject.toLowerCase().includes('ative');
          
          const isCreditsEmail = 
            subject.toLowerCase().includes('credits') ||
            subject.toLowerCase().includes('friend') ||
            subject.toLowerCase().includes('referral') ||
            subject.toLowerCase().includes('créditos');
          
          const isToCorrectEmail = to.some(recipient => 
            recipient.toLowerCase() === email.toLowerCase()
          );
          
          if (isFromLovable && isVerification && !isCreditsEmail && isToCorrectEmail) {
            logger.success('✅ Email de verificação encontrado na verificação final!');
            
            // Buscar conteúdo completo se necessário
            let fullEmail = msg;
            let emailBody = msg.html || msg.text || '';
            
            // Se não tem conteúdo, tentar buscar
            if (!emailBody && msg.id) {
              try {
                logger.info(`📥 Buscando conteúdo completo do email ${msg.id}...`);
                fullEmail = await this.getEmailContent(msg.id);
                emailBody = fullEmail.html || fullEmail.text || '';
                logger.success('✅ Conteúdo do email recuperado');
              } catch (contentError) {
                logger.warning(`⚠️ Não foi possível buscar conteúdo completo do email: ${contentError.message}`);
                // Tentar extrair de outros campos
                if (msg.body) {
                  emailBody = msg.body;
                } else if (msg.content) {
                  emailBody = typeof msg.content === 'string' ? msg.content : (msg.content.html || msg.content.text || '');
                }
              }
            }
            
            return {
              id: msg.id,
              subject,
              from,
              body: emailBody,
              raw: fullEmail
            };
          }
        }
      }
    } catch (lastError) {
      logger.error(`❌ Erro na verificação final: ${lastError.message}`);
    }
    
    throw new Error(`❌ Email de verificação não recebido após ${maxAttempts} tentativas para ${email}. Verifique se o email está correto e se o domínio está configurado no Inbound.new`);
  }

  /**
   * Extrai link de verificação do email
   */
  extractVerificationLink(emailContent) {
    logger.info('🔍 Procurando link de verificação...');
    
    const body = emailContent.body || '';
    
    // Procurar por links da Lovable
    const regex = /(https?:\/\/[^\s"'<>]*lovable\.dev[^\s"'<>]*)/gi;
    const matches = body.match(regex);
    
    if (matches && matches.length > 0) {
      // Pegar o primeiro link que parece ser de verificação
      let verificationLink = matches.find(link => 
        link.includes('verify') || 
        link.includes('confirm') || 
        link.includes('auth/action')
      ) || matches[0];
      
      // Decodificar entidades HTML (&amp; -> &, &quot; -> ", etc)
      verificationLink = verificationLink
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
      
      logger.success(`✅ Link extraído: ${verificationLink}`);
      return verificationLink;
    }
    
    throw new Error('Link de verificação não encontrado no email');
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obter estatísticas
   */
  getStats() {
    return {
      totalGenerated: this.usedEmails.size,
      active: this.emailData.size,
      domain: this.domain
    };
  }
}

export const emailService = new EmailService();
