#!/usr/bin/env node

/**
 * 🧪 Script de Teste Interativo
 * 
 * Modo DEBUG com screenshots, logs detalhados e ajuda quando travar
 */

import readline from 'readline';
import { executeUserFlow } from './src/automation/userFlow.js';
import { logger } from './src/utils/logger.js';
import { config } from './src/utils/config.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.clear();
  console.log('════════════════════════════════════════════════════════');
  console.log('        🧪 LOVABLE REFERRAL TESTER - MODO DEBUG        ');
  console.log('════════════════════════════════════════════════════════\n');

  // 1. Pedir link de indicação
  const referralLink = await question('📎 Link de indicação (ex: https://lovable.dev/invite/FDKI2B1): ');
  
  if (!referralLink || !referralLink.includes('lovable.dev')) {
    console.log('❌ Link inválido! Deve ser um link da Lovable.');
    rl.close();
    return;
  }

  // 2. Pedir número de indicações
  const numUsers = await question('\n👥 Quantas indicações deseja testar? (cada uma = 10 créditos): ');
  const totalUsers = parseInt(numUsers);

  if (isNaN(totalUsers) || totalUsers < 1) {
    console.log('❌ Número inválido!');
    rl.close();
    return;
  }

  // Calcular créditos totais
  const totalCredits = totalUsers * 10;

  console.log('\n════════════════════════════════════════════════════════');
  console.log('📋 RESUMO DO TESTE:');
  console.log('────────────────────────────────────────────────────────');
  console.log(`📎 Link: ${referralLink}`);
  console.log(`👥 Indicações: ${totalUsers}`);
  console.log(`💰 Créditos esperados: ${totalCredits}`);
  console.log('🐛 Modo DEBUG: ATIVADO (screenshots + logs detalhados)');
  console.log('⚡ Script Injection: ATIVADO (mais rápido)');
  console.log('🔍 Sistema de Ajuda: ATIVADO');
  console.log('════════════════════════════════════════════════════════\n');

  const continuar = await question('▶️  Continuar? (s/n): ');
  
  if (continuar.toLowerCase() !== 's') {
    console.log('❌ Teste cancelado.');
    rl.close();
    return;
  }

  rl.close();

  console.log('\n🚀 Iniciando testes...\n');

  // Configurar ambiente de teste
  process.env.REFERRAL_LINK = referralLink;
  process.env.HEADLESS = 'false'; // Modo visual para debug
  process.env.DEBUG_MODE = 'true'; // Ativar modo debug
  process.env.SCRIPT_INJECTION = 'true'; // Usar script injection

  const results = {
    success: 0,
    failures: 0,
    errors: [],
    totalTime: 0
  };

  // Executar testes sequencialmente (um por vez para debug)
  for (let i = 1; i <= totalUsers; i++) {
    console.log('\n════════════════════════════════════════════════════════');
    console.log(`🚀 TESTANDO INDICAÇÃO ${i}/${totalUsers}`);
    console.log('════════════════════════════════════════════════════════\n');

    const startTime = Date.now();

    try {
      const result = await executeUserFlow(i, null);
      
      if (result.success) {
        results.success++;
        const timeSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n✅ Indicação ${i} concluída com sucesso! (${timeSeconds}s)`);
        console.log(`💰 +10 créditos gerados`);
        results.totalTime += (Date.now() - startTime);
      } else {
        results.failures++;
        results.errors.push({
          user: i,
          error: result.error,
          step: result.failedStep
        });
        console.log(`\n❌ Indicação ${i} falhou: ${result.error}`);
        console.log(`📍 Etapa que falhou: ${result.failedStep}`);
        console.log(`📸 Screenshot salvo em: reports/error-user-${i}-*.png`);
        
        // Perguntar se deve continuar
        const readline2 = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const continueTest = await new Promise(resolve => {
          readline2.question('\n⚠️  Erro encontrado! Continuar testando próxima indicação? (s/n): ', answer => {
            readline2.close();
            resolve(answer);
          });
        });

        if (continueTest.toLowerCase() !== 's') {
          console.log('\n⏸️  Testes pausados pelo usuário.');
          break;
        }
      }
    } catch (error) {
      results.failures++;
      results.errors.push({
        user: i,
        error: error.message,
        step: 'unknown'
      });
      console.log(`\n❌ Erro crítico na indicação ${i}: ${error.message}`);
    }

    // Aguardar um pouco entre testes
    if (i < totalUsers) {
      console.log('\n⏳ Aguardando 3 segundos antes da próxima indicação...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // Relatório final
  console.log('\n\n════════════════════════════════════════════════════════');
  console.log('           📊 RELATÓRIO FINAL DE TESTES');
  console.log('════════════════════════════════════════════════════════\n');
  console.log(`✅ Sucessos: ${results.success}/${totalUsers}`);
  console.log(`❌ Falhas: ${results.failures}/${totalUsers}`);
  console.log(`📈 Taxa de sucesso: ${((results.success / totalUsers) * 100).toFixed(2)}%`);
  console.log(`💰 Créditos gerados: ${results.success * 10}/${totalCredits}`);
  
  if (results.success > 0) {
    const avgTime = (results.totalTime / results.success / 1000).toFixed(2);
    console.log(`⏱️  Tempo médio por indicação: ${avgTime}s`);
  }

  if (results.errors.length > 0) {
    console.log('\n❌ ERROS ENCONTRADOS:\n');
    results.errors.forEach((err, idx) => {
      console.log(`${idx + 1}. Indicação ${err.user}:`);
      console.log(`   Etapa: ${err.step}`);
      console.log(`   Erro: ${err.error}\n`);
    });

    console.log('\n💡 DICAS PARA CORRIGIR:');
    console.log('1. Verifique os screenshots em reports/error-*.png');
    console.log('2. Veja os logs detalhados acima');
    console.log('3. Se precisar de ajuda, me mostre o screenshot do erro');
    console.log('4. Posso ajustar os seletores CSS se necessário');
  }

  console.log('\n════════════════════════════════════════════════════════\n');
  process.exit(results.failures > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('\n❌ Erro fatal:', error);
  process.exit(1);
});

