import axios from 'axios';
import { logger } from '../utils/logger.js';
import { generateRandomUsername } from '../utils/nameGenerator.js';

/**
 * EmailService usando 1secmail (gratuito, sem API key)
 * Funciona instantaneamente para testes
 */
class EmailService {
  constructor() {
    this.usedEmails = new Set();
    this.emailData = new Map();
    this.baseUrl = 'https://www.1secmail.com/api/v1/';
    this.domains = ['1secmail.com', '1secmail.org', '1secmail.net'];
  }

  /**
   * Cria um email temporário único
   */
  async generateEmail(userId) {
    try {
      // Gerar nome aleatório
      const randomName = generateRandomUsername();
      const domain = this.domains[Math.floor(Math.random() * this.domains.length)];
      const email = `${randomName}@${domain}`;
      
      // Extrair login e domain
      const [login, emailDomain] = email.split('@');
      
      logger.info(`Gerando email temporário: ${email}`);
      
      // Garantir que não reutilizamos emails
      if (this.usedEmails.has(email)) {
        logger.warning('Email já usado, gerando novo');
        return this.generateEmail(userId);
      }

      this.usedEmails.add(email);
      
      // Armazenar dados
      this.emailData.set(userId, {
        email,
        login,
        domain: emailDomain,
        createdAt: new Date()
      });
      
      logger.success(`✅ Email temporário criado: ${email}`);
      
      return {
        email,
        login,
        domain: emailDomain
      };
    } catch (error) {
      logger.error(`Erro ao gerar email`, error);
      throw new Error(`Falha ao criar email: ${error.message}`);
    }
  }

  /**
   * Obtém mensagens para um email
   */
  async getMessages(login, domain) {
    try {
      const response = await axios.get(
        `${this.baseUrl}?action=getMessages&login=${login}&domain=${domain}`,
        { 
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json'
          }
        }
      );

      return response.data || [];
    } catch (error) {
      if (error.response?.status === 403) {
        // Rate limit - aguardar mais tempo
        logger.info('⚠️  Rate limit detectado, aguardando...');
        await this.delay(3000);
        return [];
      }
      logger.error('Erro ao buscar mensagens', error);
      return [];
    }
  }

  /**
   * Obtém conteúdo completo de uma mensagem
   */
  async getEmailContent(login, domain, messageId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}?action=readMessage&login=${login}&domain=${domain}&id=${messageId}`,
        { timeout: 10000 }
      );

      return response.data;
    } catch (error) {
      logger.error('Erro ao buscar conteúdo do email', error);
      throw error;
    }
  }

  /**
   * Aguarda email de verificação
   */
  async waitForVerificationEmail(emailData, maxAttempts = 30, delayMs = 3000) {
    const { login, domain } = emailData;
    
    logger.info('🔍 Monitorando chegada de email de verificação...', { 
      email: `${login}@${domain}`,
      maxAttempts, 
      delayMs,
      totalWaitTime: `${(maxAttempts * delayMs) / 1000}s`
    });

    // Aguardar alguns segundos antes da primeira verificação
    logger.info('⏳ Aguardando 5 segundos antes de verificar email...');
    await this.delay(5000);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        logger.info(`📬 Verificando inbox... (${attempt}/${maxAttempts})`);
        
        const messages = await this.getMessages(login, domain);
        
        if (messages && messages.length > 0) {
          logger.info(`✉️  ${messages.length} email(s) encontrado(s)`);
          
          // Procurar email de verificação da Lovable
          const verificationEmail = messages.find(msg => {
            const isFromLovable = 
              msg.from?.toLowerCase().includes('lovable') ||
              msg.from?.toLowerCase().includes('noreply');
            
            const isVerificationSubject = 
              msg.subject?.toLowerCase().includes('verif') ||
              msg.subject?.toLowerCase().includes('confirm') ||
              msg.subject?.toLowerCase().includes('activate');
            
            return isFromLovable || isVerificationSubject;
          });

          if (verificationEmail) {
            logger.success('✅ Email de verificação encontrado!', {
              subject: verificationEmail.subject,
              from: verificationEmail.from,
              attempt,
              timeElapsed: `${(attempt * delayMs) / 1000}s`
            });
            
            // Buscar conteúdo completo
            const fullEmail = await this.getEmailContent(login, domain, verificationEmail.id);
            return {
              id: verificationEmail.id,
              subject: verificationEmail.subject,
              from: verificationEmail.from,
              body: fullEmail.body || fullEmail.textBody || fullEmail.htmlBody || ''
            };
          } else {
            messages.forEach(msg => {
              logger.info('📧 Email recebido (não é verificação):', {
                subject: msg.subject,
                from: msg.from
              });
            });
          }
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
      const verificationLink = matches.find(link => 
        link.includes('verify') || 
        link.includes('confirm') || 
        link.includes('auth/action')
      ) || matches[0];
      
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
      domains: this.domains.length
    };
  }
}

export const emailService = new EmailService();

