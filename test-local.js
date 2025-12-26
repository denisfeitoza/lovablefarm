#!/usr/bin/env node

/**
 * 🧪 Script de Teste Local - Detecção de Notificação de Domínio Cansado
 * 
 * Testa o fluxo completo com 1 usuário e verifica se detecta
 * a notificação "Email address not eligible for referral program"
 */

// Forçar modo não-headless para ver o navegador
process.env.HEADLESS = 'false';

import { executeUserFlow } from './src/automation/userFlow.js';
import { logger } from './src/utils/logger.js';

// Configuração do teste
const referralLink = process.env.REFERRAL_LINK || 'https://lovable.dev/invite/FDKI2B1';
const domain = process.argv[2] || null; // Pode passar domínio como argumento: node test-local.js funcionariosdeia.com

console.log('\n' + '═'.repeat(60));
console.log('🧪 TESTE LOCAL - Detecção de Domínio Cansado');
console.log('═'.repeat(60));
console.log(`🔗 Link: ${referralLink}`);
if (domain) {
  console.log(`📧 Domínio específico: ${domain}`);
} else {
  console.log(`📧 Domínio: Rotação automática`);
}
console.log('═'.repeat(60) + '\n');

// Executar teste
executeUserFlow(1, referralLink, domain)
  .then(result => {
    console.log('\n' + '═'.repeat(60));
    console.log('📊 RESULTADO DO TESTE:');
    console.log('═'.repeat(60));
    console.log(`✅ Sucesso: ${result.success ? 'SIM' : 'NÃO'}`);
    console.log(`📧 Email usado: ${result.email || result.credentials?.email || 'N/A'}`);
    
    if (result.success) {
      console.log(`💰 Créditos gerados: ${result.creditsEarned || 0}`);
      console.log(`⏱️  Tempo total: ${result.executionTime}ms`);
      console.log('\n✅ TESTE CONCLUÍDO COM SUCESSO!');
    } else {
      console.log(`❌ Etapa que falhou: ${result.failedStep || 'N/A'}`);
      console.log(`❌ Erro: ${result.error || 'N/A'}`);
      
      // Verificar se foi erro de domínio não elegível
      if (result.error && (
        result.error.includes('Domínio não elegível') ||
        result.error.includes('not eligible') ||
        result.error.includes('email_error')
      )) {
        console.log('\n🔍 DETECÇÃO DE DOMÍNIO CANSADO:');
        console.log('✅ A notificação foi detectada corretamente!');
        console.log('✅ O erro será contabilizado no dashboard como erro de domínio.');
      }
      
      console.log('\n⚠️  TESTE FALHOU - Verifique os logs acima');
    }
    
    console.log('═'.repeat(60) + '\n');
    process.exit(result.success ? 0 : 1);
  })
  .catch(err => {
    console.error('\n❌ ERRO FATAL:', err.message);
    console.error(err.stack);
    process.exit(1);
  });

