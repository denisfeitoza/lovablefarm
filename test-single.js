import { executeUserFlow } from './src/automation/userFlow.js';

// Teste único
const referralLink = 'https://lovable.dev/invite/AIS8RZC';
const domain = 'funcionarios.com'; // Domínio específico

console.log('🚀 Iniciando teste único...');
console.log('🔗 Link:', referralLink);
console.log('📧 Domínio:', domain);

executeUserFlow(1, referralLink, domain)
  .then(result => {
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESULTADO:');
    console.log('='.repeat(60));
    console.log('Sucesso:', result.success);
    console.log('Email:', result.email);
    console.log('Etapa que falhou:', result.failedStep || 'N/A');
    console.log('Erro:', result.error || 'N/A');
    console.log('='.repeat(60));
    
    if (!result.success) {
      console.log('\n⚠️ NAVEGADOR MANTIDO ABERTO PARA DEBUG');
      console.log('⚠️ Pressione Ctrl+C quando terminar');
    }
  })
  .catch(err => {
    console.error('❌ Erro fatal:', err);
  });
