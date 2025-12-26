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

  /**
   * Adiciona uma falha individual ao histórico
   * @param {Object} failure - Objeto com dados da falha
   */
  addFailure(failure) {
    const record = {
      id: `failure-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      email: failure.email,
      error: failure.error,
      failedStep: failure.failedStep,
      userId: failure.userId,
      queueId: failure.queueId,
      timestamp: new Date().toISOString(),
      referralLink: failure.referralLink || null
    };

    // Carregar falhas existentes
    const failuresPath = path.join(__dirname, '../../../data/failures.json');
    let failures = [];
    
    try {
      if (fs.existsSync(failuresPath)) {
        const data = fs.readFileSync(failuresPath, 'utf8');
        failures = JSON.parse(data);
      }
    } catch (error) {
      logger.error('Erro ao carregar falhas', error);
      failures = [];
    }

    // Adicionar no início da lista (mais recente primeiro)
    failures.unshift(record);
    
    // Manter apenas as últimas 100 falhas
    if (failures.length > 100) {
      failures = failures.slice(0, 100);
    }

    // Salvar falhas
    try {
      const dataDir = path.dirname(failuresPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(failuresPath, JSON.stringify(failures, null, 2), 'utf8');
      logger.info(`📚 Falha registrada: ${failure.email}`);
    } catch (error) {
      logger.error('Erro ao salvar falha', error);
    }
  }

  /**
   * Retorna as falhas recentes
   * @param {number} limit - Número máximo de falhas a retornar
   */
  getRecentFailures(limit = 20) {
    const failuresPath = path.join(__dirname, '../../../data/failures.json');
    
    try {
      if (fs.existsSync(failuresPath)) {
        const data = fs.readFileSync(failuresPath, 'utf8');
        const failures = JSON.parse(data);
        return failures.slice(0, limit);
      }
    } catch (error) {
      logger.error('Erro ao carregar falhas', error);
    }
    
    return [];
  }
}

// Singleton
export const historyManager = new HistoryManager();

