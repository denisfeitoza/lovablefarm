/**
 * Lovable Referral Tester - Dashboard Frontend
 */

class App {
  constructor() {
    this.socket = null;
    this.queues = [];
    this.domains = {};
    this.stats = {};
    this.activeTimers = new Map(); // { executionId: interval }
    this.history = [];
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
    this.connectWebSocket();
    this.fetchDomains(); // Buscar domínios logo no início
    this.fetchHistory();
    // Iniciar loop de atualização dos timers
    setInterval(() => this.updateTimers(), 1000);
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

  // WebSocket Connection
  connectWebSocket() {
    const socketPath = this.basePath ? `${this.basePath}/socket.io/` : '/socket.io/';
    this.socket = io({
      path: socketPath
    });

    this.socket.on('connect', () => {
      console.log('✅ WebSocket conectado');
      this.updateConnectionStatus('connected');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ WebSocket desconectado');
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

  clearLogs() {
    document.getElementById('systemLogs').innerHTML = '';
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
    const users = parseInt(document.getElementById('queueUsers').value);
    const parallel = parseInt(document.getElementById('queueParallel').value);

    // Capturar domínios selecionados
    const selectedDomains = [];
    const checkboxes = document.querySelectorAll('#queueDomainSelection input[type="checkbox"]:checked');
    checkboxes.forEach(cb => selectedDomains.push(cb.value));

    console.log('📧 Domínios selecionados:', selectedDomains);
    console.log('📋 Total de checkboxes encontrados:', document.querySelectorAll('#queueDomainSelection input[type="checkbox"]').length);
    console.log('✅ Total de checkboxes marcados:', checkboxes.length);

    // Validar link de indicação
    if (!referralLink) {
      alert('Link de indicação é obrigatório');
      return;
    }
    
    // Validar seleção de domínios (sem confirmação)
    if (selectedDomains.length === 0) {
      console.log('⚠️ Nenhum domínio selecionado. Usando rotação global.');
    }

    try {
      const response = await fetch(this.apiUrl('/api/queues'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralLink, name, users, parallel, selectedDomains })
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
    
    document.getElementById('createQueueModal').classList.add('active');
    
    // Pequeno delay para garantir que os domínios foram atualizados
    setTimeout(() => {
      this.renderQueueDomainSelection();
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
