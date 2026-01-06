let config = {
  ativo: false,
  creditosDesejados: 0
};

let multiplicacaoEmAndamento = false;
let progressoAtual = {
  sucessos: 0,
  falhas: 0,
  completadas: 0,
  total: 0
};

let keepAliveInterval = null;

function manterAtivo() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }
  
  keepAliveInterval = setInterval(() => {
    console.log('🔄 Service Worker mantendo-se ativo...', new Date().toLocaleTimeString());
    
    chrome.runtime.sendMessage({
      action: 'keepAlive'
    }).catch(() => {});
  }, 20000);
}

function pararKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
    console.log('⏸️ Keep alive parado');
  }
}

chrome.storage.local.get(['config', 'progresso'], (data) => {
  if (data.config && data.config.ativo) {
    config = data.config;
    console.log('✅ Estado restaurado:', config);
    manterAtivo();
  }
  
  if (data.progresso) {
    progressoAtual = data.progresso;
    multiplicacaoEmAndamento = true;
    console.log('✅ Progresso restaurado:', progressoAtual);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'ativar') {
    config.ativo = true;
    config.creditosDesejados = message.creditos;
    
    chrome.storage.local.set({ config: config }, () => {
      console.log('💾 Configuração salva:', config);
    });
    
    manterAtivo();
    
    console.log(`✅ ATIVADO! Esperando publish para ${message.creditos} créditos...`);
    console.log('⏰ Hora da ativação:', new Date().toLocaleTimeString());
    
    chrome.runtime.sendMessage({
      action: 'statusUpdate',
      status: 'aguardando'
    }).catch(() => {});
    
    sendResponse({ success: true });
  }
  
  else if (message.action === 'cancelar') {
    console.log('❌ Cancelamento solicitado pelo usuário');
    
    config.ativo = false;
    config.creditosDesejados = 0;
    multiplicacaoEmAndamento = false;
    
    chrome.storage.local.remove(['config', 'progresso'], () => {
      console.log('🗑️ Configuração e progresso removidos');
    });
    
    pararKeepAlive();
    
    console.log('✅ Multiplicador cancelado com sucesso');
    
    sendResponse({ success: true });
  }
  
  else if (message.action === 'getStatus') {
    sendResponse({ 
      config: config,
      multiplicando: multiplicacaoEmAndamento,
      progresso: progressoAtual
    });
  }
  
  return true;
});

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    
    console.log('📡 Requisição detectada:', details.method, details.url);
    
    if (config.ativo && 
        details.method === 'POST' &&
        details.url.includes('/deployments?async=true')) {
      
      console.log('🎯 PUBLISH DETECTADO!');
      console.log('⏰ Hora da interceptação:', new Date().toLocaleTimeString());
      
      const projectId = details.url.match(/projects\/([^\/]+)/)[1];
      let token = null;
      
      details.requestHeaders.forEach(header => {
        if (header.name.toLowerCase() === 'authorization') {
          token = header.value;
        }
      });
      
      console.log('📦 Project ID:', projectId);
      console.log('🔑 Token:', token ? 'CAPTURADO ✅' : 'NÃO ENCONTRADO ❌');
      
      if (!token) {
        console.error('❌ TOKEN NÃO ENCONTRADO! Abortando...');
        return { requestHeaders: details.requestHeaders };
      }
      
      const totalPublicacoes = config.creditosDesejados / 10;
      const requisicoesAdicionais = totalPublicacoes - 1;
      
      console.log(`🚀 Iniciando ${requisicoesAdicionais} requisições adicionais...`);
      
      multiplicarAgora(projectId, token, requisicoesAdicionais);
      
      config.ativo = false;
      chrome.storage.local.remove('config');
      pararKeepAlive();
      
      console.log('✅ Multiplicação iniciada, aguardando conclusão...');
    }
    
    return { requestHeaders: details.requestHeaders };
  },
  { urls: ["https://api.lovable.dev/*"] },
  ["requestHeaders", "extraHeaders"]
);

function multiplicarAgora(projectId, token, quantidade) {
  
  console.log(`⚡ Disparando ${quantidade} requisições...`);
  
  multiplicacaoEmAndamento = true;
  
  progressoAtual = {
    sucessos: 0,
    falhas: 0,
    completadas: 0,
    total: quantidade
  };
  
  chrome.storage.local.set({ progresso: progressoAtual });
  
  const inicioTimestamp = Date.now();
  
  chrome.runtime.sendMessage({
    action: 'statusUpdate',
    status: 'multiplicando'
  }).catch(() => {});
  
  for (let i = 0; i < quantidade; i++) {
    
    const requisicaoNumero = i + 1;
    
    fetch(`https://api.lovable.dev/projects/${projectId}/deployments?async=true`, {
      method: 'POST',
      headers: {
        'accept': '*/*',
        'accept-language': 'pt-BR,pt;q=0.9',
        'authorization': token,
        'content-type': 'application/json',
        'origin': 'https://lovable.dev',
        'referer': 'https://lovable.dev/',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site'
      },
      credentials: 'include'
    })
    .then(res => {
      progressoAtual.completadas++;
      
      if (res.ok) {
        progressoAtual.sucessos++;
        console.log(`✅ Requisição ${requisicaoNumero}: SUCESSO (${res.status})`);
      } else {
        progressoAtual.falhas++;
        console.error(`❌ Requisição ${requisicaoNumero}: FALHA (${res.status})`);
      }
      
      chrome.storage.local.set({ progresso: progressoAtual });
      
      chrome.runtime.sendMessage({
        action: 'progresso',
        sucessos: progressoAtual.sucessos,
        falhas: progressoAtual.falhas,
        completadas: progressoAtual.completadas,
        total: quantidade
      }).catch(() => {});
      
      if (progressoAtual.completadas === quantidade) {
        const tempoTotal = Date.now() - inicioTimestamp;
        console.log(`🎉 TODAS CONCLUÍDAS em ${tempoTotal}ms`);
        console.log(`✅ Sucessos: ${progressoAtual.sucessos}`);
        console.log(`❌ Falhas: ${progressoAtual.falhas}`);
        console.log(`💰 Créditos: ${(progressoAtual.sucessos + 1) * 10}`);
        
        multiplicacaoEmAndamento = false;
        
        chrome.runtime.sendMessage({
          action: 'concluido',
          sucessos: progressoAtual.sucessos,
          falhas: progressoAtual.falhas,
          creditos: (progressoAtual.sucessos + 1) * 10
        }).catch(() => {});
        
        setTimeout(() => {
          chrome.storage.local.remove('progresso');
        }, 10000);
      }
    })
    .catch(err => {
      progressoAtual.completadas++;
      progressoAtual.falhas++;
      console.error(`❌ Requisição ${requisicaoNumero}: ERRO`, err);
      
      chrome.storage.local.set({ progresso: progressoAtual });
    });
  }
  
  console.log(`⚡ ${quantidade} requisições disparadas!`);
}

console.log('🚀 @vidall7x Credits Multiplier iniciado!', new Date().toLocaleTimeString());
