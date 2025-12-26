import axios from 'axios';
import { logger } from '../utils/logger.js';
import { generateRandomUsername } from '../utils/nameGenerator.js';

/**
 * EmailService usando ProxiedMail com domínio customizado pixelhausia.com
 */
class EmailService {
  constructor() {
    this.apiKey = 'c9505fd8540287574e26165cb092ccdc';
    this.baseUrl = 'https://proxiedmail.com/api/v1';
    this.domain = 'pixelhausia.com';
    this.forwardTo = 'dennisftz96@gmail.com'; // Email real verificado
    this.usedEmails = new Set();
    this.emailData = new Map();
  }

  /**
   * Cria um email proxy com domínio customizado
   */
  async generateEmail(userId) {
    try {
      // Gerar username aleatório
      const username = generateRandomUsername();
      const email = `${username}@${this.domain}`;
      
      logger.info(`Criando email: ${email}`);
      
      // Garantir que não reutilizamos
      if (this.usedEmails.has(email)) {
        logger.warning('Email já usado, gerando novo');
        return this.generateEmail(userId);
      }

      this.usedEmails.add(email);
      
      // Criar proxy-binding no ProxiedMail
      const response = await axios.post(
        `${this.baseUrl}/proxy-bindings`,
        {
          proxy_address: email,
          forward_to: this.forwardTo
        },
        {
          headers: {
            'Token': this.apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 30000
        }
      );

      const proxyData = response.data?.data || response.data;
      const proxyId = proxyData.id;
      
      // Armazenar dados
      this.emailData.set(userId, {
        email,
        proxyId,
        username,
        domain: this.domain,
        createdAt: new Date()
      });
      
      logger.success(`✅ Email criado: ${email} (ID: ${proxyId})`);
      
      return {
        email,
        proxyId,
        username,
        domain: this.domain
      };
    } catch (error) {
      logger.error(`Erro ao criar email`, error.response?.data || error.message);
      throw new Error(`Falha ao criar email: ${error.message}`);
    }
  }

  /**
   * Obtém mensagens recebidas para um proxy-binding
   */
  async getMessages(proxyId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/proxy-bindings/${proxyId}/messages`,
        {
          headers: {
            'Token': this.apiKey,
            'Accept': 'application/json'
          },
          timeout: 10000
        }
      );

      return response.data?.data || [];
    } catch (error) {
      if (error.response?.status === 404) {
        return []; // Nenhuma mensagem ainda
      }
      logger.error('Erro ao buscar mensagens', error);
      return [];
    }
  }

  /**
   * Obtém conteúdo completo de uma mensagem
   */
  async getEmailContent(proxyId, messageId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/proxy-bindings/${proxyId}/messages/${messageId}`,
        {
          headers: {
            'Token': this.apiKey,
            'Accept': 'application/json'
          },
          timeout: 10000
        }
      );

      return response.data?.data || response.data;
    } catch (error) {
      logger.error('Erro ao buscar conteúdo do email', error);
      throw error;
    }
  }

  /**
   * Aguarda email de verificação
   */
  async waitForVerificationEmail(emailData, maxAttempts = 3, delayMs = 3000) {
    const { proxyId, email } = emailData;
    
    logger.info('🔍 Monitorando chegada de email de verificação...', { 
      email,
      proxyId,
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
        
        const messages = await this.getMessages(proxyId);
        
        if (messages && messages.length > 0) {
          logger.info(`✉️  ${messages.length} email(s) encontrado(s)`);
          
          // Procurar email de verificação da Lovable
          for (const msg of messages) {
            const attrs = msg.attributes || msg;
            const from = attrs.from || attrs.sender || '';
            const subject = attrs.subject || '';
            
            const isFromLovable = 
              from.toLowerCase().includes('lovable') ||
              from.toLowerCase().includes('noreply');
            
            const isVerification = 
              subject.toLowerCase().includes('verif') ||
              subject.toLowerCase().includes('confirm') ||
              subject.toLowerCase().includes('activate');
            
            if (isFromLovable || isVerification) {
              logger.success('✅ Email de verificação encontrado!', {
                subject,
                from,
                attempt,
                timeElapsed: `${(attempt * delayMs) / 1000}s`
              });
              
              // Buscar conteúdo completo
              const fullEmail = await this.getEmailContent(proxyId, msg.id);
              const emailAttrs = fullEmail.attributes || fullEmail;
              
              return {
                id: msg.id,
                subject,
                from,
                body: emailAttrs.html_content || emailAttrs.text_content || ''
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

    // Se não encontrou o email após todas as tentativas, esperar mais 5 segundos antes de falhar
    logger.warning(`⚠️ Email não encontrado após ${maxAttempts} tentativas. Aguardando mais 5 segundos antes de marcar como falha...`);
    await this.delay(5000);
    
    throw new Error(`❌ Email não recebido após ${maxAttempts} tentativas`);
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
      domain: this.domain
    };
  }
}

export const emailService = new EmailService();

