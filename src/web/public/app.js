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
    this.init();
  }

  // Helper para construir URLs com BASE_PATH
  apiUrl(path) {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.basePath}${cleanPath}`;
  }

  init() {
    console.log('🚀 Inicializando Dashboard...');
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
    this.fetchMetrics(); // Buscar métricas
    // Iniciar loop de atualização dos timers
    setInterval(() => this.updateTimers(), 1000);
    // Atualizar falhas a cada 10 segundos
    setInterval(() => this.fetchFailures(), 10000);
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

    // Logs do Sistema
    this.socket.on('system:log', (log) => {
      this.addLog(log);
      
      // Verificar se é um erro crítico de validação de email
      if (log.level === 'error' && log.message.includes('ERRO DETECTADO NO EMAIL')) {
        this.showAlert('Erro de Email Detectado', log.message.replace('🚨 ERRO DETECTADO NO EMAIL: ', ''));
      }
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
      this.fetchHistory(); // Atualizar histórico
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
    if (!confirm('Tem certeza que deseja limpar o histórico?')) return;
    
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

  // Alert Management
  showAlert(title, message) {
    const container = document.getElementById('alertContainer');
    const alert = document.createElement('div');
    alert.className = 'alert-toast';
    alert.innerHTML = `
      <div class="alert-icon">🚨</div>
      <div class="alert-content">
        <h4>${title}</h4>
        <p>${message}</p>
      </div>
    `;
    
    container.appendChild(alert);
    
    // Remover após 10 segundos
    setTimeout(() => {
      alert.style.opacity = '0';
      setTimeout(() => alert.remove(), 300);
    }, 10000);
  }

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
  }

  renderQueue(queue) {
    const progress = queue.results.total > 0 
      ? (queue.results.total / queue.totalUsers) * 100 
      : 0;
      
    const canStart = queue.status === 'pending';
    const isRunning = queue.status === 'running';

    return `
      <div class="queue-item status-${queue.status}">
        <div class="queue-header">
          <div class="queue-name">${queue.name}</div>
          <div class="queue-status ${queue.status}">${this.getStatusText(queue.status)}</div>
        </div>
        
        <div style="margin-bottom: 12px; font-size: 13px; color: var(--text-secondary);">
          🔗 <a href="${queue.referralLink}" target="_blank" style="color: var(--primary);">${queue.referralLink}</a>
        </div>
        
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
            <div class="queue-stat-value">${queue.results.success}</div>
            <div class="queue-stat-label">Sucessos</div>
          </div>
          <div class="queue-stat">
            <div class="queue-stat-value">${queue.results.failed}</div>
            <div class="queue-stat-label">Falhas</div>
          </div>
          <div class="queue-stat">
            <div class="queue-stat-value">${queue.results.pending}</div>
            <div class="queue-stat-label">Pendentes</div>
          </div>
          ${queue.results.total > 0 ? `
            <div class="queue-stat">
              <div class="queue-stat-value" style="color: ${(queue.results.failed / queue.results.total * 100) > 20 ? 'var(--danger)' : 'var(--warning)'}">
                ${(queue.results.failed / queue.results.total * 100).toFixed(1)}%
              </div>
              <div class="queue-stat-label">Taxa de Erro</div>
            </div>
          ` : ''}
          <div class="queue-stat">
            <div class="queue-stat-value">${queue.results.credits}</div>
            <div class="queue-stat-label">Créditos</div>
          </div>
        </div>
        
        <div class="queue-progress">
          <div class="queue-progress-bar" style="width: ${progress}%"></div>
        </div>
        
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
      this.queues[index] = queue;
      this.renderQueues();
    }
  }

  getStatusText(status) {
    const texts = {
      pending: 'Pendente',
      running: 'Executando',
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

  // API Calls
  async createQueue(event) {
    event.preventDefault();

    const referralLink = document.getElementById('queueReferralLink').value.trim();
    const name = document.getElementById('queueName').value;
    const usersStr = document.getElementById('queueUsers').value;
    const parallelStr = document.getElementById('queueParallel').value;
    
    const users = parseInt(usersStr);
    const parallel = parseInt(parallelStr);

    // Validar link de indicação
    if (!referralLink) {
      alert('Link de indicação é obrigatório');
      return;
    }
    
    // Validar número de usuários
    if (!usersStr || isNaN(users) || users < 1) {
      alert('Número de usuários inválido. Deve ser um número maior que 0.');
      return;
    }
    
    // Validar execuções paralelas
    if (isNaN(parallel) || parallel < 1 || parallel > 5) {
      alert('Número de execuções paralelas inválido. Deve estar entre 1 e 5.');
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
    
    // Validar seleção de domínios (sem confirmação)
    if (selectedDomains.length === 0) {
      console.log('⚠️ Nenhum domínio selecionado. Usando rotação global.');
    }
    
    // Validar seleção de proxies (sem confirmação)
    if (selectedProxies.length === 0) {
      console.log('⚠️ Nenhum proxy selecionado. Usando IP local ou proxy global.');
    }

    try {
      const response = await fetch(this.apiUrl('/api/queues'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralLink, name, users, parallel, selectedDomains, selectedProxies })
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Fila criada:', data.queueId);
        
        // Limpar formulário
        document.getElementById('queueReferralLink').value = '';
        document.getElementById('queueName').value = '';
        document.getElementById('queueUsers').value = '3';
        document.getElementById('queueParallel').value = '1';
        
        this.hideCreateQueueModal();
        this.socket.emit('request:queues');
      } else {
        alert('Erro ao criar fila: ' + data.error);
      }
    } catch (error) {
      console.error('Erro ao criar fila:', error);
      alert('Erro ao criar fila');
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
        alert('Erro ao iniciar fila: ' + data.error);
      }
    } catch (error) {
      console.error('Erro ao iniciar fila:', error);
      alert('Erro ao iniciar fila');
    }
  }

  async stopQueue(queueId) {
    if (!confirm('Tem certeza que deseja parar esta fila?')) return;

    try {
      const response = await fetch(this.apiUrl(`/api/queues/${queueId}/stop`), {
        method: 'POST'
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Fila parada:', queueId);
        this.socket.emit('request:queues');
        alert('Fila será parada (execuções em andamento continuarão até finalizar)');
      } else {
        alert('Erro ao parar fila: ' + data.error);
      }
    } catch (error) {
      console.error('Erro ao parar fila:', error);
      alert('Erro ao parar fila');
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
        alert('Erro ao adicionar domínio: ' + data.error);
      }
    } catch (error) {
      console.error('Erro ao adicionar domínio:', error);
      alert('Erro ao adicionar domínio');
    }
  }

  async removeDomain(domain) {
    if (!confirm(`Remover domínio ${domain}?`)) return;

    try {
      const response = await fetch(this.apiUrl(`/api/domains/${encodeURIComponent(domain)}`), {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Domínio removido:', domain);
        this.socket.emit('request:domains');
      } else {
        alert('Erro ao remover domínio: ' + data.error);
      }
    } catch (error) {
      console.error('Erro ao remover domínio:', error);
      alert('Erro ao remover domínio');
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
        alert('Índice de alternância resetado!');
      } else {
        alert('Erro ao resetar índice: ' + data.error);
      }
    } catch (error) {
      console.error('Erro ao resetar índice:', error);
      alert('Erro ao resetar índice');
    }
  }

  // Modal Controls
  showCreateQueueModal() {
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
