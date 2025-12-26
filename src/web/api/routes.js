import express from 'express';
import { queueManager } from '../queue/QueueManager.js';
import { domainManager } from '../queue/DomainManager.js';
import { historyManager } from '../queue/HistoryManager.js';
import { logger } from '../../utils/logger.js';

const router = express.Router();

/**
 * GET /api/stats - Estatísticas gerais
 */
router.get('/stats', (req, res) => {
  try {
    const stats = queueManager.getStats();
    const domains = domainManager.listDomains();
    
    res.json({
      success: true,
      stats,
      domains
    });
  } catch (error) {
    logger.error('Erro ao obter estatísticas', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/history - Obter histórico de execuções
 */
router.get('/history', (req, res) => {
  try {
    const history = historyManager.getHistory();
    res.json({
      success: true,
      history
    });
  } catch (error) {
    logger.error('Erro ao obter histórico', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/failures - Obter falhas recentes
 */
router.get('/failures', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const failures = historyManager.getRecentFailures(limit);
    res.json({
      success: true,
      failures
    });
  } catch (error) {
    logger.error('Erro ao obter falhas', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/history - Limpar histórico
 */
router.delete('/history', (req, res) => {
  try {
    historyManager.clearHistory();
    res.json({
      success: true,
      message: 'Histórico limpo com sucesso'
    });
  } catch (error) {
    logger.error('Erro ao limpar histórico', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/queues - Listar todas as filas
 */
router.get('/queues', (req, res) => {
  try {
    const queues = queueManager.listQueues();
    
    res.json({
      success: true,
      queues
    });
  } catch (error) {
    logger.error('Erro ao listar filas', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/queues/:id - Obter fila específica
 */
router.get('/queues/:id', (req, res) => {
  try {
    const queue = queueManager.getQueue(req.params.id);
    
    if (!queue) {
      return res.status(404).json({
        success: false,
        error: 'Fila não encontrada'
      });
    }
    
    res.json({
      success: true,
      queue
    });
  } catch (error) {
    logger.error('Erro ao obter fila', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/queues - Criar nova fila
 */
router.post('/queues', (req, res) => {
  try {
    const { name, users, parallel, referralLink, selectedDomains } = req.body; // Capturar selectedDomains
    
    // Validar link de indicação
    if (!referralLink) {
      return res.status(400).json({
        success: false,
        error: 'Link de indicação é obrigatório'
      });
    }
    
    // Validar e parsear entrada
    const usersNum = parseInt(users);
    if (!users || isNaN(usersNum) || usersNum < 1) {
      return res.status(400).json({
        success: false,
        error: 'Número de usuários inválido'
      });
    }
    
    const parallelNum = parseInt(parallel) || 1;
    if (isNaN(parallelNum) || parallelNum < 1 || parallelNum > 5) {
      return res.status(400).json({
        success: false,
        error: 'Número de execuções paralelas deve estar entre 1 e 5'
      });
    }
    
    const config = {
      name: name || `Fila ${Date.now()}`,
      users: usersNum,
      parallel: parallelNum,
      referralLink: referralLink.trim(),
      selectedDomains: selectedDomains || [] // Passar selectedDomains
    };
    
    const queue = queueManager.createQueue(config); // Agora retorna o objeto completo
    
    res.json({
      success: true,
      queueId: queue.id,
      queue
    });
  } catch (error) {
    logger.error('Erro ao criar fila', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/queues/:id/start - Iniciar execução de fila
 */
router.post('/queues/:id/start', async (req, res) => {
  try {
    const queueId = req.params.id;
    
    // Iniciar fila de forma assíncrona (não bloquear resposta)
    queueManager.startQueue(queueId).catch(error => {
      logger.error(`Erro ao executar fila ${queueId}`, error);
    });
    
    res.json({
      success: true,
      message: `Fila ${queueId} iniciada`,
      queueId
    });
  } catch (error) {
    logger.error('Erro ao iniciar fila', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/queues/:id/stop - Parar execução de fila
 */
router.post('/queues/:id/stop', (req, res) => {
  try {
    const queueId = req.params.id;
    queueManager.stopQueue(queueId);
    
    res.json({
      success: true,
      message: `Fila ${queueId} será parada`
    });
  } catch (error) {
    logger.error('Erro ao parar fila', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/executions - Listar execuções ativas
 */
router.get('/executions', (req, res) => {
  try {
    const executions = queueManager.listActiveExecutions();
    
    res.json({
      success: true,
      executions
    });
  } catch (error) {
    logger.error('Erro ao listar execuções', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/domains - Listar domínios
 */
router.get('/domains', (req, res) => {
  try {
    const domains = domainManager.listDomains();
    
    res.json({
      success: true,
      ...domains
    });
  } catch (error) {
    logger.error('Erro ao listar domínios', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/domains - Adicionar domínio
 */
router.post('/domains', (req, res) => {
  try {
    const { domain } = req.body;
    
    if (!domain) {
      return res.status(400).json({
        success: false,
        error: 'Domínio não fornecido'
      });
    }
    
    const result = domainManager.addDomain(domain);
    
    res.json(result);
  } catch (error) {
    logger.error('Erro ao adicionar domínio', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/domains/:domain - Remover domínio
 */
router.delete('/domains/:domain', (req, res) => {
  try {
    const domain = decodeURIComponent(req.params.domain);
    const result = domainManager.removeDomain(domain);
    
    res.json(result);
  } catch (error) {
    logger.error('Erro ao remover domínio', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/domains - Atualizar lista de domínios
 */
router.put('/domains', (req, res) => {
  try {
    const { domains } = req.body;
    
    if (!Array.isArray(domains)) {
      return res.status(400).json({
        success: false,
        error: 'Lista de domínios inválida'
      });
    }
    
    const result = domainManager.updateDomains(domains);
    
    res.json(result);
  } catch (error) {
    logger.error('Erro ao atualizar domínios', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/domains/reset - Resetar índice de alternância
 */
router.post('/domains/reset', (req, res) => {
  try {
    const result = domainManager.resetIndex();
    
    res.json(result);
  } catch (error) {
    logger.error('Erro ao resetar índice', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;

