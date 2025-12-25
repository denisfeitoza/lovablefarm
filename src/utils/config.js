import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

export const config = {
  // URLs
  lovableBaseUrl: process.env.LOVABLE_BASE_URL || 'https://lovable.dev',
  referralLink: process.env.REFERRAL_LINK || 'https://lovable.dev/invite/FDKI2B1',
  templateProjectUrl: process.env.TEMPLATE_PROJECT_URL || 'https://lovable.dev/dashboard/templates/websites/blog/perspective-lifestyle',
  
  // Lista de templates para rotação aleatória
  templateUrls: [
    'https://lovable.dev/dashboard/templates/websites/blog/perspective-lifestyle',
    'https://lovable.dev/dashboard/templates/websites/blog/vesper'
  ],

  // Email Service (Inbound.new)
  inboundApiKey: process.env.INBOUND_API_KEY || 'HfpFDyCTsdiWQPnJdsdDaxjfFkJvLfRbQkBbGQJzfZQXyUSGEpAvKuPoRamTbOVL',
  inboundDomain: process.env.INBOUND_DOMAIN || 'equipeartificial.com',

  // Proxy Configuration
  proxyEnabled: process.env.PROXY_ENABLED === 'true',
  proxyListUrl: process.env.PROXY_LIST_URL,
  proxyList: process.env.PROXY_LIST ? process.env.PROXY_LIST.split(',') : [],

  // Execution Settings
  maxConcurrentUsers: parseInt(process.env.MAX_CONCURRENT_USERS || '5'),
  delayBetweenActions: parseInt(process.env.DELAY_BETWEEN_ACTIONS_MS || '1000'),
  timeout: parseInt(process.env.TIMEOUT_MS || '60000'),

  // Browser Settings
  headless: process.env.HEADLESS !== 'false', // Default to true (headless)
  slowMo: parseInt(process.env.SLOW_MO || '0'),

  // Debug Mode
  debugMode: process.env.DEBUG_MODE === 'true',
  scriptInjection: process.env.SCRIPT_INJECTION === 'true'
};

export function validateConfig() {
  const errors = [];

  if (!config.referralLink) {
    errors.push('REFERRAL_LINK não configurado no .env');
  }

  if (!config.inboundApiKey) {
    errors.push('INBOUND_API_KEY não configurado no .env');
  }

  if (errors.length > 0) {
    throw new Error(`Erros de configuração:\n${errors.join('\n')}`);
  }
}

