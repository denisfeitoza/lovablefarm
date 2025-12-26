/**
 * Utilitário para calcular timeouts baseados em uso de proxy
 * Proxies são mais lentos, então precisam de timeouts maiores
 */

/**
 * Calcula timeout baseado em se está usando proxy
 * @param {number} baseTimeout - Timeout base em milissegundos
 * @param {boolean} usingProxy - Se está usando proxy
 * @returns {number} - Timeout ajustado
 */
export function getTimeout(baseTimeout, usingProxy = false) {
  if (usingProxy) {
    // Com proxy: aumentar 3x o timeout base
    return baseTimeout * 3;
  }
  return baseTimeout;
}

/**
 * Calcula delay baseado em se está usando proxy
 * @param {number} baseDelay - Delay base em milissegundos
 * @param {boolean} usingProxy - Se está usando proxy
 * @returns {number} - Delay ajustado
 */
export function getDelay(baseDelay, usingProxy = false) {
  if (usingProxy) {
    // Com proxy: aumentar 2x o delay base
    return baseDelay * 2;
  }
  return baseDelay;
}

/**
 * Timeouts padrão para diferentes operações
 */
export const DEFAULT_TIMEOUTS = {
  // Navegação
  pageLoad: 30000,        // 30s base, 90s com proxy
  pageNavigation: 30000,  // 30s base, 90s com proxy
  
  // Elementos
  elementVisible: 15000,  // 15s base, 45s com proxy
  elementClickable: 10000, // 10s base, 30s com proxy
  elementWait: 5000,      // 5s base, 15s com proxy
  
  // Ações
  actionDelay: 2000,     // 2s base, 4s com proxy
  shortDelay: 1000,       // 1s base, 2s com proxy
  mediumDelay: 3000,      // 3s base, 6s com proxy
  longDelay: 5000,        // 5s base, 10s com proxy
  veryLongDelay: 10000,   // 10s base, 20s com proxy
};

