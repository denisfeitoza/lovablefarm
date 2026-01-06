const btnAtivar = document.getElementById('btnAtivar');
const btnCancelar = document.getElementById('btnCancelar');
const creditosInput = document.getElementById('creditos');
const statusDiv = document.getElementById('status');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const statSuccess = document.getElementById('statSuccess');
const statFail = document.getElementById('statFail');
const statCredits = document.getElementById('statCredits');

// ========================================
// VERIFICAR STATUS AO ABRIR POPUP
// ========================================
function verificarStatus() {
  chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
    if (!response) return;
    
    if (response.multiplicando && response.progresso) {
      mostrarProgresso(response.progresso);
    } else if (response.config && response.config.ativo) {
      mostrarAguardando(response.config.creditosDesejados);
    }
  });
  
  chrome.storage.local.get(['config', 'progresso'], (data) => {
    if (data.progresso && data.progresso.completadas < data.progresso.total) {
      mostrarProgresso(data.progresso);
    } else if (data.config && data.config.ativo) {
      mostrarAguardando(data.config.creditosDesejados);
    }
  });
}

function mostrarAguardando(creditos) {
  creditosInput.value = creditos;
  creditosInput.disabled = true;
  btnAtivar.style.display = 'none';
  btnCancelar.style.display = 'block';
  statusDiv.className = 'status aguardando';
  statusDiv.textContent = '⏳ Aguardando... Clique em Publish na Lovable!';
  statusDiv.style.display = 'block';
}

function mostrarProgresso(progresso) {
  creditosInput.disabled = true;
  btnAtivar.style.display = 'none';
  btnCancelar.style.display = 'none';
  
  statusDiv.className = 'status multiplicando';
  statusDiv.textContent = `🚀 Multiplicando... ${progresso.completadas}/${progresso.total}`;
  statusDiv.style.display = 'block';
  
  progressContainer.style.display = 'block';
  
  const percentual = (progresso.completadas / progresso.total) * 100;
  progressFill.style.width = percentual + '%';
  
  statSuccess.textContent = progresso.sucessos;
  statFail.textContent = progresso.falhas;
  statCredits.textContent = (progresso.sucessos + 1) * 10;
}

verificarStatus();

// ========================================
// ATIVAR MULTIPLICADOR
// ========================================
btnAtivar.addEventListener('click', () => {
  const creditos = parseInt(creditosInput.value);
  
  if (!creditos || creditos < 10 || creditos % 10 !== 0) {
    alert('❌ Digite um múltiplo de 10 (ex: 150, 1000)');
    return;
  }
  
  chrome.runtime.sendMessage({
    action: 'ativar',
    creditos: creditos
  }, (response) => {
    if (response && response.success) {
      creditosInput.disabled = true;
      btnAtivar.style.display = 'none';
      btnCancelar.style.display = 'block';
    }
  });
});

// ========================================
// CANCELAR MULTIPLICADOR
// ========================================
btnCancelar.addEventListener('click', () => {
  chrome.runtime.sendMessage({
    action: 'cancelar'
  }, (response) => {
    if (response && response.success) {
      creditosInput.disabled = false;
      btnAtivar.style.display = 'block';
      btnCancelar.style.display = 'none';
      progressContainer.style.display = 'none';
      statusDiv.className = 'status cancelado';
      statusDiv.textContent = '❌ Multiplicador cancelado';
      statusDiv.style.display = 'block';
      
      setTimeout(() => {
        statusDiv.style.display = 'none';
      }, 3000);
    }
  });
});

// ========================================
// RECEBER ATUALIZAÇÕES EM TEMPO REAL
// ========================================
chrome.runtime.onMessage.addListener((message) => {
  
  if (message.action === 'statusUpdate') {
    if (message.status === 'aguardando') {
      statusDiv.className = 'status aguardando';
      statusDiv.textContent = '⏳ Aguardando... Clique em Publish na Lovable!';
      statusDiv.style.display = 'block';
      creditosInput.disabled = true;
      btnAtivar.style.display = 'none';
      btnCancelar.style.display = 'block';
    }
    else if (message.status === 'multiplicando') {
      statusDiv.className = 'status multiplicando';
      statusDiv.textContent = '🚀 MULTIPLICANDO AGORA! Aguarde...';
      progressContainer.style.display = 'block';
      btnCancelar.style.display = 'none';
      
      statSuccess.textContent = '0';
      statFail.textContent = '0';
      statCredits.textContent = '10';
      progressFill.style.width = '0%';
    }
  }
  
  else if (message.action === 'progresso') {
    const progresso = (message.completadas / message.total) * 100;
    progressFill.style.width = progresso + '%';
    statSuccess.textContent = message.sucessos;
    statFail.textContent = message.falhas;
    statCredits.textContent = (message.sucessos + 1) * 10;
    
    statusDiv.textContent = `🚀 Multiplicando... ${message.completadas}/${message.total}`;
  }
  
  else if (message.action === 'concluido') {
    statusDiv.className = 'status concluido';
    statusDiv.textContent = `🎉 CONCLUÍDO! ${message.creditos} créditos ganhos!`;
    
    progressFill.style.width = '100%';
    
    creditosInput.disabled = false;
    btnAtivar.style.display = 'block';
    btnCancelar.style.display = 'none';
    
    setTimeout(() => {
      statusDiv.style.display = 'none';
      progressContainer.style.display = 'none';
      statSuccess.textContent = '0';
      statFail.textContent = '0';
      statCredits.textContent = '0';
      progressFill.style.width = '0%';
    }, 8000);
  }
});
