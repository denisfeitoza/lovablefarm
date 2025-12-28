import { logger } from '../../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Gerenciador de domínios de email
 * - Suporta múltiplos domínios
 * - Alternância global (round-robin)
 * - Persistência em arquivo
 */
class DomainManager {
  constructor() {
    this.domains = [];
    this.currentIndex = 0;
    this.configPath = path.join(__dirname, '../../../config/email-domains.json');
    this.saving = false; // Flag para evitar saves simultâneos
    this.loadDomains();
  }

  /**
   * Carrega domínios do arquivo
   */
  loadDomains() {
    try {
      // Criar diretório se não existir
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // Carregar domínios do arquivo
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        const config = JSON.parse(data);
        this.domains = config.domains || [];
        this.currentIndex = config.currentIndex || 0;
        logger.info(`📧 Domínios carregados: ${this.domains.length} domínio(s)`);
      } else {
        // Configuração padrão
        this.domains = ['funcionariosartificiais.com', 'funcionariosdeia.com', 'vindia.com.br'];
        this.saveDomains();
        logger.info('📧 Configuração padrão de domínios criada');
      }
    } catch (error) {
      logger.error('Erro ao carregar domínios', error);
      this.domains = ['funcionariosartificiais.com', 'funcionariosdeia.com', 'vindia.com.br'];
    }
  }

  /**
   * Salva domínios no arquivo (thread-safe)
   */
  saveDomains() {
    // Evitar saves simultâneos
    if (this.saving) {
      return;
    }
    
    this.saving = true;
    try {
      const config = {
        domains: this.domains,
        currentIndex: this.currentIndex,
        updatedAt: new Date().toISOString()
      };

      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
      logger.info('💾 Domínios salvos com sucesso');
    } catch (error) {
      logger.error('Erro ao salvar domínios', error);
    } finally {
      // Usar setTimeout para garantir que não bloqueie outras chamadas
      setTimeout(() => {
        this.saving = false;
      }, 50);
    }
  }

  /**
   * Obtém próximo domínio (round-robin global)
   */
  getNextDomain() {
    if (this.domains.length === 0) {
      throw new Error('Nenhum domínio configurado');
    }

    const domain = this.domains[this.currentIndex];
    
    // Avançar para próximo domínio
    this.currentIndex = (this.currentIndex + 1) % this.domains.length;
    
    // Salvar índice atualizado
    this.saveDomains();

    logger.info(`📧 Domínio selecionado: ${domain} (índice: ${this.currentIndex - 1})`);
    
    return domain;
  }

  /**
   * Adiciona novo domínio
   */
  addDomain(domain) {
    // Validar domínio
    if (!domain || typeof domain !== 'string') {
      throw new Error('Domínio inválido');
    }

    // Remover espaços e converter para minúsculas
    domain = domain.trim().toLowerCase();

    // Verificar se já existe
    if (this.domains.includes(domain)) {
      throw new Error(`Domínio ${domain} já existe`);
    }

    this.domains.push(domain);
    this.saveDomains();

    logger.success(`✅ Domínio adicionado: ${domain}`);
    
    return { success: true, domain };
  }

  /**
   * Remove domínio
   */
  removeDomain(domain) {
    const index = this.domains.indexOf(domain);
    
    if (index === -1) {
      throw new Error(`Domínio ${domain} não encontrado`);
    }

    if (this.domains.length === 1) {
      throw new Error('Não é possível remover o último domínio');
    }

    this.domains.splice(index, 1);
    
    // Ajustar índice se necessário
    if (this.currentIndex >= this.domains.length) {
      this.currentIndex = 0;
    }

    this.saveDomains();

    logger.success(`✅ Domínio removido: ${domain}`);
    
    return { success: true, domain };
  }

  /**
   * Lista todos os domínios
   */
  listDomains() {
    return {
      domains: this.domains,
      currentIndex: this.currentIndex,
      currentDomain: this.domains[this.currentIndex],
      total: this.domains.length
    };
  }

  /**
   * Atualiza lista de domínios (substitui tudo)
   */
  updateDomains(newDomains) {
    if (!Array.isArray(newDomains) || newDomains.length === 0) {
      throw new Error('Lista de domínios inválida');
    }

    // Validar e limpar domínios
    const cleanedDomains = newDomains
      .map(d => d.trim().toLowerCase())
      .filter(d => d.length > 0);

    if (cleanedDomains.length === 0) {
      throw new Error('Nenhum domínio válido fornecido');
    }

    this.domains = cleanedDomains;
    this.currentIndex = 0;
    this.saveDomains();

    logger.success(`✅ Domínios atualizados: ${this.domains.length} domínio(s)`);
    
    return { success: true, domains: this.domains };
  }

  /**
   * Reseta o índice de alternância
   */
  resetIndex() {
    this.currentIndex = 0;
    this.saveDomains();
    logger.info('🔄 Índice de domínios resetado');
    return { success: true, currentIndex: 0 };
  }
}

// Singleton
export const domainManager = new DomainManager();

