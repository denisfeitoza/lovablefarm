import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Serviço para gerenciar arquivos CSV com append incremental
 */
class CSVService {
  constructor() {
    this.dataDir = path.join(__dirname, '../../data');
    this.accountsPath = path.join(this.dataDir, 'accounts.csv');
    this.executionHistoryPath = path.join(this.dataDir, 'execution_history.csv');
    
    // Garantir que o diretório existe
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * Escapa valores CSV (trata vírgulas, aspas e quebras de linha)
   */
  escapeCSV(value) {
    if (value === null || value === undefined) {
      return '';
    }
    
    const stringValue = String(value);
    
    // Se contém vírgula, aspas ou quebra de linha, precisa ser envolvido em aspas
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      // Escapar aspas duplicando-as
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    
    return stringValue;
  }

  /**
   * Adiciona linha ao arquivo CSV (append incremental)
   * @param {string} filePath - Caminho do arquivo CSV
   * @param {Array} headers - Array com os cabeçalhos das colunas
   * @param {Array} values - Array com os valores das colunas
   */
  appendCSVLine(filePath, headers, values) {
    try {
      const fileExists = fs.existsSync(filePath);
      
      // Se arquivo não existe, criar com cabeçalho
      if (!fileExists) {
        const headerLine = headers.map(h => this.escapeCSV(h)).join(',') + '\n';
        fs.writeFileSync(filePath, headerLine, 'utf8');
      }
      
      // Adicionar linha de dados
      const dataLine = values.map(v => this.escapeCSV(v)).join(',') + '\n';
      fs.appendFileSync(filePath, dataLine, 'utf8');
      
      return true;
    } catch (error) {
      logger.error(`Erro ao adicionar linha ao CSV ${filePath}`, error);
      return false;
    }
  }

  /**
   * Adiciona conta criada ao arquivo accounts.csv
   * @param {string} email - Email da conta
   * @param {string} password - Senha da conta
   * @param {string} timestamp - Timestamp ISO
   * @param {number} queueId - ID da fila
   * @param {number} userId - ID do usuário
   */
  appendAccount(email, password, timestamp, queueId, userId) {
    const headers = ['email', 'password', 'timestamp', 'queueId', 'userId'];
    const values = [email, password, timestamp, queueId, userId];
    
    const success = this.appendCSVLine(this.accountsPath, headers, values);
    
    if (success) {
      logger.info(`📝 Conta adicionada ao CSV: ${email}`);
    }
    
    return success;
  }

  /**
   * Adiciona execução ao histórico em CSV
   * @param {Object} executionData - Dados da execução
   */
  appendExecutionHistory(executionData) {
    const {
      timestamp,
      queueId,
      userId,
      status,
      email,
      creditsEarned,
      error,
      failedStep,
      domain,
      referralLink
    } = executionData;

    const headers = [
      'timestamp',
      'queueId',
      'userId',
      'status',
      'email',
      'creditsEarned',
      'error',
      'failedStep',
      'domain',
      'referralLink'
    ];

    const values = [
      timestamp || new Date().toISOString(),
      queueId || '',
      userId || '',
      status || '',
      email || '',
      creditsEarned || 0,
      error || '',
      failedStep || '',
      domain || '',
      referralLink || ''
    ];

    const success = this.appendCSVLine(this.executionHistoryPath, headers, values);
    
    if (success) {
      logger.info(`📊 Execução adicionada ao histórico CSV: Queue ${queueId}, User ${userId}, Status ${status}`);
    }
    
    return success;
  }
}

// Singleton
export const csvService = new CSVService();

