import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { logger } from '../utils/logger.js';
import { normalizeReferralLink } from '../utils/referralLink.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Serviço para rastrear uso de links de indicação
 */
class ReferralLinkTracker {
  constructor() {
    this.dataDir = path.join(__dirname, '../../data');
    this.trackerPath = path.join(this.dataDir, 'referral_links.json');
    
    // Garantir que o diretório existe
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    // Inicializar arquivo se não existir
    this.initializeFile();
  }

  /**
   * Inicializa o arquivo de rastreamento se não existir
   */
  initializeFile() {
    if (!fs.existsSync(this.trackerPath)) {
      const initialData = {
        links: {},
        lastUpdated: new Date().toISOString()
      };
      fs.writeFileSync(this.trackerPath, JSON.stringify(initialData, null, 2), 'utf8');
      logger.info('📝 Arquivo de rastreamento de links criado');
    }
  }

  /**
   * Carrega dados de rastreamento
   */
  loadData() {
    try {
      const data = fs.readFileSync(this.trackerPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Erro ao carregar dados de rastreamento', error);
      return { links: {}, lastUpdated: new Date().toISOString() };
    }
  }

  /**
   * Salva dados de rastreamento
   */
  saveData(data) {
    try {
      data.lastUpdated = new Date().toISOString();
      fs.writeFileSync(this.trackerPath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (error) {
      logger.error('Erro ao salvar dados de rastreamento', error);
      return false;
    }
  }

  /**
   * Registra uso de um link de indicação
   * @param {string} referralLink - Link de indicação
   * @param {string} queueId - ID da fila
   * @param {number} usersCount - Número de usuários na fila
   */
  recordUsage(referralLink, queueId, usersCount = 1) {
    try {
      const normalizedLink = normalizeReferralLink(referralLink);
      const data = this.loadData();
      
      if (!data.links[normalizedLink]) {
        data.links[normalizedLink] = {
          link: normalizedLink,
          originalLink: referralLink,
          usageCount: 0,
          firstUsed: new Date().toISOString(),
          lastUsed: null,
          queues: []
        };
      }
      
      // Atualizar contagem
      data.links[normalizedLink].usageCount += usersCount;
      data.links[normalizedLink].lastUsed = new Date().toISOString();
      
      // Adicionar fila à lista (evitar duplicatas)
      if (!data.links[normalizedLink].queues.includes(queueId)) {
        data.links[normalizedLink].queues.push(queueId);
      }
      
      this.saveData(data);
      logger.info(`📊 Link registrado: ${normalizedLink} (total: ${data.links[normalizedLink].usageCount} usos)`);
      
      return {
        success: true,
        usageCount: data.links[normalizedLink].usageCount
      };
    } catch (error) {
      logger.error('Erro ao registrar uso de link', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtém contagem de uso de um link
   * @param {string} referralLink - Link de indicação
   * @returns {number} Número de vezes que o link foi usado
   */
  getUsageCount(referralLink) {
    try {
      const normalizedLink = normalizeReferralLink(referralLink);
      const data = this.loadData();
      
      if (!data.links[normalizedLink]) {
        return 0;
      }
      
      return data.links[normalizedLink].usageCount || 0;
    } catch (error) {
      logger.error('Erro ao obter contagem de uso', error);
      return 0;
    }
  }

  /**
   * Obtém informações completas sobre um link
   * @param {string} referralLink - Link de indicação
   * @returns {Object} Informações do link
   */
  getLinkInfo(referralLink) {
    try {
      const normalizedLink = normalizeReferralLink(referralLink);
      const data = this.loadData();
      
      if (!data.links[normalizedLink]) {
        return {
          link: normalizedLink,
          usageCount: 0,
          firstUsed: null,
          lastUsed: null,
          queues: []
        };
      }
      
      return {
        ...data.links[normalizedLink],
        link: normalizedLink
      };
    } catch (error) {
      logger.error('Erro ao obter informações do link', error);
      return {
        link: referralLink,
        usageCount: 0,
        firstUsed: null,
        lastUsed: null,
        queues: []
      };
    }
  }

  /**
   * Obtém todos os links rastreados
   * @returns {Array} Lista de links com informações
   */
  getAllLinks() {
    try {
      const data = this.loadData();
      return Object.values(data.links).map(link => ({
        ...link,
        link: link.link || link.originalLink
      }));
    } catch (error) {
      logger.error('Erro ao obter todos os links', error);
      return [];
    }
  }

  /**
   * Limpa todos os dados de rastreamento
   */
  clearAll() {
    try {
      const data = {
        links: {},
        lastUpdated: new Date().toISOString()
      };
      this.saveData(data);
      logger.info('📚 Dados de rastreamento limpos');
      return { success: true };
    } catch (error) {
      logger.error('Erro ao limpar dados de rastreamento', error);
      return { success: false, error: error.message };
    }
  }
}

// Singleton
export const referralLinkTracker = new ReferralLinkTracker();


