import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class ProxyService {
  constructor() {
    this.proxies = [];
    this.webshareProxies = []; // Proxies do arquivo Webshare
    this.currentIndex = 0;
    this.usedProxies = new Map(); // proxy -> count
    this.initialized = false;
    this.proxyFile = path.join(__dirname, '../../config/proxies.txt');
  }

  /**
   * Inicializa a lista de proxies
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Sempre carregar proxies do arquivo Webshare se existir
      await this.loadWebshareProxies();

      if (!config.proxyEnabled) {
        logger.info('Rotação de proxy desabilitada - usando IP local');
        this.initialized = true;
        return;
      }

      // Carregar proxies de URL se configurado
      if (config.proxyListUrl) {
        await this.loadProxiesFromUrl(config.proxyListUrl);
      }

      // Adicionar proxies da lista manual
      if (config.proxyList && config.proxyList.length > 0) {
        this.proxies.push(...config.proxyList);
      }

      // Se não tiver proxies, usar lista de proxies públicos (fallback)
      if (this.proxies.length === 0 && this.webshareProxies.length === 0) {
        logger.warning('Nenhum proxy configurado - usando proxies públicos (não recomendado para produção)');
        this.proxies = await this.getFreeProxies();
      }

      logger.success(`${this.proxies.length + this.webshareProxies.length} proxies carregados`);
      this.initialized = true;
    } catch (error) {
      logger.error('Erro ao inicializar proxies', error);
      // Continuar sem proxies
      this.initialized = true;
    }
  }

  /**
   * Carrega proxies do arquivo Webshare (formato: IP:PORT:USER:PASS)
   */
  async loadWebshareProxies() {
    try {
      if (!fs.existsSync(this.proxyFile)) {
        logger.info('Arquivo de proxies não encontrado, continuando sem proxies do Webshare');
        return;
      }

      const content = fs.readFileSync(this.proxyFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        const parts = line.trim().split(':');
        if (parts.length === 4) {
          const [ip, port, username, password] = parts;
          // Converter para formato http://username:password@ip:port
          const proxyUrl = `http://${username}:${password}@${ip}:${port}`;
          this.webshareProxies.push(proxyUrl);
        }
      }

      logger.success(`✅ ${this.webshareProxies.length} proxies Webshare carregados`);
    } catch (error) {
      logger.error('Erro ao carregar proxies Webshare', error);
    }
  }

  /**
   * Obtém lista de proxies Webshare disponíveis
   */
  getWebshareProxies() {
    return [...this.webshareProxies];
  }

  /**
   * Carrega proxies de uma URL
   */
  async loadProxiesFromUrl(url) {
    try {
      const response = await axios.get(url, { timeout: 10000 });
      const proxies = response.data.split('\n').filter(p => p.trim());
      this.proxies.push(...proxies);
      logger.info(`${proxies.length} proxies carregados de ${url}`);
    } catch (error) {
      logger.error('Erro ao carregar proxies da URL', error);
    }
  }

  /**
   * Obtém lista de proxies públicos gratuitos (fallback)
   */
  async getFreeProxies() {
    try {
      // Lista de proxies públicos de exemplo
      // Em produção, use um serviço confiável de proxies
      return [
        'http://proxy1.example.com:8080',
        'http://proxy2.example.com:8080',
        'http://proxy3.example.com:8080'
      ];
    } catch (error) {
      logger.error('Erro ao obter proxies gratuitos', error);
      return [];
    }
  }

  /**
   * Obtém próximo proxy da lista (rotação round-robin)
   */
  getNextProxy() {
    if (!config.proxyEnabled || this.proxies.length === 0) {
      return null;
    }

    const proxy = this.proxies[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.proxies.length;

    // Registrar uso
    const count = this.usedProxies.get(proxy) || 0;
    this.usedProxies.set(proxy, count + 1);

    logger.info('Proxy selecionado', { proxy, timesUsed: count + 1 });
    return proxy;
  }

  /**
   * Obtém proxy aleatório (melhor para distribuição)
   */
  getRandomProxy() {
    if (!config.proxyEnabled || this.proxies.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * this.proxies.length);
    const proxy = this.proxies[randomIndex];

    // Registrar uso
    const count = this.usedProxies.get(proxy) || 0;
    this.usedProxies.set(proxy, count + 1);

    logger.info('Proxy aleatório selecionado', { proxy, timesUsed: count + 1 });
    return proxy;
  }

  /**
   * Converte proxy string para configuração do Playwright
   */
  getProxyConfig(proxyString) {
    if (!proxyString) return null;

    try {
      const url = new URL(proxyString);
      
      const proxyConfig = {
        server: `${url.protocol}//${url.hostname}:${url.port}`,
      };

      // Adicionar autenticação se presente
      if (url.username && url.password) {
        proxyConfig.username = decodeURIComponent(url.username);
        proxyConfig.password = decodeURIComponent(url.password);
      }

      return proxyConfig;
    } catch (error) {
      logger.error('Erro ao parsear proxy', error);
      return null;
    }
  }

  /**
   * Obtém proxy de uma lista específica (para uso por fila)
   * @param {string[]} proxyList - Lista de proxies para escolher
   * @param {number} index - Índice para round-robin
   */
  getProxyFromList(proxyList, index = 0) {
    if (!proxyList || proxyList.length === 0) {
      return null;
    }

    const proxy = proxyList[index % proxyList.length];
    return proxy;
  }

  /**
   * Testa se um proxy está funcionando
   */
  async testProxy(proxyString) {
    try {
      const proxyConfig = this.getProxyConfig(proxyString);
      if (!proxyConfig) return false;

      // Fazer requisição de teste através do proxy
      const response = await axios.get('https://api.ipify.org?format=json', {
        proxy: {
          protocol: new URL(proxyString).protocol.replace(':', ''),
          host: new URL(proxyString).hostname,
          port: parseInt(new URL(proxyString).port)
        },
        timeout: 5000
      });

      logger.success('Proxy funcionando', { proxy: proxyString, ip: response.data.ip });
      return true;
    } catch (error) {
      logger.warning('Proxy não está funcionando', { proxy: proxyString });
      return false;
    }
  }

  /**
   * Remove proxies que não estão funcionando
   */
  async validateProxies() {
    if (this.proxies.length === 0) return;

    logger.info('Validando proxies...');
    const validProxies = [];

    for (const proxy of this.proxies) {
      const isValid = await this.testProxy(proxy);
      if (isValid) {
        validProxies.push(proxy);
      }
    }

    this.proxies = validProxies;
    logger.success(`${validProxies.length}/${this.proxies.length} proxies válidos`);
  }

  /**
   * Obtém estatísticas de uso de proxies
   */
  getStats() {
    const stats = {
      totalProxies: this.proxies.length,
      proxyEnabled: config.proxyEnabled,
      usageDistribution: {}
    };

    for (const [proxy, count] of this.usedProxies.entries()) {
      stats.usageDistribution[proxy] = count;
    }

    return stats;
  }

  /**
   * Reseta estatísticas
   */
  reset() {
    this.currentIndex = 0;
    this.usedProxies.clear();
  }
}

export const proxyService = new ProxyService();

