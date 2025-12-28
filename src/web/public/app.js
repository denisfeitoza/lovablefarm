/**
 * Lovable Referral Tester - Dashboard Frontend
 */

class App {
  constructor() {
    this.socket = null;
    this.queues = [];
    this.domains = {};
    this.proxies = [];
    this.stats = {};
    this.activeTimers = new Map(); // { executionId: interval }
    this.history = [];
    this.failures = [];
    this.metrics = null;
    this.basePath = window.BASE_PATH || '';
    this.timelineZoom = new Map(); // { queueId: zoomLevel }
    this.timelineScroll = new Map(); // { queueId: scrollPosition }
    this.timeEstimateInterval = null; // Timer para atualizar tempo restante
    this.timeEstimates = new Map(); // { queueId: { seconds: number, lastUpdate: timestamp } }
    this.init();
  }

  // Helper para construir URLs com BASE_PATH
  apiUrl(path) {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.basePath}${cleanPath}`;
  }

  init() {
    console.log('🚀 Inicializando Dashboard...');
    this.startTimeEstimateTimer(); // Iniciar timer de estimativa regressiva
    console.log('📍 BASE_PATH:', this.basePath || '(raiz)');
    console.log('📍 window.BASE_PATH:', window.BASE_PATH || '(não definido)');
    // Garantir que basePath está definido corretamente
    if (!this.basePath && window.BASE_PATH) {
      this.basePath = window.BASE_PATH;
      console.log('✅ BASE_PATH atualizado do window:', this.basePath);
    }
    this.connectWebSocket();
    this.fetchDomains(); // Buscar domínios logo no início
    this.fetchProxies(); // Buscar proxies logo no início
    this.fetchHistory();
    this.fetchFailures(); // Buscar falhas recentes
    this.fetchMetrics(); // Buscar métricas iniciais
    // Iniciar loop de atualização dos timers
    setInterval(() => {
      this.updateTimers();
      // Atualizar timers das filas rodando
      if (this.queues) {
        this.queues.forEach(queue => {
          if (queue.status === 'running' && queue.startedAt) {
            const startTime = new Date(queue.startedAt).getTime();
            const now = Date.now();
            queue.elapsedTime = Math.floor((now - startTime) / 1000);
          }
        });
        this.renderQueues();
      }
    }, 1000);
    // Métricas, histórico e falhas agora são atualizados automaticamente via WebSocket
  }

  // Fetch inicial de domínios
  async fetchDomains() {
    try {
      const response = await fetch(this.apiUrl('/api/domains'));
      const data = await response.json();
      if (data.success) {
        this.domains = data;
        this.renderDomains();
        console.log('✅ Domínios carregados:', this.domains);
      }
    } catch (error) {
      console.error('Erro ao buscar domínios:', error);
    }
  }

  // Fetch inicial de proxies
  async fetchProxies() {
    try {
      const response = await fetch(this.apiUrl('/api/proxies'));
      const data = await response.json();
      if (data.success) {
        this.proxies = data.proxies || [];
        this.renderQueueProxySelection();
        console.log('✅ Proxies carregados:', this.proxies.length);
      }
    } catch (error) {
      console.error('Erro ao buscar proxies:', error);
    }
  }

  // WebSocket Connection
  connectWebSocket() {
    // Socket.IO path deve começar com / e terminar com /socket.io/
    let socketPath = '/socket.io/';
    if (this.basePath) {
      // Garantir que basePath comece com / e não termine com /
      const cleanPath = this.basePath.startsWith('/') ? this.basePath : `/${this.basePath}`;
      socketPath = `${cleanPath}/socket.io/`;
    }
    
    console.log('🔌 Conectando Socket.IO com path:', socketPath, '| BASE_PATH:', this.basePath);
    
    this.socket = io({
      path: socketPath
    });

    this.socket.on('connect', () => {
      console.log('✅ WebSocket conectado');
      this.updateConnectionStatus('connected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Erro ao conectar WebSocket:', error);
      console.error('Path usado:', socketPath);
      this.updateConnectionStatus('error');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket desconectado:', reason);
      this.updateConnectionStatus('disconnected');
    });

    // Stats updates
    this.socket.on('stats:update', (stats) => {
      this.stats = stats;
      this.updateStats();
    });

    // Queues updates
    this.socket.on('queues:update', (queues) => {
      this.queues = queues;
      this.renderQueues();
    });

    // Domains updates
    this.socket.on('domains:update', (domains) => {
      this.domains = domains;
      this.renderDomains();
    });

    // Executions updates
    this.socket.on('executions:update', (executions) => {
      this.renderExecutions(executions);
    });

    // Metrics updates
    this.socket.on('metrics:update', (metrics) => {
      this.metrics = metrics;
      this.renderMetrics();
    });

    // History updates (automático)
    this.socket.on('history:update', (history) => {
      this.history = history;
      this.renderHistory();
    });

    // Failures updates (automático)
    this.socket.on('failures:update', (failures) => {
      this.failures = failures;
      this.renderFailures();
    });

    // Logs do Sistema
    this.socket.on('system:log', (log) => {
      this.addLog(log);
      
      // Erros são apenas logados, sem popups
    });

    // Individual queue events
    this.socket.on('queue:created', () => {
      this.socket.emit('request:queues');
    });

    this.socket.on('queue:started', () => {
      this.socket.emit('request:queues');
    });

    this.socket.on('queue:updated', (data) => {
      this.updateQueueInList(data.queue);
    });

    this.socket.on('queue:completed', () => {
      this.socket.emit('request:queues');
      this.socket.emit('request:stats');
      // Histórico será atualizado automaticamente via WebSocket
    });

    this.socket.on('queue:deleted', () => {
      this.socket.emit('request:queues');
      this.socket.emit('request:stats');
    });

    // Execution events
    this.socket.on('execution:started', () => {
      this.socket.emit('request:executions');
    });

    this.socket.on('execution:completed', () => {
      this.socket.emit('request:executions');
    });
  }

  // History Management
  async fetchHistory() {
    try {
      const response = await fetch(this.apiUrl('/api/history'));
      const data = await response.json();
      if (data.success) {
        this.history = data.history;
        this.renderHistory();
      }
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
    }
  }

  // Failures Management
  async fetchFailures() {
    try {
      const response = await fetch(this.apiUrl('/api/failures?limit=20'));
      const data = await response.json();
      if (data.success) {
        this.failures = data.failures;
        this.renderFailures();
      }
    } catch (error) {
      console.error('Erro ao buscar falhas:', error);
    }
  }

  async fetchMetrics() {
    try {
      const response = await fetch(this.apiUrl('/api/metrics'));
      const data = await response.json();
      if (data.success) {
        this.metrics = data.metrics;
        this.renderMetrics();
      }
    } catch (error) {
      console.error('Erro ao buscar métricas:', error);
    }
  }

  async clearMetrics() {
    // Limpar sem confirmação

    try {
      const response = await fetch(this.apiUrl('/api/metrics'), {
        method: 'DELETE'
      });
      const data = await response.json();
      
      if (data.success) {
        // Atualizar métricas após limpar
        this.fetchMetrics();
        // Solicitar atualização via socket também
        if (this.socket) {
          this.socket.emit('request:metrics');
        }
        console.log('✅ Métricas limpas com sucesso');
      } else {
        console.error('Erro ao limpar métricas:', data.error);
      }
    } catch (error) {
      console.error('Erro ao limpar métricas:', error);
    }
  }

  renderMetrics() {
    const container = document.getElementById('metricsContent');
    
    if (!this.metrics) {
      container.innerHTML = '<div class="empty-state-small">Carregando métricas...</div>';
      return;
    }

    const { total, totalSuccesses, byCategory, byQueue, byDomain } = this.metrics;

    // Nomes amigáveis para categorias
    const categoryNames = {
      popup_not_found: 'Popup não encontrado',
      banner_editor_not_found: 'Banner no Editor não encontrado',
      email_error: 'Erros de Email',
      template_error: 'Erros de Template',
      other_error: 'Outros Erros'
    };

    // Função para renderizar detalhes expansíveis
    const renderDetails = (title, data, type) => {
      if (!data || Object.keys(data).length === 0) {
        return `<div class="metric-detail-empty">Nenhum dado disponível</div>`;
      }

      return Object.entries(data).map(([key, value]) => {
        const totalValue = typeof value === 'object' ? value.total : value;
        const successes = typeof value === 'object' ? (value.successes || 0) : 0;
        const categories = typeof value === 'object' ? value.byCategory : null;
        const totalAttempts = totalValue + successes;
        const successRate = totalAttempts > 0 ? ((successes / totalAttempts) * 100).toFixed(1) : 0;
        
        return `
          <div class="metric-detail-item">
            <div class="metric-detail-header" onclick="app.toggleMetricDetail('${type}-${key}')">
              <span class="metric-detail-key">${key === 'unknown' ? '(Não especificado)' : key}</span>
              <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                <span class="metric-success">✅ ${successes} sucesso(s)</span>
                <span class="metric-failure">❌ ${totalValue} falha(s)</span>
                <span class="metric-rate">${successRate}% taxa de sucesso</span>
                <span class="metric-detail-toggle">▼</span>
              </div>
            </div>
            <div class="metric-detail-content" id="${type}-${key}" style="display: none;">
              ${categories && totalValue > 0 ? `
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border);">
                  <strong style="color: var(--text-secondary); font-size: 12px;">Erros por categoria:</strong>
                  ${Object.entries(categories).filter(([cat, count]) => count > 0).map(([cat, count]) => `
                    <div class="metric-detail-category">
                      <span>${categoryNames[cat] || cat}:</span>
                      <strong>${count}</strong>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
    };

    container.innerHTML = `
      <div class="metrics-overview">
        <div class="metric-card total" style="border-color: #ef4444;">
          <div class="metric-label">Total de Falhas</div>
          <div class="metric-value">${total}</div>
        </div>
        <div class="metric-card total" style="border-color: #10b981; margin-top: 12px;">
          <div class="metric-label">Total de Sucessos</div>
          <div class="metric-value" style="color: #10b981;">${totalSuccesses || 0}</div>
        </div>
      </div>

      <div class="metrics-categories">
        <h3>Por Categoria</h3>
        <div class="category-grid">
          ${Object.entries(byCategory).map(([cat, count]) => `
            <div class="category-card">
              <div class="category-label">${categoryNames[cat] || cat}</div>
              <div class="category-value">${count}</div>
              <div class="category-percentage">${total > 0 ? ((count / total) * 100).toFixed(1) : 0}%</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="metrics-details">
        <div class="metric-section">
          <h3>Por Fila</h3>
          <div class="metric-details-list">
            ${renderDetails('Por Fila', byQueue, 'queue')}
          </div>
        </div>

        <div class="metric-section">
          <h3>Por Domínio</h3>
          <div class="metric-details-list">
            ${renderDetails('Por Domínio', byDomain, 'domain')}
          </div>
        </div>
      </div>
    `;
  }

  toggleMetricDetail(id) {
    const element = document.getElementById(id);
    if (element) {
      element.style.display = element.style.display === 'none' ? 'block' : 'none';
      // Atualizar ícone de toggle
      const header = element.previousElementSibling;
      if (header) {
        const toggle = header.querySelector('.metric-detail-toggle');
        if (toggle) {
          toggle.textContent = element.style.display === 'none' ? '▼' : '▲';
        }
      }
    }
  }

  renderFailures() {
    const container = document.getElementById('failuresList');
    
    if (!this.failures || this.failures.length === 0) {
      container.innerHTML = '<div class="empty-state-small">Nenhuma falha registrada</div>';
      return;
    }

    container.innerHTML = this.failures.map(failure => {
      const date = new Date(failure.timestamp).toLocaleString();
      
      return `
        <div class="failure-item">
          <div class="failure-header">
            <span class="failure-email">📧 ${failure.email}</span>
            <span class="failure-date">${date}</span>
          </div>
          <div class="failure-details">
            <div class="failure-step">Etapa: <strong>${failure.failedStep}</strong></div>
            <div class="failure-error">Erro: ${failure.error}</div>
            ${failure.referralLink ? `
              <div class="failure-link">
                🔗 <a href="${failure.referralLink}" target="_blank">${failure.referralLink}</a>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  async clearHistory() {
    // Limpar sem confirmação
    
    try {
      await fetch(this.apiUrl('/api/history'), { method: 'DELETE' });
      this.fetchHistory();
    } catch (error) {
      console.error('Erro ao limpar histórico:', error);
    }
  }

  renderHistory() {
    const container = document.getElementById('historyList');
    
    if (!this.history || this.history.length === 0) {
      container.innerHTML = '<div class="empty-state-small">Nenhum histórico disponível</div>';
      return;
    }

    container.innerHTML = this.history.map(item => {
      const date = new Date(item.completedAt || item.startedAt).toLocaleString();
      const successRate = item.totalUsers > 0 ? ((item.results.success / item.totalUsers) * 100).toFixed(0) : 0;
      
      return `
        <div class="history-item status-${item.status}">
          <div class="history-header">
            <span class="history-name">${item.name}</span>
            <span class="history-date">${date}</span>
          </div>
          <div class="history-details">
            <span>✅ ${item.results.success}/${item.totalUsers}</span>
            <span>💰 ${item.results.credits} créditos</span>
            <span>📊 ${successRate}% sucesso</span>
          </div>
          <div class="history-link">
            🔗 <a href="${item.referralLink}" target="_blank">${item.referralLink}</a>
          </div>
        </div>
      `;
    }).join('');
  }

  // Log Management
  addLog(log) {
    const container = document.getElementById('systemLogs');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    
    const time = new Date(log.timestamp).toLocaleTimeString();
    let levelClass = `log-${log.level}`;
    
    // Tratamento especial para steps
    if (log.message.includes('[ETAPA')) {
        levelClass = 'log-step';
    }

    entry.innerHTML = `
      <span class="log-time">[${time}]</span>
      <span class="${levelClass}">${log.message}</span>
    `;
    
    container.appendChild(entry);
    container.scrollTop = container.scrollHeight;
  }

  toggleLogs() {
    const panel = document.getElementById('logsPanel');
    panel.classList.toggle('hidden');
  }

  async clearLogs() {
    // Limpar logs na interface
    document.getElementById('systemLogs').innerHTML = '';
    
    // Limpar falhas também
    try {
      await fetch(this.apiUrl('/api/failures'), { method: 'DELETE' });
      this.fetchFailures(); // Atualizar lista de falhas
      this.fetchMetrics(); // Atualizar métricas
    } catch (error) {
      console.error('Erro ao limpar falhas:', error);
    }
  }

  // Alert Management - Removido (notificações irritantes)

  // Timer Management
  updateTimers() {
    const timerElements = document.querySelectorAll('.execution-timer[data-start-time]');
    timerElements.forEach(el => {
      // Se tiver data de fim, usa o tempo total estático
      const completedAt = el.getAttribute('data-completed-at');
      const startTime = new Date(el.getAttribute('data-start-time')).getTime();
      
      let diff;
      if (completedAt && completedAt !== 'null') {
        const endTime = new Date(completedAt).getTime();
        diff = Math.floor((endTime - startTime) / 1000);
      } else {
        const now = Date.now();
        diff = Math.floor((now - startTime) / 1000);
      }
      
      const minutes = Math.floor(diff / 60).toString().padStart(2, '0');
      const seconds = (diff % 60).toString().padStart(2, '0');
      
      el.textContent = `${minutes}:${seconds}`;
    });
  }

  // UI Updates
  updateConnectionStatus(status) {
    const indicator = document.getElementById('connectionStatus');
    const dot = indicator.querySelector('.status-dot');
    
    dot.className = 'status-dot status-' + status;
    
    const texts = {
      connecting: 'Conectando...',
      connected: 'Conectado',
      disconnected: 'Desconectado'
    };
    
    indicator.innerHTML = `
      <span class="status-dot status-${status}"></span>
      ${texts[status]}
    `;
  }

  updateStats() {
    document.getElementById('totalQueues').textContent = this.stats.totalQueues || 0;
    document.getElementById('runningQueues').textContent = this.stats.runningQueues || 0;
    document.getElementById('totalSuccess').textContent = this.stats.totalSuccess || 0;
    document.getElementById('totalCredits').textContent = this.stats.totalCredits || 0;
  }

  renderQueues() {
    const container = document.getElementById('queuesList');
    
    if (this.queues.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>Nenhuma fila criada ainda</p>
          <button class="btn btn-secondary" onclick="app.showCreateQueueModal()">
            Criar primeira fila
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = this.queues.map(queue => this.renderQueue(queue)).join('');
    
    // Restaurar zoom após renderizar
    this.restoreTimelineZooms();
  }

  restoreTimelineZooms() {
    // Restaurar zoom e scroll de todas as timelines após re-render
    this.queues.forEach(queue => {
      const timelineId = `timeline-${queue.id}`;
      const timeline = document.getElementById(timelineId);
      if (!timeline) return;

      const zoom = this.timelineZoom.get(queue.id) || 1;
      const savedScroll = this.timelineScroll?.get(queue.id) || 0;
      
      if (zoom !== 1) {
        const inner = timeline.querySelector('.timeline-inner');
        if (inner) {
          inner.style.transform = `scaleX(${zoom})`;
          inner.style.transformOrigin = 'left center';
          
          if (zoom > 1) {
            inner.style.minWidth = `${100 * zoom}%`;
          }
        }

        const zoomIndicator = document.getElementById(`${timelineId}-zoom`);
        if (zoomIndicator) {
          zoomIndicator.textContent = `${zoom.toFixed(1)}x`;
        }
      }
      
      // Restaurar scroll position
      if (savedScroll > 0) {
        // Usar setTimeout para garantir que o DOM está pronto
        setTimeout(() => {
          timeline.scrollLeft = savedScroll;
        }, 0);
      }
    });
  }

  renderQueue(queue) {
    const forceCredits = queue.forceCredits || false;
    const turboMode = queue.turboMode || false;
    
    // IMPORTANTE: Se forceCredits está ativo, usar sempre totalUsers (meta original)
    // Se não, usar target dinâmico (que pode ser diferente se houver ajustes)
    const target = forceCredits ? (queue.totalUsers || 1) : (queue.results?.target || queue.totalUsers || 1);
    
    // Debug: verificar se forceCredits está sendo recebido
    if (queue.id && forceCredits) {
      console.log(`💰 Fila ${queue.id} (${queue.name}): Meta de Créditos ATIVO - meta original: ${queue.totalUsers}, target dinâmico: ${queue.results?.target}`);
    }
    
    // Se for buscar créditos a todo custo, progresso baseado em sucessos
    // Se não, progresso baseado em total executado
    const completed = forceCredits ? queue.results.success : queue.results.total;
    const progress = target > 0 ? (completed / target) * 100 : 0;
      
      const canStart = queue.status === 'pending';
      const isRunning = queue.status === 'running';
      const isFinalizing = queue.status === 'finalizing';
    
    // Calcular estimativa de prazo (com countdown regressivo)
    // Se já temos uma estimativa armazenada, usar ela (já está sendo decrementada pelo timer)
    let estimateRemaining = null;
    if (queue.id && this.timeEstimates.has(queue.id)) {
      estimateRemaining = this.timeEstimates.get(queue.id).seconds;
      // Se chegou a zero, recalcular
      if (estimateRemaining === 0) {
        estimateRemaining = this.calculateTimeEstimate(queue);
      }
    } else {
      // Se não temos estimativa armazenada, calcular agora
      estimateRemaining = this.calculateTimeEstimate(queue);
    }

    // Formatar tempo decorrido
    const formatTime = (seconds) => {
      if (!seconds && seconds !== 0) return '00:00';
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    const elapsedTime = queue.elapsedTime || 0;
    const timeline = queue.timeline || { errors: [], successes: [] };
    const maxTimestamp = Math.max(
      ...timeline.errors.map(e => e.timestamp || 0),
      ...timeline.successes.map(s => s.timestamp || 0),
      elapsedTime || 0,
      1 // mínimo 1 para evitar divisão por zero
    );

    // Renderizar timeline
    const renderTimeline = () => {
      if (queue.status === 'pending' || (!timeline.errors.length && !timeline.successes.length && !isRunning)) {
        return '';
      }

      const timelineHeight = 24; // altura reduzida da timeline (barra mais fina)
      const timelineId = `timeline-${queue.id}`;

      // Criar pontos para erros e sucessos com posições calculadas
      const errorPoints = timeline.errors.map(err => ({
        position: ((err.timestamp || 0) / maxTimestamp) * 100,
        ...err
      }));

      const successPoints = timeline.successes.map(suc => ({
        position: ((suc.timestamp || 0) / maxTimestamp) * 100,
        ...suc
      }));

      // Calcular largura da barra azul preenchendo
      // Se forceCredits: mostra sucessos / meta original (totalUsers)
      // Se não: mostra completed / target
      const targetForBar = queue.forceCredits ? (queue.totalUsers || 1) : (queue.results?.target || queue.totalUsers || 1);
      const completedForBar = queue.forceCredits ? queue.results.success : queue.results.total;
      const fillWidth = targetForBar > 0 ? Math.min((completedForBar / targetForBar) * 100, 100) : 0;

      return `
        <div class="queue-timeline-container" style="margin-top: 12px; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="font-size: 12px; font-weight: 600; color: var(--text-primary);">📊 Timeline de Execução</div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="font-size: 11px; color: var(--text-secondary);">
                ✅ ${timeline.successes.length} • ❌ ${timeline.errors.length}
              </div>
              <div style="display: flex; gap: 4px; align-items: center;">
                <button class="btn-timeline-zoom" onclick="app.zoomTimeline('${timelineId}', -0.2)" title="Diminuir zoom" style="width: 20px; height: 20px; padding: 0; font-size: 12px;">−</button>
                <span style="font-size: 10px; color: var(--text-secondary); min-width: 40px; text-align: center;" id="${timelineId}-zoom">${(this.timelineZoom.get(queue.id) || 1).toFixed(1)}x</span>
                <button class="btn-timeline-zoom" onclick="app.zoomTimeline('${timelineId}', 0.2)" title="Aumentar zoom" style="width: 20px; height: 20px; padding: 0; font-size: 12px;">+</button>
                <button class="btn-timeline-zoom" onclick="app.resetTimelineZoom('${timelineId}')" title="Resetar zoom" style="width: 24px; height: 20px; padding: 0; font-size: 10px;">↻</button>
              </div>
            </div>
          </div>
          <div class="timeline-wrapper" id="${timelineId}" style="position: relative; padding: 8px 0; overflow-x: auto; overflow-y: visible; cursor: grab;" 
               onmousedown="app.startTimelineDrag(event, '${timelineId}')"
               onwheel="app.handleTimelineWheel(event, '${timelineId}'); event.preventDefault();"
               onscroll="app.saveTimelineScroll('${queue.id}', this.scrollLeft)"
               data-queue-id="${queue.id}">
            <div class="timeline-inner" style="position: relative; height: ${timelineHeight}px; min-width: 100%; background: var(--bg-darker); border-radius: 4px; border: 1px solid var(--border); transform: scaleX(${this.timelineZoom.get(queue.id) || 1}); transform-origin: left center;">
              <!-- Barra azul preenchendo conforme finaliza -->
              ${fillWidth > 0 ? `
                <div class="queue-timeline-fill" style="position: absolute; top: 0; bottom: 0; left: 0; width: ${fillWidth}%; background: var(--primary); opacity: 0.3; transition: width 0.3s ease; border-radius: 4px 0 0 4px; z-index: 1;"></div>
              ` : ''}
              
              <!-- Linha do tempo atual (indicador azul) -->
              ${queue.status === 'running' && elapsedTime > 0 ? `
                <div class="queue-timeline-current" style="position: absolute; top: 0; bottom: 0; left: ${Math.min((elapsedTime / maxTimestamp) * 100, 100)}%; width: 2px; background: var(--primary); z-index: 10; opacity: 0.8; pointer-events: none;"></div>
              ` : ''}
              
              <!-- Pontos de erro (vermelhos) -->
              ${errorPoints.map((err, idx) => {
                const pos = Math.min(err.position, 100);
                return `
                  <div 
                    class="queue-timeline-error-point" 
                    style="position: absolute; left: ${pos}%; top: 50%; transform: translate(-50%, -50%); width: 12px; height: 12px; background: var(--danger); border-radius: 50%; border: 2px solid var(--bg-card); z-index: 20; cursor: pointer; box-shadow: 0 0 6px rgba(239, 68, 68, 0.6);"
                    data-timestamp="${err.timestamp || 0}"
                    data-userid="${err.userId || 0}"
                    data-failedstep="${String(err.failedStep || 'Desconhecida').replace(/"/g, '&quot;')}"
                    data-error="${String(err.error || '').replace(/"/g, '&quot;').substring(0, 500)}"
                    onmouseenter="app.showTimelineTooltip(event, this)"
                    onmouseleave="app.hideTimelineTooltip()"
                  ></div>
                `;
              }).join('')}
              
              <!-- Marcadores de sucesso (verdes pequenos) -->
              ${successPoints.map(suc => {
                const pos = Math.min(suc.position, 100);
                const formatTimestamp = (seconds) => {
                  const mins = Math.floor(seconds / 60);
                  const secs = seconds % 60;
                  if (mins > 0) return `${mins}m ${secs}s`;
                  return `${secs}s`;
                };
                return `
                  <div 
                    class="queue-timeline-success-point" 
                    style="position: absolute; left: ${pos}%; top: 50%; transform: translate(-50%, -50%); width: 8px; height: 8px; background: var(--success); border-radius: 50%; z-index: 15; opacity: 0.9; box-shadow: 0 0 4px rgba(16, 185, 129, 0.4); cursor: pointer;"
                    data-timestamp="${suc.timestamp || 0}"
                    data-userid="${suc.userId || 0}"
                    onmouseenter="app.showSuccessTooltip(event, this)"
                    onmouseleave="app.hideTimelineTooltip()"
                    title="✅ Sucesso no segundo ${suc.timestamp || 0} (Usuário ${suc.userId})"
                  ></div>
                `;
              }).join('')}
            </div>
          </div>
          <!-- Legenda de tempo -->
          <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-secondary); margin-top: 4px;">
            <span>0s</span>
            <span>${maxTimestamp}s</span>
            <span style="font-size: 9px; opacity: 0.7;">${Math.floor(maxTimestamp / 60)}m ${maxTimestamp % 60}s total</span>
          </div>
        </div>
      `;
    };

    return `
      <div class="queue-item status-${queue.status}">
        <div class="queue-header">
          <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
            <div class="queue-name">${queue.name}</div>
            ${forceCredits ? `
              <span style="padding: 4px 10px; background: var(--success); color: white; border-radius: 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.4);">💰 Meta de Créditos</span>
            ` : ''}
            ${turboMode ? `
              <span style="padding: 4px 10px; background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%); color: white; border-radius: 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; box-shadow: 0 2px 4px rgba(139, 92, 246, 0.4);">⚡ Modo Turbo</span>
            ` : ''}
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            ${(queue.status === 'running' || queue.status === 'finalizing' || queue.status === 'completed' || queue.status === 'cancelled') && elapsedTime !== undefined ? `
              <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
                <div class="queue-timer" style="font-family: monospace; font-size: 14px; font-weight: 600; color: var(--primary);">
                  ⏱️ ${formatTime(elapsedTime)}
                </div>
                ${estimateRemaining ? `
                  <div style="font-size: 11px; color: var(--text-secondary); font-family: monospace;">
                    ⏳ ~${formatTime(estimateRemaining)} restante
                  </div>
                ` : ''}
              </div>
            ` : ''}
            <div class="queue-status ${queue.status}">${this.getStatusText(queue.status)}</div>
          </div>
        </div>
        
        <div style="margin-bottom: 12px; font-size: 13px; color: var(--text-secondary);">
          🔗 <a href="${queue.referralLink}" target="_blank" style="color: var(--primary);">${queue.referralLink}</a>
        </div>
        
        ${forceCredits ? `
          <div style="margin-bottom: 12px; padding: 12px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(99, 102, 241, 0.2) 100%); border: 2px solid var(--success); border-radius: 10px; display: flex; align-items: center; gap: 10px; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);">
            <span style="font-size: 24px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));">💰</span>
            <div style="flex: 1;">
              <div style="font-weight: 800; color: var(--success); font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">💰 Meta de Créditos</div>
              <div style="font-size: 12px; color: var(--text-primary); font-weight: 500;">O sistema continuará tentando até atingir a meta de ${queue.totalUsers * 10} créditos (${queue.totalUsers} usuários), mesmo com erros</div>
            </div>
            <div style="padding: 4px 12px; background: var(--success); color: white; border-radius: 20px; font-size: 11px; font-weight: 700; white-space: nowrap;">ATIVO</div>
          </div>
        ` : ''}
        
        ${queue.selectedDomains && queue.selectedDomains.length > 0 ? `
          <div style="margin-bottom: 12px; font-size: 12px; color: var(--text-secondary);">
            📧 Domínios: <strong style="color: var(--primary);">${queue.selectedDomains.join(', ')}</strong>
          </div>
        ` : `
          <div style="margin-bottom: 12px; font-size: 12px; color: var(--text-secondary);">
            📧 Domínios: <strong style="color: var(--warning);">Rotação global</strong>
          </div>
        `}
        
        <div class="queue-stats">
          <div class="queue-stat">
            <div class="queue-stat-value">${forceCredits ? `${queue.results.success * 10}/${queue.totalUsers * 10}` : queue.results.success}</div>
            <div class="queue-stat-label">${forceCredits ? 'Créditos (n/meta)' : 'Sucessos'}</div>
          </div>
          <div class="queue-stat">
            <div class="queue-stat-value">${queue.results.failed}</div>
            <div class="queue-stat-label">Falhas</div>
          </div>
          <div class="queue-stat">
            <div class="queue-stat-value">${target - completed}</div>
            <div class="queue-stat-label">${forceCredits ? 'Meta Restante' : 'Pendentes'}</div>
          </div>
          ${queue.results.total > 0 ? `
            <div class="queue-stat">
              <div class="queue-stat-value" style="color: ${(queue.results.failed / queue.results.total * 100) > 20 ? 'var(--danger)' : 'var(--warning)'}">
                ${(queue.results.failed / queue.results.total * 100).toFixed(1)}%
              </div>
              <div class="queue-stat-label">Taxa de Erro</div>
            </div>
          ` : ''}
        </div>
        
        <div class="queue-progress">
          <div class="queue-progress-bar" style="width: ${progress}%"></div>
        </div>
        
        ${renderTimeline()}
        
        <div class="queue-actions">
          ${canStart ? `
            <button class="btn btn-success" onclick="app.startQueue('${queue.id}')">
              ▶️ Iniciar
            </button>
          ` : ''}
          ${isRunning ? `
            <button class="btn btn-danger" onclick="app.stopQueue('${queue.id}')">
              ⏹️ Parar
            </button>
          ` : ''}
          ${isFinalizing ? `
            <button class="btn btn-danger" style="opacity: 0.6; cursor: not-allowed;" disabled>
              ⏳ Finalizando...
            </button>
          ` : ''}
          <button class="btn btn-danger btn-small" onclick="app.deleteQueue('${queue.id}')" title="Apagar fila">
            🗑️ Apagar
          </button>
          <div style="flex: 1"></div>
          <div style="font-size: 12px; color: var(--text-secondary)">
            ${queue.parallelExecutions}x paralelo • ${queue.totalUsers} usuários
          </div>
        </div>
      </div>
    `;
  }

  updateQueueInList(queue) {
    const index = this.queues.findIndex(q => q.id === queue.id);
    if (index !== -1) {
      // Atualizar timer em tempo real para filas rodando
      if (queue.status === 'running' && queue.startedAt) {
        const startTime = new Date(queue.startedAt).getTime();
        const now = Date.now();
        queue.elapsedTime = Math.floor((now - startTime) / 1000);
      }
      this.queues[index] = queue;
      this.renderQueues();
    }
  }

  showTimelineTooltip(event, element) {
    // Remover tooltip anterior se existir
    this.hideTimelineTooltip();

    const timestamp = parseInt(element.getAttribute('data-timestamp') || 0);
    const userId = parseInt(element.getAttribute('data-userid') || 0);
    const failedStep = element.getAttribute('data-failedstep') || 'Desconhecida';
    const error = element.getAttribute('data-error') || 'Erro desconhecido';

    // Escapar HTML para segurança
    const escapeHtml = (text) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };

    // Formatar tempo
    const formatTimestamp = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      if (mins > 0) return `${mins}m ${secs}s`;
      return `${secs}s`;
    };

    // Criar tooltip
    const tooltip = document.createElement('div');
    tooltip.id = 'timeline-tooltip';
    tooltip.className = 'timeline-tooltip';
    tooltip.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 8px; color: var(--danger); font-size: 13px; border-bottom: 2px solid var(--danger); padding-bottom: 4px;">
        ❌ Erro Detectado
      </div>
      <div style="display: grid; grid-template-columns: auto 1fr; gap: 8px 12px; font-size: 12px; margin-bottom: 8px;">
        <div style="color: var(--text-secondary); font-weight: 600;">Usuário:</div>
        <div style="color: var(--text-primary);">#${userId}</div>
        <div style="color: var(--text-secondary); font-weight: 600;">Etapa:</div>
        <div style="color: var(--warning); font-weight: 600;">${escapeHtml(failedStep)}</div>
        <div style="color: var(--text-secondary); font-weight: 600;">Tempo:</div>
        <div style="color: var(--text-primary); font-family: monospace;">${formatTimestamp(timestamp)} (${timestamp}s)</div>
      </div>
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border);">
        <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 4px; font-weight: 600;">Mensagem de Erro:</div>
        <div style="font-size: 11px; color: var(--danger); word-break: break-word; max-width: 400px; line-height: 1.5; background: rgba(239, 68, 68, 0.1); padding: 8px; border-radius: 4px; font-family: monospace; white-space: pre-wrap;">${escapeHtml(error)}</div>
      </div>
    `;
    
    document.body.appendChild(tooltip);
    
    // Posicionar tooltip
    const rect = element.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
    let top = rect.top - tooltipRect.height - 12;
    
    // Ajustar se sair da tela
    if (left < 10) left = 10;
    if (left + tooltipRect.width > window.innerWidth - 10) {
      left = window.innerWidth - tooltipRect.width - 10;
    }
    if (top < 10) {
      top = rect.bottom + 12;
    }
    
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  hideTimelineTooltip() {
    const existingTooltip = document.getElementById('timeline-tooltip');
    if (existingTooltip) {
      existingTooltip.remove();
    }
  }

  showSuccessTooltip(event, element) {
    this.hideTimelineTooltip();

    const timestamp = parseInt(element.getAttribute('data-timestamp') || 0);
    const userId = parseInt(element.getAttribute('data-userid') || 0);

    const formatTimestamp = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      if (mins > 0) return `${mins}m ${secs}s`;
      return `${secs}s`;
    };

    const tooltip = document.createElement('div');
    tooltip.id = 'timeline-tooltip';
    tooltip.className = 'timeline-tooltip';
    tooltip.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 8px; color: var(--success); font-size: 13px; border-bottom: 2px solid var(--success); padding-bottom: 4px;">
        ✅ Sucesso
      </div>
      <div style="display: grid; grid-template-columns: auto 1fr; gap: 8px 12px; font-size: 12px;">
        <div style="color: var(--text-secondary); font-weight: 600;">Usuário:</div>
        <div style="color: var(--text-primary);">#${userId}</div>
        <div style="color: var(--text-secondary); font-weight: 600;">Tempo:</div>
        <div style="color: var(--text-primary); font-family: monospace;">${formatTimestamp(timestamp)} (${timestamp}s)</div>
        <div style="color: var(--text-secondary); font-weight: 600;">Créditos:</div>
        <div style="color: var(--success); font-weight: 600;">+10 créditos</div>
      </div>
    `;
    
    document.body.appendChild(tooltip);
    
    const rect = element.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
    let top = rect.top - tooltipRect.height - 12;
    
    if (left < 10) left = 10;
    if (left + tooltipRect.width > window.innerWidth - 10) {
      left = window.innerWidth - tooltipRect.width - 10;
    }
    if (top < 10) {
      top = rect.bottom + 12;
    }
    
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  // Zoom na timeline
  zoomTimeline(timelineId, delta) {
    const timeline = document.getElementById(timelineId);
    if (!timeline) return;

    const queueId = timeline.getAttribute('data-queue-id');
    if (!queueId) return;

    const inner = timeline.querySelector('.timeline-inner');
    if (!inner) return;

    const currentZoom = this.timelineZoom.get(queueId) || 1;
    const newZoom = Math.max(0.5, Math.min(5, currentZoom + delta));
    
    // Salvar zoom no estado
    this.timelineZoom.set(queueId, newZoom);
    
    inner.style.transform = `scaleX(${newZoom})`;
    inner.style.transformOrigin = 'left center';
    
    // Atualizar indicador de zoom
    const zoomIndicator = document.getElementById(`${timelineId}-zoom`);
    if (zoomIndicator) {
      zoomIndicator.textContent = `${newZoom.toFixed(1)}x`;
    }

    // Ajustar largura mínima para permitir scroll
    if (newZoom > 1) {
      inner.style.minWidth = `${100 * newZoom}%`;
      timeline.style.cursor = 'grab';
    } else {
      inner.style.minWidth = '100%';
    }
  }

  resetTimelineZoom(timelineId) {
    const timeline = document.getElementById(timelineId);
    if (!timeline) return;

    const queueId = timeline.getAttribute('data-queue-id');
    if (!queueId) return;

    const inner = timeline.querySelector('.timeline-inner');
    if (!inner) return;

    // Resetar zoom no estado
    this.timelineZoom.set(queueId, 1);
    this.timelineScroll.set(queueId, 0);

    inner.style.transform = 'scaleX(1)';
    inner.style.minWidth = '100%';
    timeline.scrollLeft = 0;

    const zoomIndicator = document.getElementById(`${timelineId}-zoom`);
    if (zoomIndicator) {
      zoomIndicator.textContent = '1x';
    }
  }

  saveTimelineScroll(queueId, scrollLeft) {
    if (queueId) {
      this.timelineScroll.set(queueId, scrollLeft);
    }
  }

  calculateTimeEstimate(queue) {
    if (queue.status !== 'running' || !queue.executionTimes || queue.executionTimes.length === 0) {
      // Limpar estimativa se a fila não está rodando
      if (queue.id) {
        this.timeEstimates.delete(queue.id);
      }
      return null;
    }

    // IMPORTANTE: Se forceCredits está ativo, usar sempre totalUsers (meta original)
    // Se não, usar target dinâmico
    const target = queue.forceCredits ? (queue.totalUsers || 1) : (queue.results?.target || queue.totalUsers || 1);
    const completed = queue.forceCredits ? queue.results.success : queue.results.total;
    const remaining = Math.max(0, target - completed);

    if (remaining === 0) {
      // Limpar estimativa se a meta foi atingida
      if (queue.id) {
        this.timeEstimates.delete(queue.id);
      }
      return null;
    }

    // Verificar se já temos uma estimativa armazenada
    const existingEstimate = queue.id ? this.timeEstimates.get(queue.id) : null;
    
    // Se temos estimativa armazenada e o número de execuções não mudou,
    // usar a estimativa existente (que já está sendo decrementada pelo timer)
    if (existingEstimate && existingEstimate.lastTotalExecutions === queue.executionTimes.length) {
      return existingEstimate.seconds;
    }

    // Recalcular estimativa baseado nos dados atuais (novas execuções completaram)
    // Usar todos os tempos disponíveis se houver menos de 10, senão usar os últimos 10
    const recentTimes = queue.executionTimes.length < 10 
      ? queue.executionTimes 
      : queue.executionTimes.slice(-10);
    
    // Calcular média dos tempos (usar todos disponíveis quando houver menos de 10)
    const avgTime = recentTimes.length > 0
      ? recentTimes.reduce((sum, t) => sum + t, 0) / recentTimes.length
      : 0;
    
    const parallel = queue.parallelExecutions || 1;
    
    // Tempo estimado = (restantes / paralelo) * tempo médio
    // Se não há tempos disponíveis ainda, usar um valor padrão conservador
    const estimatedSeconds = avgTime > 0 
      ? Math.ceil((remaining / parallel) * avgTime)
      : Math.ceil((remaining / parallel) * 60); // Fallback: 60s por execução
    
    // Armazenar a nova estimativa com timestamp atual
    if (queue.id) {
      this.timeEstimates.set(queue.id, {
        seconds: estimatedSeconds,
        lastUpdate: Date.now(),
        lastTotalExecutions: queue.executionTimes.length
      });
    }
    
    return estimatedSeconds;
  }
  
  // Timer para atualizar tempo restante regressivamente
  startTimeEstimateTimer() {
    if (this.timeEstimateInterval) {
      clearInterval(this.timeEstimateInterval);
    }
    
    this.timeEstimateInterval = setInterval(() => {
      // Decrementar 1 segundo de cada estimativa armazenada (countdown regressivo)
      for (const [queueId, estimate] of this.timeEstimates.entries()) {
        if (estimate.seconds > 0) {
          estimate.seconds = estimate.seconds - 1;
          
          // Remover se chegou a zero
          if (estimate.seconds === 0) {
            this.timeEstimates.delete(queueId);
          }
        }
      }
      
      // Re-renderizar apenas filas rodando para atualizar tempo restante regressivo
      const runningQueues = this.queues.filter(q => q.status === 'running');
      if (runningQueues.length > 0) {
        this.renderQueues();
      }
    }, 1000); // Atualizar a cada segundo (decrementa 1 segundo)
  }

  handleTimelineWheel(event, timelineId) {
    const timeline = document.getElementById(timelineId);
    if (!timeline) return;
    
    const queueId = timeline.getAttribute('data-queue-id');
    
    if (event.ctrlKey || event.metaKey) {
      // Zoom com Ctrl/Cmd + Wheel
      const delta = event.deltaY > 0 ? -0.1 : 0.1;
      this.zoomTimeline(timelineId, delta);
    } else {
      // Scroll horizontal com Shift + Wheel ou apenas Wheel
      timeline.scrollLeft += event.deltaY;
      
      // Salvar scroll position
      if (queueId) {
        this.timelineScroll.set(queueId, timeline.scrollLeft);
      }
    }
  }

  startTimelineDrag(event, timelineId) {
    if (event.target.classList.contains('queue-timeline-error-point') || 
        event.target.classList.contains('queue-timeline-success-point')) {
      return; // Não arrastar quando clicar nos pontos
    }

    const timeline = document.getElementById(timelineId);
    if (!timeline) return;

    const queueId = timeline.getAttribute('data-queue-id');
    const startX = event.pageX - timeline.offsetLeft;
    const scrollLeft = timeline.scrollLeft;
    timeline.style.cursor = 'grabbing';

    const onMouseMove = (e) => {
      e.preventDefault();
      const x = e.pageX - timeline.offsetLeft;
      const walk = (x - startX) * 2;
      timeline.scrollLeft = scrollLeft - walk;
      
      // Salvar scroll position
      if (queueId) {
        this.timelineScroll.set(queueId, timeline.scrollLeft);
      }
    };

    const onMouseUp = () => {
      timeline.style.cursor = 'grab';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  getStatusText(status) {
    const texts = {
      pending: 'Pendente',
      running: 'Executando',
      finalizing: 'Finalizando...',
      completed: 'Concluído',
      failed: 'Falhou'
    };
    return texts[status] || status;
  }

  renderDomains() {
    const container = document.getElementById('domainsList');
    
    if (!this.domains.domains || this.domains.domains.length === 0) {
      container.innerHTML = '<div class="loading">Nenhum domínio configurado</div>';
      return;
    }

    container.innerHTML = this.domains.domains.map((domain, index) => `
      <div class="domain-item ${index === this.domains.currentIndex ? 'current' : ''}">
        <span>${domain}</span>
        ${index === this.domains.currentIndex ? '<span style="color: var(--primary); font-weight: 600;">◀ Atual</span>' : ''}
      </div>
    `).join('');

    document.getElementById('currentDomain').textContent = this.domains.currentDomain || '-';
    document.getElementById('totalDomains').textContent = this.domains.total || 0;
  }

  renderExecutions(executions) {
    const container = document.getElementById('executionsList');
    const count = document.getElementById('activeExecutionsCount');
    
    count.textContent = executions.length;

    if (executions.length === 0) {
      container.innerHTML = '<div class="empty-state-small">Nenhuma execução ativa</div>';
      return;
    }

    container.innerHTML = executions.map(exec => {
      const startTime = exec.startedAt;
      const completedAt = exec.completedAt; // Adicionado para controle do timer
      const credentials = exec.credentials || {};
      
      return `
      <div class="execution-item ${exec.status === 'running' ? '' : exec.status}">
        <div class="execution-header">
          <div class="execution-id">Usuário ${exec.userId}</div>
          <div class="execution-timer" data-start-time="${startTime}" data-completed-at="${completedAt}">00:00</div>
        </div>
        <div class="execution-info">
          Status: <span class="execution-status">${exec.status}</span>
        </div>
        ${credentials.email ? `
          <div class="credentials">
            <div>📧 ${credentials.email}</div>
            <div>🔑 ${credentials.password || '******'}</div>
          </div>
        ` : '<div class="execution-info">Gerando credenciais...</div>'}
      </div>
    `}).join('');
  }

  // Mostrar erro de validação no modal
  showQueueError(message) {
    // Remover mensagem anterior se existir
    const existingError = document.getElementById('queueCreateError');
    if (existingError) {
      existingError.remove();
    }

    // Criar elemento de erro
    const errorDiv = document.createElement('div');
    errorDiv.id = 'queueCreateError';
    errorDiv.style.cssText = 'padding: 12px; margin-bottom: 16px; background: #fee; border: 2px solid #f44; border-radius: 8px; color: #c33; font-weight: 600;';
    errorDiv.innerHTML = `❌ ${message}`;

    // Inserir antes dos botões de ação
    const formActions = document.querySelector('#createQueueModal .form-actions');
    if (formActions) {
      formActions.parentNode.insertBefore(errorDiv, formActions);
      // Scroll até o erro
      errorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // Remover erro de validação
  clearQueueError() {
    const existingError = document.getElementById('queueCreateError');
    if (existingError) {
      existingError.remove();
    }
  }

  // API Calls
  async createQueue(event) {
    event.preventDefault();
    
    // Limpar erros anteriores
    this.clearQueueError();

    const submitButton = event.target.querySelector('button[type="submit"]');
    const originalButtonText = submitButton ? submitButton.innerHTML : '✅ Criar Fila';
    
    // Desabilitar botão durante processamento
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.innerHTML = '⏳ Criando...';
    }

    try {
      const referralLink = document.getElementById('queueReferralLink').value.trim();
      const name = document.getElementById('queueName').value;
      const usersStr = document.getElementById('queueUsers').value;
      const parallelStr = document.getElementById('queueParallel').value;
      
      const users = parseInt(usersStr);
      const parallel = parseInt(parallelStr);

      // Validar link de indicação
      if (!referralLink) {
        this.showQueueError('Link de indicação é obrigatório');
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.innerHTML = originalButtonText;
        }
        return;
      }
      
      // Validar número de usuários
      if (!usersStr || isNaN(users) || users < 1) {
        this.showQueueError('Número de usuários inválido. Deve ser um número maior que 0.');
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.innerHTML = originalButtonText;
        }
        return;
      }
      
      // Validar execuções paralelas
      if (isNaN(parallel) || parallel < 1 || parallel > 10) {
        this.showQueueError('Número de execuções paralelas inválido. Deve estar entre 1 e 10.');
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.innerHTML = originalButtonText;
        }
        return;
      }

      // Capturar domínios selecionados
      const selectedDomains = [];
      const domainCheckboxes = document.querySelectorAll('#queueDomainSelection input[type="checkbox"]:checked');
      domainCheckboxes.forEach(cb => selectedDomains.push(cb.value));

      console.log('📧 Domínios selecionados:', selectedDomains);
      
      // Capturar proxies selecionados
      const selectedProxies = [];
      const proxyCheckboxes = document.querySelectorAll('#queueProxySelection input[type="checkbox"]:checked');
      proxyCheckboxes.forEach(cb => selectedProxies.push(cb.value));

      console.log('🌐 Proxies selecionados:', selectedProxies.length);
      
      // Validar seleção de domínios - OBRIGATÓRIO pelo menos 1
      if (selectedDomains.length === 0) {
        this.showQueueError('É necessário selecionar pelo menos 1 domínio para criar uma fila.');
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.innerHTML = originalButtonText;
        }
        return;
      }
      
      // Validar seleção de proxies (sem confirmação)
      if (selectedProxies.length === 0) {
        console.log('⚠️ Nenhum proxy selecionado. Usando IP local ou proxy global.');
      }

      // Capturar erros simulados
      const simulatedErrors = [];
      const errorCheckboxes = document.querySelectorAll('#queueErrorSimulation input[type="checkbox"]:checked');
      errorCheckboxes.forEach(cb => simulatedErrors.push(cb.value));

      // Capturar opção "buscar créditos a todo custo"
      const forceCredits = document.getElementById('queueForceCredits').checked;
      // Capturar opção "modo turbo"
      const turboMode = document.getElementById('queueTurboMode').checked;
      // Capturar opção "verificar banner de créditos" (só disponível se turboMode estiver ativo)
      const checkCreditsBannerEl = document.getElementById('queueCheckCreditsBanner');
      const checkCreditsBanner = checkCreditsBannerEl ? (checkCreditsBannerEl.checked && turboMode) : false;

      console.log('🧪 Erros simulados:', simulatedErrors);
      console.log('💰 Buscar créditos a todo custo:', forceCredits);
      console.log('⚡ Modo Turbo:', turboMode);
      console.log('🔍 Verificar Banner de Créditos:', checkCreditsBanner);

      const response = await fetch(this.apiUrl('/api/queues'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralLink, name, users, parallel, selectedDomains, selectedProxies, simulatedErrors, forceCredits, turboMode, checkCreditsBanner })
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Fila criada:', data.queueId);
        
        // Limpar formulário
        document.getElementById('queueReferralLink').value = '';
        document.getElementById('queueName').value = '';
        document.getElementById('queueUsers').value = '3';
        document.getElementById('queueParallel').value = '1';
        document.getElementById('queueForceCredits').checked = false;
        document.getElementById('queueTurboMode').checked = false;
        const checkCreditsBannerElReset = document.getElementById('queueCheckCreditsBanner');
        if (checkCreditsBannerElReset) {
          checkCreditsBannerElReset.checked = false;
        }
        
        // Resetar estado dos checkboxes
        this.onTurboModeChange();
        
        // Resetar preview de créditos
        this.updateCreditsPreview('3');
        
        this.hideCreateQueueModal();
        this.socket.emit('request:queues');
      } else {
        const errorMessage = data.error || 'Erro desconhecido ao criar fila';
        this.showQueueError(errorMessage);
        console.error('Erro ao criar fila:', errorMessage);
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.innerHTML = originalButtonText;
        }
      }
    } catch (error) {
      const errorMessage = error.message || 'Erro de conexão ao criar fila';
      this.showQueueError(errorMessage);
      console.error('Erro ao criar fila:', error);
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonText;
      }
    }
  }

  async startQueue(queueId) {
    try {
      const response = await fetch(this.apiUrl(`/api/queues/${queueId}/start`), {
        method: 'POST'
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Fila iniciada:', queueId);
        this.socket.emit('request:queues');
      } else {
        console.error('Erro ao iniciar fila:', data.error);
      }
    } catch (error) {
      console.error('Erro ao iniciar fila:', error);
    }
  }

  async stopQueue(queueId) {
    // Parar sem confirmação

    try {
      const response = await fetch(this.apiUrl(`/api/queues/${queueId}/stop`), {
        method: 'POST'
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Fila parada:', queueId);
        this.socket.emit('request:queues');
      } else {
        console.error('Erro ao parar fila:', data.error);
      }
    } catch (error) {
      console.error('Erro ao parar fila:', error);
    }
  }

  async deleteQueue(queueId) {
    // Apagar sem confirmação

    try {
      const response = await fetch(this.apiUrl(`/api/queues/${queueId}`), {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Fila apagada:', queueId);
        // Remover da lista local
        this.queues = this.queues.filter(q => q.id !== queueId);
        // Remover zoom e scroll salvos
        if (this.timelineZoom) this.timelineZoom.delete(queueId);
        if (this.timelineScroll) this.timelineScroll.delete(queueId);
        // Re-renderizar lista
        this.renderQueues();
        // Não precisa fazer request:queues aqui, o evento queue:deleted já faz isso
      } else {
        console.error('Erro ao apagar fila:', data.error);
      }
    } catch (error) {
      console.error('Erro ao apagar fila:', error);
    }
  }

  async addDomain() {
    const input = document.getElementById('newDomain');
    const domain = input.value.trim();

    if (!domain) return;

    try {
      const response = await fetch(this.apiUrl('/api/domains'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain })
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Domínio adicionado:', domain);
        input.value = '';
        this.socket.emit('request:domains');
      } else {
        console.error('Erro ao adicionar domínio:', data.error);
      }
    } catch (error) {
      console.error('Erro ao adicionar domínio:', error);
    }
  }

  async removeDomain(domain) {
    // Remover sem confirmação

    try {
      const response = await fetch(this.apiUrl(`/api/domains/${encodeURIComponent(domain)}`), {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Domínio removido:', domain);
        this.socket.emit('request:domains');
      } else {
        console.error('Erro ao remover domínio:', data.error);
      }
    } catch (error) {
      console.error('Erro ao remover domínio:', error);
    }
  }

  async resetDomainIndex() {
    try {
      const response = await fetch(this.apiUrl('/api/domains/reset'), {
        method: 'POST'
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Índice de domínios resetado');
        this.socket.emit('request:domains');
      } else {
        console.error('Erro ao resetar índice:', data.error);
      }
    } catch (error) {
      console.error('Erro ao resetar índice:', error);
    }
  }

  updateCreditsPreview(value) {
    const credits = parseInt(value) || 0;
    const totalCredits = credits * 10;
    const preview = document.getElementById('creditsPreview');
    if (preview) {
      preview.textContent = `${totalCredits} créditos`;
    }
  }

  onTurboModeChange() {
    const turboMode = document.getElementById('queueTurboMode').checked;
    const checkCreditsBanner = document.getElementById('queueCheckCreditsBanner');
    
    // Habilitar/desabilitar checkbox de verificar banner baseado no modo turbo
    if (checkCreditsBanner) {
      checkCreditsBanner.disabled = !turboMode;
      // Se desabilitar, desmarcar também
      if (!turboMode) {
        checkCreditsBanner.checked = false;
      }
    }
  }

  enableAllOptions() {
    document.getElementById('queueForceCredits').checked = true;
    document.getElementById('queueTurboMode').checked = true;
    // Habilitar e marcar verificação de banner (só funciona com turbo)
    const checkCreditsBanner = document.getElementById('queueCheckCreditsBanner');
    if (checkCreditsBanner) {
      checkCreditsBanner.disabled = false;
      checkCreditsBanner.checked = true;
    }
    // Chamar onTurboModeChange para garantir estado consistente
    this.onTurboModeChange();
  }

  // Modal Controls
  showCreateQueueModal() {
    // Limpar erros anteriores
    this.clearQueueError();
    
    // Primeiro buscar domínios se ainda não foram carregados
    if (!this.domains || !this.domains.domains || this.domains.domains.length === 0) {
      this.socket.emit('request:domains');
    }
    
    // Buscar proxies se ainda não foram carregados
    if (!this.proxies || this.proxies.length === 0) {
      this.fetchProxies();
    }
    
    document.getElementById('createQueueModal').classList.add('active');
    
    // Pequeno delay para garantir que os domínios e proxies foram atualizados
    setTimeout(() => {
      this.renderQueueDomainSelection();
      this.renderQueueProxySelection();
    }, 100);
  }

  hideCreateQueueModal() {
    document.getElementById('createQueueModal').classList.remove('active');
  }

  showDomainsModal() {
    document.getElementById('domainsModal').classList.add('active');
    this.renderDomainsEditor();
  }

  hideDomainsModal() {
    document.getElementById('domainsModal').classList.remove('active');
  }

  renderQueueDomainSelection() {
    const container = document.getElementById('queueDomainSelection');
    
    console.log('🔍 Renderizando seleção de domínios. Domínios disponíveis:', this.domains);
    
    if (!this.domains.domains || this.domains.domains.length === 0) {
      container.innerHTML = '<div class="info-text">Nenhum domínio disponível. Adicione domínios primeiro.</div>';
      return;
    }

    container.innerHTML = this.domains.domains.map(domain => `
      <div class="domain-checkbox">
        <input type="checkbox" id="domain-${domain}" value="${domain}">
        <label for="domain-${domain}">${domain}</label>
      </div>
    `).join('');
    
    console.log('✅ Checkboxes renderizados:', this.domains.domains.length);
  }

  selectAllDomains() {
    const checkboxes = document.querySelectorAll('#queueDomainSelection input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = true);
  }

  clearDomainSelection() {
    const checkboxes = document.querySelectorAll('#queueDomainSelection input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
  }

  renderQueueProxySelection() {
    const container = document.getElementById('queueProxySelection');
    
    console.log('🔍 Renderizando seleção de proxies. Proxies disponíveis:', this.proxies);
    
    if (!this.proxies || this.proxies.length === 0) {
      container.innerHTML = '<div class="info-text">Nenhum proxy disponível. Configure proxies primeiro.</div>';
      return;
    }

    container.innerHTML = this.proxies.map(proxy => `
      <div class="domain-checkbox">
        <input type="checkbox" id="proxy-${proxy.id}" value="${proxy.value}">
        <label for="proxy-${proxy.id}">${proxy.display}</label>
      </div>
    `).join('');
    
    console.log('✅ Checkboxes de proxies renderizados:', this.proxies.length);
  }

  selectAllProxies() {
    const checkboxes = document.querySelectorAll('#queueProxySelection input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = true);
  }

  clearProxySelection() {
    const checkboxes = document.querySelectorAll('#queueProxySelection input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
  }

  renderDomainsEditor() {
    const container = document.getElementById('domainsEditor');
    
    if (!this.domains.domains || this.domains.domains.length === 0) {
      container.innerHTML = '<div class="info-text">Nenhum domínio configurado</div>';
      return;
    }

    container.innerHTML = this.domains.domains.map((domain, index) => `
      <div class="domain-item ${index === this.domains.currentIndex ? 'current' : ''}">
        <span>${domain}</span>
        <button class="domain-remove" onclick="app.removeDomain('${domain}')">
          Remover
        </button>
      </div>
    `).join('');
  }
}

// Initialize app
const app = new App();
