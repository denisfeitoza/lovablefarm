import { executeUserFlow } from './src/automation/userFlow.js';

// Teste REAL com modo incógnito
const referralLink = 'https://lovable.dev/invite/AIS8RZC';
const domain = 'equipeartificial.com';

console.log('🚀 Testando modo INCÓGNITO REAL...');
console.log('🔗 Link:', referralLink);
console.log('📧 Domínio:', domain);
console.log('');

executeUserFlow(1, referralLink, domain)
  .then(result => {
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESULTADO:');
    console.log('='.repeat(60));
    console.log('✅ Sucesso:', result.success);
    console.log('📧 Email:', result.email);
    console.log('🔑 Senha:', result.credentials?.password);
    console.log('❌ Etapa que falhou:', result.failedStep || 'N/A');
    console.log('⚠️  Erro:', result.error || 'N/A');
    console.log('='.repeat(60));
    
    if (!result.success) {
      console.log('\n⚠️ NAVEGADOR MANTIDO ABERTO PARA DEBUG');
      console.log('⚠️ Verifique se está em modo INCÓGNITO (ícone de óculos)');
      console.log('⚠️ Pressione Ctrl+C quando terminar');
    }
  })
  .catch(err => {
    console.error('❌ Erro fatal:', err);
  });
