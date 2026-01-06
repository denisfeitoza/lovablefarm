import { executeUserFlow } from '../../automation/userFlow.js';
import { logger } from '../../utils/logger.js';
import { logStream } from '../../utils/logStream.js';
import { historyManager } from './HistoryManager.js';
import { proxyService } from '../../services/proxyService.js';
import { csvService } from '../../services/csvService.js';
import { referralLinkTracker } from '../../services/referralLinkTracker.js';
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
   * Remove listener para eventos
   */
  removeListener(callback) {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Emite evento para todos os listeners
   */
  emit(event, data) {
    // Usar slice para criar uma cópia, evitando problemas se listeners forem removidos durante a iteração
    this.listeners.slice().forEach(listener => {
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
    
    // Normalizar useOutlook: garantir que seja boolean
    const useOutlookValue = config.useOutlook === true || config.useOutlook === 'true' || (config.useOutlook !== false && config.useOutlook !== 'false' && config.useOutlook !== undefined);
    logger.info(`📬 Modo Outlook configurado para a fila: ${useOutlookValue} (valor recebido: ${config.useOutlook})`);
    
    const queue = {
      id: queueId,
      name: config.name || `Fila ${queueId}`,
      referralLink: config.referralLink,
      selectedDomains: config.selectedDomains || [], // Domínios selecionados para esta fila
      selectedProxies: config.selectedProxies || [], // Proxies selecionados para esta fila
      simulatedErrors: config.simulatedErrors || [], // Erros simulados para testar fallbacks
      forceCredits: config.forceCredits || false, // Buscar créditos a todo custo
      turboMode: config.turboMode || false, // Modo turbo (pula quiz e seleção de template)
      checkCreditsBanner: config.checkCreditsBanner || false, // Verificar banner de créditos no editor (só funciona com turboMode)
      enableConcurrentRequests: config.enableConcurrentRequests || false, // Ativar teste de requisições simultâneas
      concurrentRequests: config.concurrentRequests || 100, // Número de requisições simultâneas (padrão: 100 = 1000 créditos)
      useOutlook: useOutlookValue, // Usar modo Outlook
      totalUsers: config.users,
      parallelExecutions: config.parallel || 1,
      status: 'pending', // pending, running, completed, failed
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      elapsedTime: 0, // Tempo decorrido em segundos
      executionTimes: [], // Array de tempos de execução (sucessos e falhas) para calcular média
      results: {
        total: 0,
        success: 0,
        failed: 0,
        target: config.users, // Meta (pode ser dinâmica se forceCredits)
        credits: 0
      },
      timeline: {
        errors: [], // Array de { timestamp: número de segundos desde o início, error: mensagem, userId: número, failedStep: string }
        successes: [] // Array de { timestamp: número de segundos desde o início, userId: número }
      }
    };

    this.queues.set(queueId, queue);
    
    // NÃO registrar uso do link aqui - só registrar quando houver sucesso
    // referralLinkTracker.recordUsage(config.referralLink, queueId, config.users);
    
    this.emit('queue:created', { queueId, queue: this.serializeQueue(queue) });
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

    // Verificar se já existe outra fila rodando
    const runningQueue = Array.from(this.queues.values()).find(
      q => q.id !== queueId && (q.status === 'running' || q.status === 'finalizing')
    );
    
    if (runningQueue) {
      throw new Error(`Já existe uma fila em execução (${runningQueue.id}: ${runningQueue.name}). Pare a fila atual antes de iniciar outra.`);
    }

    queue.status = 'running';
    queue.cancelled = false; // Flag para cancelamento
    queue.startedAt = new Date().toISOString();
    queue.elapsedTime = 0;
    queue.timeline.errors = [];
    queue.timeline.successes = [];
    queue.executionTimes = []; // Inicializar array de tempos de execução
    
    // Iniciar timer para atualizar elapsedTime a cada segundo
    queue.timerInterval = setInterval(() => {
      if ((queue.status === 'running' || queue.status === 'finalizing') && queue.startedAt) {
        const startTime = new Date(queue.startedAt).getTime();
        const now = Date.now();
        queue.elapsedTime = Math.floor((now - startTime) / 1000);
        this.emit('queue:updated', { queueId, queue: this.serializeQueue(queue) });
      }
    }, 1000);
    
    this.emit('queue:started', { queueId, queue: this.serializeQueue(queue) });
    logger.info(`🚀 Iniciando fila: ${queueId}${queue.forceCredits ? ' (Modo: Buscar créditos a todo custo)' : ''}`);

    try {
      // Criar limite de concorrência
      const limit = pLimit(queue.parallelExecutions);

      if (queue.forceCredits) {
        // Modo "buscar créditos a todo custo": continuar tentando até atingir a meta
        await this.executeQueueWithRetry(queueId, limit);
      } else {
        // Modo normal: executar apenas o número especificado de usuários
        // Criar promises dinamicamente conforme slots ficam disponíveis
        let currentUserId = 1;
        const promises = [];
        
        // Função para criar e adicionar próxima execução
        const createNextExecution = () => {
          // Verificar se ainda há usuários para processar (usar currentUserId, não results.total)
          if (currentUserId > queue.totalUsers) {
            return null;
          }
          
          // Verificar se foi cancelado
          if (queue.cancelled || queue.status === 'finalizing') {
            logger.warning(`⚠️ Fila ${queueId} foi cancelada, não iniciando mais usuários`);
            return null;
          }
          
          const userId = currentUserId++;
          
          // Adicionar delay escalonado apenas para as primeiras execuções (até o limite de paralelismo)
          const delayMs = (userId <= queue.parallelExecutions) ? (userId - 1) * 2000 : 0;
          
          return limit(async () => {
            // Aguardar delay escalonado antes de iniciar (apenas nas primeiras execuções)
            if (delayMs > 0) {
              await new Promise(resolve => setTimeout(resolve, delayMs));
            }
            
            // Verificar novamente no momento de executar (após o delay)
            if (queue.cancelled || queue.status === 'finalizing') {
              logger.warning(`⚠️ Fila ${queueId} cancelada, pulando usuário ${userId}`);
              return { cancelled: true };
            }
            
            const result = await this.executeUser(queueId, userId);
            
            // Verificar se fila foi cancelada após execução (pode ter atingido meta)
            if (queue.cancelled || queue.status === 'finalizing') {
              return result;
            }
            
            // Após completar, verificar se ainda há mais usuários para executar (usar currentUserId, não results.total)
            // Isso garante que mesmo com erros, o sistema continue até tentar todos os usuários
            if (currentUserId <= queue.totalUsers && !queue.cancelled && queue.status !== 'finalizing') {
              const nextPromise = createNextExecution();
              if (nextPromise) {
                promises.push(nextPromise);
              }
            }
            
            return result;
          });
        };
        
        // Criar as primeiras execuções (até o limite de paralelismo OU o número total de usuários)
        const initialExecutions = Math.min(queue.parallelExecutions, queue.totalUsers);
        for (let i = 0; i < initialExecutions; i++) {
          const promise = createNextExecution();
          if (promise) {
            promises.push(promise);
          }
        }

        // Aguardar todas as execuções (pLimit já controla a concorrência)
        // As execuções subsequentes serão criadas dinamicamente quando slots ficarem disponíveis
        await Promise.allSettled(promises);
      }

      // Parar timer
      if (queue.timerInterval) {
        clearInterval(queue.timerInterval);
      }
      
      // Verificar status final
      if (queue.cancelled || queue.status === 'finalizing') {
        queue.status = 'cancelled';
        logger.warning(`⚠️ Fila cancelada: ${queueId}`);
      } else {
        queue.status = 'completed';
      }
      
      queue.completedAt = new Date().toISOString();
      
      // Calcular tempo final
      if (queue.startedAt) {
        const startTime = new Date(queue.startedAt).getTime();
        const endTime = new Date(queue.completedAt).getTime();
        queue.elapsedTime = Math.floor((endTime - startTime) / 1000);
      }
      
      // Salvar no histórico
      historyManager.addQueueRecord(queue);
      
      this.emit('queue:completed', { queueId, queue: this.serializeQueue(queue) });
      logger.success(`✅ Fila concluída: ${queueId} (${queue.results.success}/${queue.totalUsers} sucessos)`);

    } catch (error) {
      // Parar timer
      if (queue.timerInterval) {
        clearInterval(queue.timerInterval);
      }
      
      queue.status = 'failed';
      queue.error = error.message;
      
      // Calcular tempo final
      if (queue.startedAt) {
        const startTime = new Date(queue.startedAt).getTime();
        const endTime = Date.now();
        queue.elapsedTime = Math.floor((endTime - startTime) / 1000);
      }
      
      // Salvar no histórico mesmo se falhar
      historyManager.addQueueRecord(queue);
      
      this.emit('queue:failed', { queueId, queue: this.serializeQueue(queue), error: error.message });
      logger.error(`❌ Fila falhou: ${queueId}`, error);
    }

    return queue;
  }

  /**
   * Cancela todas as filas ativas
   */
  cancelAllQueues() {
    let cancelledCount = 0;
    
    for (const [queueId, queue] of this.queues.entries()) {
      if (queue.status === 'running' || queue.status === 'pending') {
        this.stopQueue(queueId);
        cancelledCount++;
      }
    }
    
    // Fechar todas as execuções ativas
    for (const [executionId, execution] of this.activeExecutions.entries()) {
      if (execution.status === 'running') {
        execution.status = 'cancelled';
        execution.completedAt = new Date().toISOString();
        this.activeExecutions.delete(executionId);
      }
    }
    
    logger.info(`🛑 ${cancelledCount} fila(s) cancelada(s) e todas as execuções ativas fechadas`);
    return cancelledCount;
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
    queue.status = 'finalizing'; // Mudar status para 'finalizing' ao parar
    
    // Parar timer ao cancelar
    if (queue.timerInterval) {
      clearInterval(queue.timerInterval);
    }
    
    logger.warning(`⚠️ Solicitado cancelamento da fila: ${queueId}`);
    
    this.emit('queue:stop_requested', { queueId, queue: this.serializeQueue(queue) });
    this.emit('queue:updated', { queueId, queue: this.serializeQueue(queue) });
    
    return queue;
  }

  /**
   * Deleta uma fila
   */
  deleteQueue(queueId) {
    const queue = this.queues.get(queueId);
    
    if (!queue) {
      throw new Error(`Fila ${queueId} não encontrada`);
    }

    try {
      // Se a fila estiver rodando, cancelar primeiro
      if (queue.status === 'running') {
        queue.cancelled = true;
        if (queue.timerInterval) {
          clearInterval(queue.timerInterval);
          queue.timerInterval = null;
        }
      }

      // Remover execuções ativas relacionadas a esta fila primeiro
      const executionsToRemove = [];
      for (const [executionId, execution] of this.activeExecutions.entries()) {
        if (execution.queueId === queueId) {
          executionsToRemove.push(executionId);
        }
      }
      executionsToRemove.forEach(id => this.activeExecutions.delete(id));

      // Limpar timer se ainda existir
      if (queue.timerInterval) {
        clearInterval(queue.timerInterval);
      }

      // Remover da lista de filas
      this.queues.delete(queueId);
      
      logger.info(`🗑️ Fila deletada: ${queueId}`);
      
      // Emitir evento após remover completamente
      this.emit('queue:deleted', { queueId });
      
      return true;
    } catch (error) {
      logger.error(`Erro ao deletar fila ${queueId}`, error);
      throw error;
    }
  }

  /**
   * Executa fila com retry infinito (modo buscar créditos a todo custo)
   */
  async executeQueueWithRetry(queueId, limit) {
    const queue = this.queues.get(queueId);
    if (!queue) return;

    let nextUserId = 1; // Contador para userIds únicos
    let initialExecutions = 0; // Contador de execuções iniciais (para aplicar delay apenas no início)
    const activePromises = new Set(); // Set para rastrear promises ativas
    const originalTarget = queue.totalUsers; // Meta original (não aumenta com erros)
    
    // Continuar até atingir a meta original ou ser cancelado
    while (queue.results.success < originalTarget && !queue.cancelled && queue.status !== 'finalizing') {
      // Verificar se já atingiu a meta ANTES de criar novas execuções
      if (queue.results.success >= originalTarget) {
        break;
      }
      
      // Criar promises até atingir o limite de paralelismo OU o número restante
      // IMPORTANTE: Não criar mais promises que o número restante
      const remaining = originalTarget - (queue.results.total || 0);
      const maxToCreate = Math.min(queue.parallelExecutions, remaining);
      
      while (activePromises.size < maxToCreate && 
             queue.results.success < originalTarget && 
             !queue.cancelled && queue.status !== 'finalizing') {
        
        // Verificar novamente antes de criar cada promise
        if (queue.results.success >= originalTarget || queue.cancelled || queue.status === 'finalizing') {
          break;
        }
        
        // Verificar restante novamente antes de criar
        const currentRemaining = originalTarget - (queue.results.total || 0);
        if (currentRemaining <= 0) {
          break;
        }
        
        const userId = nextUserId++;
        const executionIndex = initialExecutions++;
        
        // Adicionar delay escalonado apenas para as primeiras execuções (até o limite de paralelismo)
        // Depois disso, as execuções começam imediatamente quando uma termina
        const delayMs = (executionIndex < queue.parallelExecutions) ? executionIndex * 2000 : 0;
        
        // Criar promise que será gerenciada pelo pLimit
        const promise = limit(async () => {
          // Aguardar delay escalonado antes de iniciar (apenas nas primeiras execuções)
          if (delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
          
          // IMPORTANTE: Verificar meta original ANTES de executar (após o delay)
          if (queue.cancelled || queue.status === 'finalizing' || queue.results.success >= originalTarget) {
            activePromises.delete(promise);
            return { cancelled: true };
          }
          
          try {
            const result = await this.executeUser(queueId, userId);
            
            // Verificar DEPOIS de executar - se meta foi atingida, cancelar imediatamente
            if (queue.results.success >= originalTarget) {
              queue.cancelled = true;
              queue.status = 'finalizing';
              activePromises.delete(promise);
              return { cancelled: true, metaAtingida: true };
            }
            
            return result;
          } catch (error) {
            // Em caso de erro, verificar se já atingiu meta
            if (queue.results.success >= originalTarget) {
              queue.cancelled = true;
              queue.status = 'finalizing';
              activePromises.delete(promise);
              return { cancelled: true, metaAtingida: true };
            }
            throw error;
          } finally {
            activePromises.delete(promise);
          }
        });
        
        activePromises.add(promise);
      }
      
      // Aguardar pelo menos uma promise completar antes de criar novas
      if (activePromises.size > 0) {
        const completedPromise = await Promise.race(Array.from(activePromises));
        
        // Verificar se a meta foi atingida após completar uma execução
        if (queue.results.success >= originalTarget) {
          queue.cancelled = true;
          queue.status = 'finalizing';
          this.emit('queue:target_reached', { queueId, queue: this.serializeQueue(queue) });
          logger.info(`🎯 Meta de créditos atingida! Parando fila ${queueId} imediatamente e iniciando próxima...`);
          break;
        }
        
        // Verificar se foi cancelado
        if (queue.cancelled || queue.status === 'finalizing') {
          break;
        }
      } else {
        // Se não há promises ativas, parar o loop
        break;
      }
    }
    
    // Se a meta foi atingida, não esperar execuções remanescentes - finalizar imediatamente
    if (queue.results.success >= originalTarget) {
      logger.info(`✅ Meta atingida! Finalizando fila ${queueId} sem aguardar execuções remanescentes.`);
      // Cancelar todas as promises ativas restantes
      for (const promise of activePromises) {
        activePromises.delete(promise);
      }
    } else if (activePromises.size > 0) {
      // Se não atingiu a meta mas foi cancelado, aguardar execuções terminarem
      await Promise.allSettled(Array.from(activePromises));
    }
  }

  /**
   * Executa um usuário individual
   * @returns {Promise} Resultado da execução
   */
  async executeUser(queueId, userId) {
    const queue = this.queues.get(queueId);
    if (!queue) {
      throw new Error(`Fila ${queueId} não encontrada`);
    }
    
    const executionId = `exec-${this.nextExecutionId++}`;
    
    logger.info(`▶️  Executando usuário ${userId} (${executionId}) com link: ${queue.referralLink}`);

    try {
      // Domínios e proxies temporariamente desativados - sempre usar null
      let domain = null;
      let proxyString = null;
      logger.info(`📧 Usuário ${userId} usará IP local (domínios e proxies desativados temporariamente)`);

      // Criar execution com informações completas
      const execution = {
        id: executionId,
        queueId,
        userId,
        status: 'running',
        startedAt: new Date().toISOString(),
        completedAt: null,
        result: null,
        error: null,
        domain: domain || null // Armazenar domínio usado
      };

      this.activeExecutions.set(executionId, execution);
      this.emit('execution:started', { executionId, execution: this.serializeExecution(execution) });

      const executionStartTime = Date.now();
      
      // Executar fluxo do usuário passando o link de indicação, domínio, proxy, erros simulados, modo turbo, verificação de banner, requisições simultâneas e modo Outlook
      const useOutlookValue = queue.useOutlook === true || queue.useOutlook === 'true' || (queue.useOutlook !== false && queue.useOutlook !== 'false' && queue.useOutlook !== undefined);
      logger.info(`📬 Executando usuário ${userId} com modo Outlook: ${useOutlookValue} (valor na fila: ${queue.useOutlook})`);
      const result = await executeUserFlow(userId, queue.referralLink, domain, proxyString, queue.simulatedErrors || [], queue.turboMode || false, queue.checkCreditsBanner || false, queue.enableConcurrentRequests || false, queue.concurrentRequests || 100, useOutlookValue);
      
      const executionTime = Math.floor((Date.now() - executionStartTime) / 1000); // em segundos

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
      
      // Registrar tempo de execução (para calcular média)
      queue.executionTimes.push(executionTime);
      // Manter apenas os últimos 100 tempos para cálculo
      if (queue.executionTimes.length > 100) {
        queue.executionTimes.shift();
      }
      
      // Calcular timestamp relativo ao início da fila
      const getRelativeTimestamp = () => {
        if (!queue.startedAt) return 0;
        const startTime = new Date(queue.startedAt).getTime();
        const now = Date.now();
        return Math.floor((now - startTime) / 1000); // em segundos
      };

      if (result.success) {
        queue.results.success++;
        queue.results.credits += result.creditsEarned || 0;
        
        // Registrar uso do link de indicação APENAS quando houver sucesso
        referralLinkTracker.recordUsage(queue.referralLink, queueId, 1);
        
        // Verificar se meta foi atingida (modo forceCredits) - parar imediatamente
        if (queue.forceCredits && queue.results.success >= queue.totalUsers) {
          queue.cancelled = true;
          queue.status = 'finalizing';
          this.emit('queue:target_reached', { queueId, queue: this.serializeQueue(queue) });
          logger.info(`🎯 Meta de créditos atingida após sucesso do usuário ${userId}! Finalizando fila ${queueId} e iniciando próxima...`);
        }
        
        // Verificar se meta foi atingida (modo normal) - parar e iniciar próxima
        if (!queue.forceCredits && queue.results.success >= queue.totalUsers) {
          queue.cancelled = true;
          queue.status = 'finalizing';
          this.emit('queue:target_reached', { queueId, queue: this.serializeQueue(queue) });
          logger.info(`🎯 Meta de inscrições atingida (${queue.results.success}/${queue.totalUsers})! Parando fila ${queueId} e iniciando próxima...`);
        }
        
        // Adicionar sucesso na timeline
        queue.timeline.successes.push({
          timestamp: getRelativeTimestamp(),
          userId: userId
        });
        
        // Verificar se houve erro de email
        const hasEmailError = result.failedStep && (
          result.failedStep.toLowerCase().includes('email') ||
          result.failedStep.toLowerCase().includes('verificação') ||
          result.failedStep.toLowerCase().includes('verification')
        ) || (result.error && (
          result.error.toLowerCase().includes('email') ||
          result.error.toLowerCase().includes('domínio não elegível') ||
          result.error.toLowerCase().includes('domain')
        ));
        
        // Salvar conta em CSV apenas se não houver erro de email
        if (!hasEmailError && result.credentials?.email && result.credentials?.password) {
          csvService.appendAccount(
            result.credentials.email,
            result.credentials.password,
            execution.completedAt || new Date().toISOString(),
            queueId,
            userId
          );
        }
        
        // Registrar sucesso no histórico
        historyManager.addSuccess({
          email: result.credentials?.email || result.email || 'N/A',
          userId: userId,
          queueId: queueId,
          domain: domain || null, // Incluir domínio usado
          creditsEarned: result.creditsEarned || 0,
          referralLink: queue.referralLink
        });
      } else {
        queue.results.failed++;
        execution.error = result.error;
        
        // Se estiver no modo "buscar créditos a todo custo" e ainda não atingiu a meta original,
        // aumentar a meta dinamicamente para compensar o erro
        // IMPORTANTE: Só aumentar se ainda não atingiu a meta original (totalUsers)
        if (queue.forceCredits && queue.results.success < queue.totalUsers) {
          queue.results.target++;
          logger.info(`💰 Meta aumentada para ${queue.results.target} (erro no usuário ${userId}, ainda precisa de ${queue.totalUsers - queue.results.success} sucessos)`);
        }
        
        // Adicionar erro na timeline
        queue.timeline.errors.push({
          timestamp: getRelativeTimestamp(),
          error: result.error || 'Erro desconhecido',
          userId: userId,
          failedStep: result.failedStep || 'Desconhecida'
        });
        
        // Registrar falha no histórico
        historyManager.addFailure({
          email: result.credentials?.email || result.email || 'N/A',
          error: result.error || 'Erro desconhecido',
          failedStep: result.failedStep || 'Desconhecida',
          userId: userId,
          queueId: queueId,
          domain: domain || null, // Incluir domínio usado
          referralLink: queue.referralLink
        });
      }

      // Salvar histórico de execução em CSV (sucesso ou falha)
      csvService.appendExecutionHistory({
        timestamp: execution.completedAt || new Date().toISOString(),
        queueId: queueId,
        userId: userId,
        status: result.success ? 'success' : 'failed',
        email: result.credentials?.email || result.email || '',
        creditsEarned: result.creditsEarned || 0,
        error: result.error || '',
        failedStep: result.failedStep || '',
        domain: domain || '',
        referralLink: queue.referralLink || ''
      });

      this.emit('execution:completed', { executionId, execution: this.serializeExecution(execution) });
      this.emit('queue:updated', { queueId, queue: this.serializeQueue(queue) });
      
      logger.success(`✅ Usuário ${userId} concluído (${executionId})`);

    } catch (error) {
      execution.status = 'failed';
      execution.completedAt = new Date().toISOString();
      execution.error = error.message;

      queue.results.total++;
      queue.results.failed++;
      
      // Calcular tempo de execução mesmo em caso de erro
      const executionStartTime = execution.startedAt ? new Date(execution.startedAt).getTime() : Date.now();
      const executionTime = Math.floor((Date.now() - executionStartTime) / 1000);
      queue.executionTimes.push(executionTime);
      if (queue.executionTimes.length > 100) {
        queue.executionTimes.shift();
      }

      // Calcular timestamp relativo ao início da fila
      const getRelativeTimestamp = () => {
        if (!queue.startedAt) return 0;
        const startTime = new Date(queue.startedAt).getTime();
        const now = Date.now();
        return Math.floor((now - startTime) / 1000); // em segundos
      };
      
      // Se estiver no modo "buscar créditos a todo custo" e ainda não atingiu a meta original,
      // aumentar a meta dinamicamente para compensar o erro
      // IMPORTANTE: Só aumentar se ainda não atingiu a meta original (totalUsers)
      if (queue.forceCredits && queue.results.success < queue.totalUsers) {
        queue.results.target++;
        logger.info(`💰 Meta aumentada para ${queue.results.target} (erro exceção no usuário ${userId}, ainda precisa de ${queue.totalUsers - queue.results.success} sucessos)`);
      }

      // Registrar falha no histórico
      const email = execution.credentials?.email || 'N/A';
      // Determinar domínio usado (pode estar no execution ou na queue)
      const domain = execution.domain || (queue.selectedDomains && queue.selectedDomains.length > 0 ? queue.selectedDomains[0] : null);
      
      // Determinar etapa que falhou baseado na mensagem de erro
      let failedStep = 'Erro na execução';
      if (error.message.includes('Banner de crédito não encontrado na etapa final') || error.message.includes('banner de credito nao encontrado na etapa final')) {
        failedStep = 'Banner de Créditos no Editor';
      } else if (error.message.includes('Banner/popup') || error.message.includes('créditos')) {
        failedStep = 'Verificação de Créditos';
      } else if (error.message.includes('Domínio não elegível') || error.message.includes('not eligible')) {
        failedStep = 'Cadastro - Domínio não elegível';
      } else if (error.message.includes('email') || error.message.includes('verificação')) {
        failedStep = 'Verificação de Email';
      }
      
      // Salvar histórico de execução em CSV (erro fatal)
      csvService.appendExecutionHistory({
        timestamp: execution.completedAt,
        queueId: queueId,
        userId: userId,
        status: 'failed',
        email: email,
        creditsEarned: 0,
        error: error.message,
        failedStep: failedStep,
        domain: domain || '',
        referralLink: queue.referralLink || ''
      });
      
      // Adicionar erro na timeline
      queue.timeline.errors.push({
        timestamp: getRelativeTimestamp(),
        error: error.message,
        userId: userId,
        failedStep: failedStep
      });
      
      historyManager.addFailure({
        email: email,
        error: error.message,
        failedStep: failedStep,
        userId: userId,
        queueId: queueId,
        domain: domain || null, // Incluir domínio usado
        referralLink: queue.referralLink
      });

      this.emit('execution:failed', { executionId, execution: this.serializeExecution(execution), error: error.message });
      this.emit('queue:updated', { queueId, queue: this.serializeQueue(queue) });
      
      logger.error(`❌ Usuário ${userId} falhou (${executionId})`, error);
    } finally {
      // Remover execução ativa após 1 minuto
      setTimeout(() => {
        this.activeExecutions.delete(executionId);
      }, 60000);
    }
  }

  /**
   * Obtém informações de uma fila (versão serializável para WebSocket)
   */
  getQueue(queueId) {
    const queue = this.queues.get(queueId);
    if (!queue) return null;
    return this.serializeQueue(queue);
  }

  /**
   * Serializa o objeto queue removendo propriedades não serializáveis
   */
  serializeQueue(queue) {
    if (!queue) return null;
    
    return {
      id: queue.id,
      name: queue.name,
      referralLink: queue.referralLink,
      selectedDomains: queue.selectedDomains || [],
      selectedProxies: queue.selectedProxies || [],
      simulatedErrors: queue.simulatedErrors || [],
      totalUsers: queue.totalUsers,
      parallelExecutions: queue.parallelExecutions,
      status: queue.status,
      createdAt: queue.createdAt,
      startedAt: queue.startedAt,
      completedAt: queue.completedAt,
      elapsedTime: queue.elapsedTime || 0,
      forceCredits: queue.forceCredits || false,
      enableConcurrentRequests: queue.enableConcurrentRequests || false,
      concurrentRequests: queue.concurrentRequests || 100,
      executionTimes: Array.isArray(queue.executionTimes) ? queue.executionTimes : [],
      results: queue.results ? { ...queue.results } : {
        total: 0,
        success: 0,
        failed: 0,
        target: queue.totalUsers || 0,
        credits: 0
      },
      timeline: queue.timeline ? {
        errors: Array.isArray(queue.timeline.errors) ? queue.timeline.errors.map(err => ({
          timestamp: err.timestamp || 0,
          error: String(err.error || ''),
          userId: err.userId || 0,
          failedStep: String(err.failedStep || '')
        })) : [],
        successes: Array.isArray(queue.timeline.successes) ? queue.timeline.successes.map(suc => ({
          timestamp: suc.timestamp || 0,
          userId: suc.userId || 0
        })) : []
      } : {
        errors: [],
        successes: []
      },
      error: queue.error || null
    };
  }

  /**
   * Serializa o objeto execution removendo propriedades não serializáveis
   */
  serializeExecution(execution) {
    if (!execution) return null;
    
    return {
      id: execution.id,
      queueId: execution.queueId,
      userId: execution.userId,
      status: execution.status,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      result: execution.result ? {
        success: execution.result.success || false,
        error: execution.result.error ? String(execution.result.error) : null,
        failedStep: execution.result.failedStep ? String(execution.result.failedStep) : null,
        creditsEarned: execution.result.creditsEarned || 0,
        email: execution.result.email ? String(execution.result.email) : null
      } : null,
      error: execution.error ? String(execution.error) : null,
      credentials: execution.credentials ? {
        email: String(execution.credentials.email || ''),
        password: String(execution.credentials.password || '')
      } : null,
      domain: execution.domain ? String(execution.domain) : null
    };
  }

  /**
   * Lista todas as filas (versão serializável)
   */
  listQueues() {
    return Array.from(this.queues.values()).map(queue => this.serializeQueue(queue));
  }

  /**
   * Lista execuções ativas (versão serializável)
   */
  listActiveExecutions() {
    return Array.from(this.activeExecutions.values()).map(exec => this.serializeExecution(exec));
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

