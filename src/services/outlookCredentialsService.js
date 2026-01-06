import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Serviço para gerenciar credenciais do Outlook (emails e senhas)
 */
class OutlookCredentialsService {
  constructor() {
    this.dataDir = path.join(__dirname, '../../data');
    this.credentialsPath = path.join(this.dataDir, 'outlook_credentials.json');
    
    // Garantir que o diretório existe
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    // Inicializar arquivo se não existir
    this.initializeFile();
  }

  /**
   * Inicializa o arquivo de credenciais se não existir
   */
  initializeFile() {
    if (!fs.existsSync(this.credentialsPath)) {
      const initialData = {
        credentials: [],
        lastUpdated: new Date().toISOString()
      };
      fs.writeFileSync(this.credentialsPath, JSON.stringify(initialData, null, 2), 'utf8');
      logger.info('📝 Arquivo de credenciais Outlook criado');
    }
  }

  /**
   * Carrega credenciais do arquivo
   */
  loadCredentials() {
    try {
      const data = fs.readFileSync(this.credentialsPath, 'utf8');
      const parsed = JSON.parse(data);
      return parsed.credentials || [];
    } catch (error) {
      logger.error('Erro ao carregar credenciais Outlook', error);
      return [];
    }
  }

  /**
   * Salva credenciais no arquivo
   */
  saveCredentials(credentials) {
    try {
      const data = {
        credentials: credentials,
        lastUpdated: new Date().toISOString()
      };
      fs.writeFileSync(this.credentialsPath, JSON.stringify(data, null, 2), 'utf8');
      logger.info(`💾 ${credentials.length} credenciais Outlook salvas`);
      return true;
    } catch (error) {
      logger.error('Erro ao salvar credenciais Outlook', error);
      return false;
    }
  }

  /**
   * Adiciona uma credencial
   */
  addCredential(email, password) {
    const credentials = this.loadCredentials();
    
    // Verificar se já existe
    const exists = credentials.find(c => c.email === email);
    if (exists) {
      return { success: false, error: 'Email já existe na lista' };
    }
    
    credentials.push({
      email: email.trim(),
      password: password.trim(),
      addedAt: new Date().toISOString(),
      used: false,
      usedAt: null
    });
    
    const saved = this.saveCredentials(credentials);
    return { success: saved, credential: credentials[credentials.length - 1] };
  }

  /**
   * Adiciona múltiplas credenciais
   */
  addCredentials(credentialsList) {
    const current = this.loadCredentials();
    const existingEmails = new Set(current.map(c => c.email.toLowerCase()));
    
    const newCredentials = [];
    const duplicates = [];
    
    for (const cred of credentialsList) {
      const emailLower = cred.email.toLowerCase();
      if (existingEmails.has(emailLower)) {
        duplicates.push(cred.email);
        continue;
      }
      
      existingEmails.add(emailLower);
      newCredentials.push({
        email: cred.email.trim(),
        password: cred.password.trim(),
        addedAt: new Date().toISOString(),
        used: false,
        usedAt: null
      });
    }
    
    const allCredentials = [...current, ...newCredentials];
    const saved = this.saveCredentials(allCredentials);
    
    return {
      success: saved,
      added: newCredentials.length,
      duplicates: duplicates.length,
      duplicatesList: duplicates
    };
  }

  /**
   * Remove uma credencial
   */
  removeCredential(email) {
    const credentials = this.loadCredentials();
    const filtered = credentials.filter(c => c.email !== email);
    
    if (filtered.length === credentials.length) {
      return { success: false, error: 'Credencial não encontrada' };
    }
    
    const saved = this.saveCredentials(filtered);
    return { success: saved, removed: credentials.length - filtered.length };
  }

  /**
   * Remove múltiplas credenciais
   */
  removeCredentials(emails) {
    const credentials = this.loadCredentials();
    const emailSet = new Set(emails);
    const filtered = credentials.filter(c => !emailSet.has(c.email));
    
    const saved = this.saveCredentials(filtered);
    return {
      success: saved,
      removed: credentials.length - filtered.length
    };
  }

  /**
   * Marca credencial como usada
   */
  markAsUsed(email) {
    const credentials = this.loadCredentials();
    const credential = credentials.find(c => c.email === email);
    
    if (!credential) {
      return { success: false, error: 'Credencial não encontrada' };
    }
    
    credential.used = true;
    credential.usedAt = new Date().toISOString();
    
    const saved = this.saveCredentials(credentials);
    return { success: saved };
  }

  /**
   * Alterna status "used" de uma credencial (marca como usada ou não usada)
   */
  toggleUsedStatus(email) {
    const credentials = this.loadCredentials();
    const credential = credentials.find(c => c.email === email);
    
    if (!credential) {
      return { success: false, error: 'Credencial não encontrada' };
    }
    
    credential.used = !credential.used;
    if (credential.used) {
      credential.usedAt = new Date().toISOString();
    } else {
      credential.usedAt = null;
    }
    
    const saved = this.saveCredentials(credentials);
    return { success: saved, used: credential.used };
  }

  /**
   * Reseta status "used" de todas as credenciais (para testes)
   */
  resetUsedStatus() {
    const credentials = this.loadCredentials();
    credentials.forEach(c => {
      c.used = false;
      c.usedAt = null;
    });
    const saved = this.saveCredentials(credentials);
    return { success: saved, reset: credentials.length };
  }

  /**
   * Obtém próxima credencial não usada
   */
  getNextUnusedCredential() {
    const credentials = this.loadCredentials();
    const unused = credentials.find(c => !c.used);
    return unused || null;
  }

  /**
   * Obtém estatísticas
   */
  getStats() {
    const credentials = this.loadCredentials();
    return {
      total: credentials.length,
      used: credentials.filter(c => c.used).length,
      unused: credentials.filter(c => !c.used).length
    };
  }

  /**
   * Limpa todas as credenciais
   */
  clearAll() {
    const saved = this.saveCredentials([]);
    return { success: saved };
  }
}

// Singleton
export const outlookCredentialsService = new OutlookCredentialsService();

