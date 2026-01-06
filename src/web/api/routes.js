import express from 'express';
import { queueManager } from '../queue/QueueManager.js';
import { domainManager } from '../queue/DomainManager.js';
import { historyManager } from '../queue/HistoryManager.js';
import { proxyService } from '../../services/proxyService.js';
import { outlookCredentialsService } from '../../services/outlookCredentialsService.js';
import { parseCredentialsInput } from '../../utils/outlookCredentialsParser.js';
import { normalizeReferralLink } from '../../utils/referralLink.js';
import { referralLinkTracker } from '../../services/referralLinkTracker.js';
import { logger } from '../../utils/logger.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
 * GET /api/metrics - Obter métricas de falhas
 */
router.get('/metrics', (req, res) => {
  try {
    const metrics = historyManager.getFailureMetrics();
    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    logger.error('Erro ao obter métricas', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/failures - Limpar falhas
 */
router.delete('/failures', (req, res) => {
  try {
    historyManager.clearFailures();
    res.json({
      success: true,
      message: 'Falhas limpas com sucesso'
    });
  } catch (error) {
    logger.error('Erro ao limpar falhas', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/metrics - Limpar todas as métricas (falhas e sucessos)
 */
router.delete('/metrics', (req, res) => {
  try {
    historyManager.clearAllMetrics();
    res.json({
      success: true,
      message: 'Todas as métricas foram limpas com sucesso'
    });
  } catch (error) {
    logger.error('Erro ao limpar métricas', error);
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
    const { name, users, parallel, referralLink, selectedDomains, selectedProxies, simulatedErrors, forceCredits, turboMode, checkCreditsBanner, enableConcurrentRequests, concurrentRequests, useOutlook, confirmExceedLimit } = req.body; // Capturar todas as opções
    
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
    if (isNaN(parallelNum) || parallelNum < 1 || parallelNum > 10) {
      return res.status(400).json({
        success: false,
        error: 'Número de execuções paralelas deve estar entre 1 e 10'
      });
    }
    
    // Validar requisições simultâneas se ativado
    const enableConcurrentRequestsBool = enableConcurrentRequests === true || enableConcurrentRequests === 'true';
    let concurrentRequestsNum = 100; // Valor padrão
    if (enableConcurrentRequestsBool) {
      concurrentRequestsNum = parseInt(concurrentRequests) || 100;
      if (isNaN(concurrentRequestsNum) || concurrentRequestsNum < 1 || concurrentRequestsNum > 1000) {
        return res.status(400).json({
          success: false,
          error: 'Número de requisições simultâneas deve estar entre 1 e 1000'
        });
      }
    }
    
    // Normalizar link de indicação para formato padrão
    let normalizedLink;
    try {
      normalizedLink = normalizeReferralLink(referralLink.trim());
      logger.info(`🔗 Link normalizado: ${referralLink.trim()} → ${normalizedLink}`);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: `Erro ao normalizar link de indicação: ${error.message}`
      });
    }
    
    // Verificar uso do link de indicação
    const linkInfo = referralLinkTracker.getLinkInfo(normalizedLink);
    const usageCount = linkInfo.usageCount || 0;
    
    logger.info(`📊 Link de indicação já foi usado ${usageCount} vez(es)`);
    
    // Retornar informações sobre o uso do link (o frontend vai decidir se quer continuar)
    if (usageCount >= 10 && !confirmExceedLimit) {
      return res.json({
        success: false,
        warning: true,
        message: `⚠️ ATENÇÃO: Este link de indicação já foi usado ${usageCount} vezes. O limite recomendado é de no máximo 10 usos.`,
        usageCount: usageCount,
        linkInfo: linkInfo,
        canProceed: false // Frontend precisa confirmar
      });
    }
    
    // Se confirmou que quer continuar mesmo excedendo o limite, logar aviso
    if (usageCount >= 10 && confirmExceedLimit) {
      logger.warning(`⚠️ Link de indicação usado ${usageCount} vezes - usuário confirmou que quer continuar mesmo assim`);
    }
    
    // Normalizar useOutlook: se for true, 'true', ou undefined/null (padrão), usar true
    const useOutlookBool = useOutlook === true || useOutlook === 'true' || (useOutlook !== false && useOutlook !== 'false' && useOutlook !== undefined);
    logger.info(`📬 Modo Outlook solicitado: ${useOutlook} → ${useOutlookBool}`);
    
    const config = {
      name: name || `Fila ${Date.now()}`,
      users: usersNum,
      parallel: parallelNum,
      referralLink: normalizedLink, // Usar link normalizado
      selectedDomains: selectedDomains || [], // Passar selectedDomains
      selectedProxies: selectedProxies || [], // Passar selectedProxies
      simulatedErrors: simulatedErrors || [], // Passar erros simulados
      forceCredits: forceCredits === true || forceCredits === 'true', // Passar forceCredits (buscar créditos a todo custo)
      turboMode: turboMode === true || turboMode === 'true', // Passar turboMode (modo turbo)
      checkCreditsBanner: (checkCreditsBanner === true || checkCreditsBanner === 'true') && (turboMode === true || turboMode === 'true'), // Só ativo se turboMode estiver ativo
      enableConcurrentRequests: enableConcurrentRequestsBool, // Ativar teste de requisições simultâneas
      concurrentRequests: concurrentRequestsNum, // Número de requisições simultâneas
      useOutlook: useOutlookBool // Usar modo Outlook
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
 * DELETE /api/queues/:id - Deletar uma fila
 */
router.delete('/queues/:id', (req, res) => {
  try {
    const queueId = req.params.id;
    
    if (!queueId) {
      return res.status(400).json({
        success: false,
        error: 'ID da fila é obrigatório'
      });
    }
    
    queueManager.deleteQueue(queueId);
    
    res.json({
      success: true,
      message: `Fila ${queueId} deletada`
    });
  } catch (error) {
    logger.error('Erro ao deletar fila', error);
    const statusCode = error.message.includes('não encontrada') ? 404 : 400;
    res.status(statusCode).json({
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

/**
 * GET /api/proxies - Listar proxies disponíveis
 */
router.get('/proxies', async (req, res) => {
  try {
    // Garantir que proxies estão inicializados
    await proxyService.initialize();
    
    const webshareProxies = proxyService.getWebshareProxies();
    
    // Formatar proxies para exibição (ocultar senha)
    const formattedProxies = webshareProxies.map((proxy, index) => {
      try {
        const url = new URL(proxy);
        return {
          id: index + 1, // Começar do 1 para deixar 0 para "random"
          value: proxy, // Valor completo para uso
          display: `${url.hostname}:${url.port}`, // Exibição sem senha
          full: proxy
        };
      } catch (e) {
        return {
          id: index + 1,
          value: proxy,
          display: proxy.split('@')[1] || proxy,
          full: proxy
        };
      }
    });
    
    // Adicionar opção "random" como primeiro item
    const randomOption = {
      id: 'random',
      value: 'random',
      display: '🎲 Random (todos os proxies aleatórios)',
      full: 'random'
    };
    
    res.json({
      success: true,
      proxies: [randomOption, ...formattedProxies], // "random" primeiro
      total: formattedProxies.length + 1
    });
  } catch (error) {
    logger.error('Erro ao listar proxies', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/server/restart - Reinicia o servidor (para tudo e limpa estado)
 */
router.post('/server/restart', async (req, res) => {
  try {
    logger.info('🔄 Reiniciando servidor...');
    
    // Cancelar todas as filas
    const cancelledCount = queueManager.cancelAllQueues();
    
    // Limpar execuções ativas
    const activeExecutions = queueManager.listActiveExecutions();
    logger.info(`🧹 Fechando ${activeExecutions.length} execuções ativas...`);
    
    // Responder antes de encerrar
    res.json({
      success: true,
      message: `Servidor reiniciando. ${cancelledCount} fila(s) cancelada(s).`,
      cancelledQueues: cancelledCount
    });
    
    // Aguardar um pouco para garantir que a resposta foi enviada
    setTimeout(() => {
      logger.info('🔄 Encerrando processo...');
      process.exit(0);
    }, 1000);
    
  } catch (error) {
    logger.error('Erro ao reiniciar servidor', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/csv/accounts - Download do CSV de contas criadas
 */
router.get('/csv/accounts', (req, res) => {
  try {
    const csvPath = path.join(__dirname, '../../../data/accounts.csv');
    
    let fileContent;
    if (!fs.existsSync(csvPath)) {
      // Se arquivo não existe, retornar CSV vazio com cabeçalhos
      fileContent = 'email,password,timestamp,queueId,userId\n';
      logger.info('📥 CSV de contas vazio (arquivo não existe ainda)');
    } else {
      fileContent = fs.readFileSync(csvPath, 'utf8');
      logger.info('📥 CSV de contas baixado');
    }
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="accounts-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(fileContent);
  } catch (error) {
    logger.error('Erro ao baixar CSV de contas', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/csv/executions - Download do CSV de histórico de execuções
 */
router.get('/csv/executions', (req, res) => {
  try {
    const csvPath = path.join(__dirname, '../../../data/execution_history.csv');
    
    let fileContent;
    if (!fs.existsSync(csvPath)) {
      // Se arquivo não existe, retornar CSV vazio com cabeçalhos
      fileContent = 'timestamp,queueId,userId,status,email,creditsEarned,error,failedStep,domain,referralLink\n';
      logger.info('📥 CSV de execuções vazio (arquivo não existe ainda)');
    } else {
      fileContent = fs.readFileSync(csvPath, 'utf8');
      logger.info('📥 CSV de histórico de execuções baixado');
    }
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="execution_history-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(fileContent);
  } catch (error) {
    logger.error('Erro ao baixar CSV de execuções', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/outlook-credentials - Listar credenciais Outlook
 */
router.get('/outlook-credentials', (req, res) => {
  try {
    const credentials = outlookCredentialsService.loadCredentials();
    const stats = outlookCredentialsService.getStats();
    
    res.json({
      success: true,
      credentials,
      stats
    });
  } catch (error) {
    logger.error('Erro ao listar credenciais Outlook', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/outlook-credentials - Adicionar credenciais Outlook
 */
router.post('/outlook-credentials', (req, res) => {
  try {
    const { email, password, input } = req.body;
    
    // Se forneceu input (texto para parsear)
    if (input) {
      const parseResult = parseCredentialsInput(input);
      
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: parseResult.error || 'Erro ao parsear credenciais'
        });
      }
      
      const addResult = outlookCredentialsService.addCredentials(parseResult.credentials);
      
      return res.json({
        success: addResult.success,
        added: addResult.added,
        duplicates: addResult.duplicates,
        duplicatesList: addResult.duplicatesList,
        message: `${addResult.added} credenciais adicionadas${addResult.duplicates > 0 ? `, ${addResult.duplicates} duplicadas ignoradas` : ''}`
      });
    }
    
    // Se forneceu email e senha individual
    if (email && password) {
      const result = outlookCredentialsService.addCredential(email, password);
      
      if (!result.success) {
        return res.status(400).json(result);
      }
      
      return res.json({
        success: true,
        credential: result.credential,
        message: 'Credencial adicionada com sucesso'
      });
    }
    
    return res.status(400).json({
      success: false,
      error: 'Forneça email e senha, ou input para parsear'
    });
  } catch (error) {
    logger.error('Erro ao adicionar credenciais Outlook', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/outlook-credentials/:email/toggle-used - Alterna status "used" de uma credencial
 * IMPORTANTE: Esta rota deve vir ANTES da rota DELETE para evitar conflito
 */
router.post('/outlook-credentials/:email/toggle-used', (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    const result = outlookCredentialsService.toggleUsedStatus(email);
    
    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.error || 'Credencial não encontrada'
      });
    }
    
    res.json({
      success: true,
      used: result.used,
      message: `Credencial ${result.used ? 'marcada como usada' : 'marcada como disponível'}`
    });
  } catch (error) {
    logger.error('Erro ao alternar status de credencial', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/outlook-credentials/:email - Remover credencial Outlook
 */
router.delete('/outlook-credentials/:email', (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    const result = outlookCredentialsService.removeCredential(email);
    
    if (!result.success) {
      return res.status(404).json(result);
    }
    
    res.json({
      success: true,
      message: 'Credencial removida com sucesso'
    });
  } catch (error) {
    logger.error('Erro ao remover credencial Outlook', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/outlook-credentials - Remover múltiplas credenciais
 */
router.delete('/outlook-credentials', (req, res) => {
  try {
    const { emails, clearAll } = req.body;
    
    if (clearAll === true) {
      const result = outlookCredentialsService.clearAll();
      return res.json({
        success: result.success,
        message: 'Todas as credenciais foram removidas'
      });
    }
    
    if (!emails || !Array.isArray(emails)) {
      return res.status(400).json({
        success: false,
        error: 'Forneça array de emails ou clearAll: true'
      });
    }
    
    const result = outlookCredentialsService.removeCredentials(emails);
    
    res.json({
      success: result.success,
      removed: result.removed,
      message: `${result.removed} credenciais removidas`
    });
  } catch (error) {
    logger.error('Erro ao remover credenciais Outlook', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/outlook-credentials/stats - Obter estatísticas
 */
router.get('/outlook-credentials/stats', (req, res) => {
  try {
    const stats = outlookCredentialsService.getStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Erro ao obter estatísticas de credenciais Outlook', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/outlook-credentials/reset-used - Resetar status "used" de todas as credenciais
 */
router.post('/outlook-credentials/reset-used', (req, res) => {
  try {
    const result = outlookCredentialsService.resetUsedStatus();
    
    res.json({
      success: true,
      message: `${result.reset} credenciais resetadas`,
      reset: result.reset
    });
  } catch (error) {
    logger.error('Erro ao resetar credenciais', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/referral-links - Obter informações sobre links de indicação
 */
router.get('/referral-links', (req, res) => {
  try {
    const links = referralLinkTracker.getAllLinks();
    res.json({
      success: true,
      links: links
    });
  } catch (error) {
    logger.error('Erro ao obter links de indicação', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/referral-links/:link - Obter informações sobre um link específico
 */
router.get('/referral-links/:link', (req, res) => {
  try {
    const link = decodeURIComponent(req.params.link);
    const linkInfo = referralLinkTracker.getLinkInfo(link);
    res.json({
      success: true,
      linkInfo: linkInfo
    });
  } catch (error) {
    logger.error('Erro ao obter informações do link', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/referral-links - Limpar todos os dados de rastreamento
 */
router.delete('/referral-links', (req, res) => {
  try {
    const result = referralLinkTracker.clearAll();
    res.json({
      success: result.success,
      message: 'Dados de rastreamento limpos'
    });
  } catch (error) {
    logger.error('Erro ao limpar dados de rastreamento', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;

