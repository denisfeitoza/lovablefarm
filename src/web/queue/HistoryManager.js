import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { logger } from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Gerenciador de histórico de execuções
 * Salva e recupera dados de execuções passadas
 */
class HistoryManager {
  constructor() {
    this.historyPath = path.join(__dirname, '../../../data/history.json');
    this.history = [];
    this.loadHistory();
  }

  /**
   * Carrega o histórico do arquivo JSON
   */
  loadHistory() {
    try {
      const dataDir = path.dirname(this.historyPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      if (fs.existsSync(this.historyPath)) {
        const data = fs.readFileSync(this.historyPath, 'utf8');
        this.history = JSON.parse(data);
        logger.info(`📚 Histórico carregado: ${this.history.length} registros`);
      } else {
        this.history = [];
        this.saveHistory();
      }
    } catch (error) {
      logger.error('Erro ao carregar histórico', error);
      this.history = [];
    }
  }

  /**
   * Salva o histórico no arquivo JSON
   */
  saveHistory() {
    try {
      fs.writeFileSync(this.historyPath, JSON.stringify(this.history, null, 2), 'utf8');
    } catch (error) {
      logger.error('Erro ao salvar histórico', error);
    }
  }

  /**
   * Adiciona um registro de fila completada ao histórico
   * @param {Object} queue - Objeto da fila
   */
  addQueueRecord(queue) {
    const record = {
      id: queue.id,
      name: queue.name,
      status: queue.status,
      startedAt: queue.startedAt,
      completedAt: queue.completedAt,
      totalUsers: queue.totalUsers,
      results: queue.results,
      referralLink: queue.referralLink
    };

    // Adicionar no início da lista (mais recente primeiro)
    this.history.unshift(record);
    
    // Manter apenas os últimos 50 registros
    if (this.history.length > 50) {
      this.history = this.history.slice(0, 50);
    }

    this.saveHistory();
    logger.info(`📚 Fila adicionada ao histórico: ${queue.id}`);
  }

  /**
   * Retorna o histórico completo
   */
  getHistory() {
    return this.history;
  }

  /**
   * Limpa o histórico
   */
  clearHistory() {
    this.history = [];
    this.saveHistory();
    logger.info('📚 Histórico limpo');
    return true;
  }
}

// Singleton
export const historyManager = new HistoryManager();

