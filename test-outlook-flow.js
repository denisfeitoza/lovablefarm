#!/usr/bin/env node

/**
 * 🧪 Teste Completo - Fluxo Outlook
 * 
 * Testa o fluxo completo: criar conta no Lovable -> login Outlook -> buscar email -> verificar
 */

import { executeUserFlow } from './src/automation/userFlow.js';
import { logger } from './src/utils/logger.js';

async function main() {
  console.clear();
  console.log('🧪 TESTE COMPLETO - FLUXO OUTLOOK\n');
  console.log('='.repeat(60));
  console.log('🔗 Link: https://lovable.dev/invite/CV10B39');
  console.log('📧 Modo: Outlook (credenciais reais)');
  console.log('='.repeat(60));
  console.log('\n🚀 Iniciando teste...\n');
  
  try {
    const result = await executeUserFlow(
      1, // userId
      'https://lovable.dev/invite/CV10B39', // referralLink
      null, // domain
      null, // proxyString
      [], // simulatedErrors
      false, // turboMode
      false, // checkCreditsBanner
      false, // enableConcurrentRequests
      100, // concurrentRequests
      true // useOutlook = true
    );
    
    console.log('\n' + '='.repeat(60));
    if (result.success) {
      console.log('✅ TESTE CONCLUÍDO COM SUCESSO!');
      console.log(`📧 Email usado: ${result.email}`);
      console.log(`⏱️  Tempo total: ${(result.executionTime / 1000).toFixed(2)}s`);
      if (result.creditsEarned) {
        console.log(`💰 Créditos: ${result.creditsEarned}`);
      }
    } else {
      console.log('❌ TESTE FALHOU');
      console.log(`❌ Erro: ${result.error}`);
      if (result.failedStep) {
        console.log(`📍 Etapa que falhou: ${result.failedStep}`);
      }
    }
    console.log('='.repeat(60));
    
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Erro fatal:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();


