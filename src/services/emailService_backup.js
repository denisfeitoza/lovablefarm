import axios from 'axios';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { generateRandomName } from '../utils/nameGenerator.js';

class EmailService {
  constructor() {
    this.usedEmails = new Set();
    this.emailData = new Map(); // userId -> emailData
    // Usar 1secmail - serviço gratuito e simples
    this.baseUrl = 'https://www.1secmail.com/api/v1/';
    this.domains = ['1secmail.com', '1secmail.org', '1secmail.net'];
  }

  /**
   * Cria um email temporário único para o usuário
   * Usa 1secmail (gratuito, sem API key necessária)
   */
  async generateEmail(userId) {
    try {
      // Gerar nome aleatório
      const randomName = generateRandomName();
      const domain = this.domains[Math.floor(Math.random() * this.domains.length)];
      const email = `${randomName}@${domain}`;
      
      // Extrair login e domain para buscar mensagens
      const [login, emailDomain] = email.split('@');
      
      logger.info(`Gerando email temporário: ${email}`);
      
      // Garantir que não reutilizamos emails
      if (this.usedEmails.has(email)) {
        logger.warning('Email já usado, gerando novo');
        return this.generateEmail(userId);
      }

      this.usedEmails.add(email);
      
      // Armazenar dados do email
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
      logger.error(`Erro ao gerar email para usuário ${userId}`, error);
      throw new Error(`Falha ao criar email temporário: ${error.message}`);
    }
  }

  /**
   * Obtém mensagens recebidas para um proxy-email
   */
  async getMessages(proxyEmailId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/v1/proxy-emails/${proxyEmailId}/messages`,
        {
          headers: {
            'X-API-Key': this.apiKey
          },
          timeout: 30000
        }
      );

      return response.data || [];
    } catch (error) {
      if (error.response?.status === 404) {
        // Nenhuma mensagem ainda, não é erro
        return [];
      }
      logger.error('Erro ao buscar mensagens', error);
      throw error;
    }
  }

  /**
   * Busca por email de verificação específico
   * Monitora continuamente a chegada de novos emails
   */
  async waitForVerificationEmail(proxyEmailId, maxAttempts = 30, delayMs = 2000) {
    logger.info('🔍 Monitorando chegada de email de verificação...', { 
      proxyEmailId, 
      maxAttempts, 
      delayMs,
      totalWaitTime: `${(maxAttempts * delayMs) / 1000}s`
    });

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        logger.info(`📬 Verificando inbox... (${attempt}/${maxAttempts})`);
        
        const messages = await this.getMessages(proxyEmailId);
        
        if (messages && messages.length > 0) {
          logger.info(`✉️  ${messages.length} email(s) encontrado(s) na inbox`);
          
          // Procurar por email de verificação da Lovable
          // Apenas aceitar emails que provavelmente contenham o link específico
          const verificationEmail = messages.find(msg => {
            // Verificar se o email é da Lovable
            const isFromLovable = 
              msg.from?.toLowerCase().includes('lovable') ||
              msg.from?.toLowerCase().includes('noreply') ||
              msg.from?.toLowerCase().includes('no-reply');
            
            // Verificar se o assunto indica verificação
            const isVerificationSubject = 
              msg.subject?.toLowerCase().includes('verif') ||
              msg.subject?.toLowerCase().includes('confirm') ||
              msg.subject?.toLowerCase().includes('ative') ||
              msg.subject?.toLowerCase().includes('activate') ||
              msg.subject?.toLowerCase().includes('verify');
            
            // Aceitar apenas se for da Lovable E parecer ser de verificação
            return isFromLovable && isVerificationSubject;
          });

          if (verificationEmail) {
            logger.success('✅ Email de verificação encontrado!', {
              subject: verificationEmail.subject,
              from: verificationEmail.from,
              attempt,
              timeElapsed: `${(attempt * delayMs) / 1000}s`
            });
            return verificationEmail;
          } else {
            // Logar emails recebidos para debug
            messages.forEach(msg => {
              logger.info('📧 Email recebido (não é verificação da Lovable):', {
                subject: msg.subject,
                from: msg.from,
                reason: !msg.from?.toLowerCase().includes('lovable') ? 'Não é da Lovable' : 'Assunto não indica verificação'
              });
            });
          }
        } else {
          logger.info(`📭 Inbox vazia - aguardando...`);
        }

        // Aguardar antes da próxima tentativa
        if (attempt < maxAttempts) {
          logger.info(`⏳ Aguardando ${delayMs}ms antes da próxima verificação...`);
          await this.delay(delayMs);
        }
      } catch (error) {
        logger.warning(`⚠️  Erro na tentativa ${attempt}`, { error: error.message });
        await this.delay(delayMs);
      }
    }

    throw new Error(`❌ Timeout: Email de verificação não recebido após ${maxAttempts} tentativas (${(maxAttempts * delayMs) / 1000}s)`);
  }

  /**
   * Obtém o conteúdo completo de uma mensagem
   */
  async getMessageContent(proxyEmailId, messageId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/v1/proxy-emails/${proxyEmailId}/messages/${messageId}`,
        {
          headers: {
            'X-API-Key': this.apiKey
          },
          timeout: 30000
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Erro ao buscar conteúdo da mensagem', error);
      throw error;
    }
  }

  /**
   * Extrai link de verificação do conteúdo do email
   * APENAS aceita links no formato específico da Lovable:
   * https://lovable.dev/auth/action?mode=verifyEmail&oobCode=...&apiKey=...&lang=...
   */
  extractVerificationLink(message) {
    try {
      // ProxiedMail retorna o conteúdo em text e html
      const text = message.text || message.html || message.body || '';
      
      logger.info('🔍 Procurando link de verificação no email...', {
        hasText: !!message.text,
        hasHtml: !!message.html,
        contentLength: text.length
      });
      
      // Padrão ESPECÍFICO do link de verificação da Lovable
      // https://lovable.dev/auth/action?mode=verifyEmail&oobCode=...&apiKey=...&lang=...
      const lovableVerificationPattern = /https?:\/\/lovable\.dev\/auth\/action\?mode=verifyEmail[^\s<>"']+/gi;
      
      // Primeiro, tentar encontrar o padrão específico
      const verificationMatches = text.match(lovableVerificationPattern);
      
      if (verificationMatches && verificationMatches.length > 0) {
        // Limpar o link (remover possíveis caracteres extras)
        let link = verificationMatches[0]
          .replace(/[<>"'\s\n\r\t]/g, '')  // Remove caracteres especiais
          .replace(/[.,;!?)]+$/, '')        // Remove pontuação no final
          .replace(/\s*$/, '')              // Remove espaços no final
          .trim();
        
        // Validar que o link tem todos os parâmetros necessários
        if (link.includes('mode=verifyEmail') && link.includes('oobCode=')) {
          logger.success('✅ Link de verificação da Lovable encontrado!', { 
            link: link.substring(0, 100) + '...' // Mostrar apenas início por segurança
          });
          return link;
        } else {
          logger.warning('⚠️  Link encontrado mas faltam parâmetros obrigatórios', {
            link: link.substring(0, 100)
          });
        }
      }
      
      // Se não encontrou o padrão específico, procurar todos os links lovable.dev/auth/action
      logger.warning('⚠️  Padrão específico não encontrado, procurando links lovable.dev/auth/action...');
      const allLovableLinks = text.match(/https?:\/\/lovable\.dev\/auth\/action[^\s<>"']+/gi);
      
      if (allLovableLinks && allLovableLinks.length > 0) {
        logger.info(`🔗 ${allLovableLinks.length} link(s) lovable.dev/auth/action encontrado(s)`);
        
        // Filtrar apenas links com mode=verifyEmail
        const verificationLinks = allLovableLinks.filter(link => 
          link.includes('mode=verifyEmail')
        );
        
        if (verificationLinks.length > 0) {
          let link = verificationLinks[0]
            .replace(/[<>"'\s]/g, '')
            .replace(/[.,;!?)]+$/, '')
            .trim();
          
          logger.success('✅ Link de verificação encontrado (modo fallback):', { 
            link: link.substring(0, 100) + '...'
          });
          return link;
        }
        
        logger.warning('⚠️  Links lovable.dev encontrados mas nenhum com mode=verifyEmail');
      }

      // Log do conteúdo para debug (apenas se não encontrou nada)
      logger.error('❌ Nenhum link de verificação válido encontrado!', {
        expectedFormat: 'https://lovable.dev/auth/action?mode=verifyEmail&oobCode=...',
        textPreview: text.substring(0, 500),
        totalLength: text.length,
        allLinksInText: (text.match(/https?:\/\/[^\s<>"']+/gi) || []).length
      });

      throw new Error('Nenhum link de verificação válido encontrado. Formato esperado: https://lovable.dev/auth/action?mode=verifyEmail&oobCode=...');
    } catch (error) {
      logger.error('❌ Erro ao extrair link de verificação', error);
      throw error;
    }
  }

  /**
   * Deleta um proxy-email (limpeza)
   */
  async deleteProxyEmail(proxyEmailId) {
    try {
      await axios.delete(
        `${this.baseUrl}/v1/proxy-emails/${proxyEmailId}`,
        {
          headers: {
            'X-API-Key': this.apiKey
          },
          timeout: 30000
        }
      );
      
      logger.info('Proxy-email deletado', { id: proxyEmailId });
    } catch (error) {
      logger.warning('Erro ao deletar proxy-email', error);
      // Não lançar erro, é apenas limpeza
    }
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Limpa emails usados (útil para testes)
   */
  clearUsedEmails() {
    this.usedEmails.clear();
    this.proxyEmails.clear();
  }

  /**
   * Obtém estatísticas
   */
  getStats() {
    return {
      totalEmailsGenerated: this.usedEmails.size,
      activeProxyEmails: this.proxyEmails.size,
      domains: config.proxiedMailDomains.length
    };
  }
}

export const emailService = new EmailService();
