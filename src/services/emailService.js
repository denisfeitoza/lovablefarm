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
   */
  async generateEmail(userId, specificDomain = null) {
    try {
      await this.initialize();
      
      // Obter domínio: Específico (da fila) ou Próximo (alternância global)
      const domain = specificDomain || domainManager.getNextDomain();
      
      // Gerar username aleatório
      const username = generateRandomUsername();
      const email = `${username}@${domain}`;
      
      logger.info(`Gerando email: ${email} (domínio: ${domain}${specificDomain ? ' - específico' : ' - global'})`);
      
      // Garantir que não reutilizamos
      if (this.usedEmails.has(email)) {
        logger.warning('Email já usado, gerando novo');
        return this.generateEmail(userId, specificDomain);
      }

      this.usedEmails.add(email);
      
      // Armazenar dados
      this.emailData.set(userId, {
        email,
        username,
        domain: domain,
        createdAt: new Date()
      });
      
      logger.success(`✅ Email gerado: ${email}`);
      
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
   */
  async getMessages(emailAddress) {
    try {
      await this.initialize();
      
      // Listar emails
      const response = await this.client.emails.list({
        limit: 50, // Últimos 50 emails
        to: emailAddress // Filtrar por destinatário
      });
      
      if (!response.data || response.data.length === 0) {
        return [];
      }
      
      return response.data;
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
  async waitForVerificationEmail(emailData, maxAttempts = 40, delayMs = 3000) {
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
        logger.info(`📬 Verificando inbox... (${attempt}/${maxAttempts})`);
        
        const messages = await this.getMessages(email);
        
        if (messages && messages.length > 0) {
          logger.info(`✉️  ${messages.length} email(s) encontrado(s)`);
          
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
              if (!msg.html && !msg.text) {
                fullEmail = await this.getEmailContent(msg.id);
              }
              
              return {
                id: msg.id,
                subject,
                from,
                body: fullEmail.html || fullEmail.text || ''
              };
            }
          }
          
          logger.info('📧 Emails encontrados não são de verificação');
        } else {
          logger.info(`📭 Inbox vazia - aguardando...`);
        }

        // Aguardar antes da próxima tentativa
        if (attempt < maxAttempts) {
          logger.info(`⏳ Aguardando ${delayMs}ms...`);
          await this.delay(delayMs);
        }
      } catch (error) {
        logger.warning(`⚠️  Erro na tentativa ${attempt}`, { error: error.message });
        await this.delay(delayMs);
      }
    }

    // Fallback final: aguardar mais 5 segundos antes de falhar
    logger.info('⏳ Esperando mais 5 segundos (tentativa final)...');
    await this.delay(5000);
    
    // Última verificação antes de falhar
    try {
      logger.info('📬 Última verificação do inbox...');
      const messages = await this.getMessages(email);
      
      if (messages && messages.length > 0) {
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
          
          const isCreditsEmail = 
            subject.toLowerCase().includes('credits') ||
            subject.toLowerCase().includes('friend') ||
            subject.toLowerCase().includes('referral') ||
            subject.toLowerCase().includes('créditos');
          
          const isToCorrectEmail = to.some(recipient => 
            recipient.toLowerCase() === email.toLowerCase()
          );
          
          if (isFromLovable && isVerification && !isCreditsEmail && isToCorrectEmail) {
            logger.success('✅ Email de verificação encontrado na verificação final!', {
              subject,
              from
            });
            
            let fullEmail = msg;
            if (!msg.html && !msg.text) {
              fullEmail = await this.getEmailContent(msg.id);
            }
            
            return {
              id: msg.id,
              subject,
              from,
              body: fullEmail.html || fullEmail.text || ''
            };
          }
        }
      }
    } catch (error) {
      logger.warning('⚠️  Erro na verificação final', { error: error.message });
    }

    throw new Error(`❌ Timeout: Email não recebido após ${maxAttempts} tentativas`);
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
