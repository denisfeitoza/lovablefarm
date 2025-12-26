import { executeUserFlow } from '../../automation/userFlow.js';
import { logger } from '../../utils/logger.js';
import { logStream } from '../../utils/logStream.js';
import { historyManager } from './HistoryManager.js';
import pLimit from 'p-limit';

/**
 * Gerenciador de filas de execução
 * - Suporta execução paralela
 * - Garante fingerprints únicos por sessão
 * - Monitoramento em tempo real
 */
class QueueManager {
  constructor() {
    this.queues = new Map(); // { queueId: Queue }
    this.activeExecutions = new Map(); // { executionId: ExecutionState }
    this.listeners = []; // WebSocket listeners
    this.nextQueueId = 1;
    this.nextExecutionId = 1;

    // Escutar logs do sistema e retransmitir para o frontend
    logStream.on('log', (log) => {
      this.emit('system:log', log);
    });
  }

  /**
   * Adiciona listener para eventos
   */
  addListener(callback) {
    this.listeners.push(callback);
  }

  /**
   * Emite evento para todos os listeners
   */
  emit(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        logger.error('Erro ao emitir evento', error);
      }
    });
  }

  /**
   * Cria nova fila de execução
   */
  createQueue(config) {
    const queueId = `queue-${this.nextQueueId++}`;
    
    // Validar link de indicação
    if (!config.referralLink) {
      throw new Error('Link de indicação é obrigatório');
    }
    
    // Log dos domínios selecionados
    logger.info(`📧 Domínios selecionados para a fila: ${JSON.stringify(config.selectedDomains || [])}`);
    
    const queue = {
      id: queueId,
      name: config.name || `Fila ${queueId}`,
      referralLink: config.referralLink,
      selectedDomains: config.selectedDomains || [], // Domínios selecionados para esta fila
      totalUsers: config.users,
      parallelExecutions: config.parallel || 1,
      status: 'pending', // pending, running, completed, failed
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      results: {
        total: 0,
        success: 0,
        failed: 0,
        pending: config.users,
        credits: 0
      },
      config: config
    };

    this.queues.set(queueId, queue);
    
    this.emit('queue:created', { queueId, queue });
    logger.info(`📋 Fila criada: ${queueId} (${config.users} usuários, ${queue.parallelExecutions} paralelo)`);
    
    return queue; // Retornar o objeto completo, não apenas o ID
  }

  /**
   * Inicia execução de uma fila
   */
  async startQueue(queueId) {
    const queue = this.queues.get(queueId);
    
    if (!queue) {
      throw new Error(`Fila ${queueId} não encontrada`);
    }

    if (queue.status === 'running') {
      throw new Error(`Fila ${queueId} já está em execução`);
    }

    queue.status = 'running';
    queue.cancelled = false; // Flag para cancelamento
    queue.startedAt = new Date().toISOString();
    
    this.emit('queue:started', { queueId, queue });
    logger.info(`🚀 Iniciando fila: ${queueId}`);

    try {
      // Criar limite de concorrência
      const limit = pLimit(queue.parallelExecutions);

      // Criar promessas para todos os usuários
      const promises = [];
      
      for (let i = 1; i <= queue.totalUsers; i++) {
        // Verificar se foi cancelado antes de criar nova execução
        if (queue.cancelled) {
          logger.warning(`⚠️ Fila ${queueId} foi cancelada, não iniciando usuário ${i}`);
          break;
        }
        
        promises.push(
          limit(() => {
            // Verificar novamente no momento de executar
            if (queue.cancelled) {
              logger.warning(`⚠️ Fila ${queueId} cancelada, pulando usuário ${i}`);
              return Promise.resolve({ cancelled: true });
            }
            return this.executeUser(queueId, i);
          })
        );
      }

      // Aguardar todas as execuções
      await Promise.allSettled(promises);

      // Verificar status final
      if (queue.cancelled) {
        queue.status = 'cancelled';
        logger.warning(`⚠️ Fila cancelada: ${queueId}`);
      } else {
        queue.status = 'completed';
      }
      
      queue.completedAt = new Date().toISOString();
      
      // Salvar no histórico
      historyManager.addQueueRecord(queue);
      
      this.emit('queue:completed', { queueId, queue });
      logger.success(`✅ Fila concluída: ${queueId} (${queue.results.success}/${queue.totalUsers} sucessos)`);

    } catch (error) {
      queue.status = 'failed';
      queue.error = error.message;
      
      // Salvar no histórico mesmo se falhar
      historyManager.addQueueRecord(queue);
      
      this.emit('queue:failed', { queueId, queue, error: error.message });
      logger.error(`❌ Fila falhou: ${queueId}`, error);
    }

    return queue;
  }

  /**
   * Para/cancela execução de uma fila
   */
  stopQueue(queueId) {
    const queue = this.queues.get(queueId);
    
    if (!queue) {
      throw new Error(`Fila ${queueId} não encontrada`);
    }

    if (queue.status !== 'running') {
      throw new Error(`Fila ${queueId} não está em execução`);
    }

    queue.cancelled = true;
    logger.warning(`⚠️ Solicitado cancelamento da fila: ${queueId}`);
    
    this.emit('queue:stop_requested', { queueId, queue });
    
    return queue;
  }

  /**
   * Executa um usuário individual
   */
  async executeUser(queueId, userId) {
    const queue = this.queues.get(queueId);
    const executionId = `exec-${this.nextExecutionId++}`;
    
    const execution = {
      id: executionId,
      queueId,
      userId,
      status: 'running',
      startedAt: new Date().toISOString(),
      completedAt: null,
      result: null,
      error: null
    };

    this.activeExecutions.set(executionId, execution);
    
    this.emit('execution:started', { executionId, execution });
    logger.info(`▶️  Executando usuário ${userId} (${executionId}) com link: ${queue.referralLink}`);

    try {
      // Determinar domínio para este usuário (Round Robin) se houver seleção
      let domain = null;
      if (queue.selectedDomains && queue.selectedDomains.length > 0) {
        // userId começa em 1, então (userId - 1) % length dá o índice correto
        domain = queue.selectedDomains[(userId - 1) % queue.selectedDomains.length];
        logger.info(`📧 Usuário ${userId} usará domínio específico da fila: ${domain}`);
      } else {
        logger.warning(`⚠️ Usuário ${userId} usará rotação global (nenhum domínio foi selecionado para a fila)`);
        logger.info(`Domínios disponíveis na fila: ${JSON.stringify(queue.selectedDomains)}`);
      }

      // Executar fluxo do usuário passando o link de indicação e o domínio
      const result = await executeUserFlow(userId, queue.referralLink, domain);

      // Atualizar execução
      execution.status = result.success ? 'success' : 'failed';
      execution.completedAt = new Date().toISOString();
      execution.result = result;
      
      // Adicionar credenciais se disponíveis
      if (result.credentials) {
        execution.credentials = result.credentials;
      }

      // Atualizar estatísticas da fila
      queue.results.total++;
      queue.results.pending--;
      
      if (result.success) {
        queue.results.success++;
        queue.results.credits += result.creditsEarned || 0;
      } else {
        queue.results.failed++;
        execution.error = result.error;
        
        // Registrar falha no histórico
        historyManager.addFailure({
          email: result.credentials?.email || result.email || 'N/A',
          error: result.error || 'Erro desconhecido',
          failedStep: result.failedStep || 'Desconhecida',
          userId: userId,
          queueId: queueId,
          referralLink: queue.referralLink
        });
      }

      this.emit('execution:completed', { executionId, execution });
      this.emit('queue:updated', { queueId, queue });
      
      logger.success(`✅ Usuário ${userId} concluído (${executionId})`);

    } catch (error) {
      execution.status = 'failed';
      execution.completedAt = new Date().toISOString();
      execution.error = error.message;

      queue.results.total++;
      queue.results.pending--;
      queue.results.failed++;

      // Registrar falha no histórico
      const email = execution.credentials?.email || 'N/A';
      historyManager.addFailure({
        email: email,
        error: error.message,
        failedStep: error.message.includes('Banner/popup') ? 'Verificação de Créditos' : 'Erro na execução',
        userId: userId,
        queueId: queueId,
        referralLink: queue.referralLink
      });

      this.emit('execution:failed', { executionId, execution, error: error.message });
      this.emit('queue:updated', { queueId, queue });
      
      logger.error(`❌ Usuário ${userId} falhou (${executionId})`, error);
    } finally {
      // Remover execução ativa após 1 minuto
      setTimeout(() => {
        this.activeExecutions.delete(executionId);
      }, 60000);
    }
  }

  /**
   * Obtém informações de uma fila
   */
  getQueue(queueId) {
    return this.queues.get(queueId);
  }

  /**
   * Lista todas as filas
   */
  listQueues() {
    return Array.from(this.queues.values());
  }

  /**
   * Lista execuções ativas
   */
  listActiveExecutions() {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * Obtém estatísticas gerais
   */
  getStats() {
    const queues = this.listQueues();
    const activeExecutions = this.listActiveExecutions();

    return {
      totalQueues: queues.length,
      runningQueues: queues.filter(q => q.status === 'running').length,
      completedQueues: queues.filter(q => q.status === 'completed').length,
      failedQueues: queues.filter(q => q.status === 'failed').length,
      activeExecutions: activeExecutions.length,
      totalCredits: queues.reduce((sum, q) => sum + q.results.credits, 0),
      totalSuccess: queues.reduce((sum, q) => sum + q.results.success, 0),
      totalFailed: queues.reduce((sum, q) => sum + q.results.failed, 0)
    };
  }
}

// Singleton
export const queueManager = new QueueManager();

