# ❓ Perguntas Frequentes (FAQ)

## 🚀 Instalação e Setup

### P: Qual versão do Node.js eu preciso?

**R:** Node.js 18 ou superior. Verifique com:
```bash
node --version
```

Se precisar instalar/atualizar: https://nodejs.org

---

### P: O comando `npm run setup` falhou. O que fazer?

**R:** Tente os passos manualmente:
```bash
npm install
npm run install:browsers
npm run validate
```

Se ainda falhar, verifique:
- Conexão com internet
- Permissões de escrita no diretório
- Espaço em disco disponível

---

### P: Onde consigo o link de indicação?

**R:** O link de indicação deve ser fornecido pela plataforma Lovable. Geralmente tem o formato:
```
https://lovable.dev/ref/CODIGO_AQUI
```

Configure no arquivo `.env`:
```env
REFERRAL_LINK=https://lovable.dev/ref/SEU_CODIGO
```

---

## 🔧 Configuração

### P: Preciso configurar proxies obrigatoriamente?

**R:** Não! Proxies são opcionais. Para testes pequenos (< 50 usuários), não é necessário.

Para testes grandes (> 100 usuários), proxies são **recomendados** para evitar bloqueios.

---

### P: Onde consigo proxies?

**R:** Opções:
1. **Gratuitos** (não recomendado): https://free-proxy-list.net
2. **Pagos** (recomendado):
   - Bright Data
   - Oxylabs
   - Smartproxy
   - IPRoyal

---

### P: Qual a diferença entre HEADLESS=true e false?

**R:**
- `HEADLESS=true`: Navegador invisível (mais rápido, produção)
- `HEADLESS=false`: Navegador visível (debug, desenvolvimento)

Use `false` apenas para debug!

---

## 🎯 Execução

### P: Quantos usuários posso testar simultaneamente?

**R:** Depende do seu hardware:
- **Máquina básica**: 3-5 usuários simultâneos
- **Máquina média**: 5-10 usuários simultâneos
- **Máquina potente**: 10-20 usuários simultâneos

Configure em `.env`:
```env
MAX_CONCURRENT_USERS=5
```

---

### P: Quanto tempo leva para testar 100 usuários?

**R:** Aproximadamente:
- **Com 5 simultâneos**: 15-20 minutos
- **Com 10 simultâneos**: 10-15 minutos
- **Com 20 simultâneos**: 5-10 minutos

Depende também da velocidade da rede e da plataforma.

---

### P: Posso parar a execução no meio?

**R:** Sim! Use `Ctrl+C`. Os resultados dos usuários já completados serão salvos.

---

### P: Como executar em background?

**R:**
```bash
# Linux/macOS
nohup node src/index.js --users=100 > test.log 2>&1 &

# Ver progresso
tail -f test.log
```

---

## 📊 Relatórios

### P: Onde ficam os relatórios?

**R:** No diretório `reports/`:
- `report-*.json`: Dados completos
- `report-*.txt`: Resumo legível
- `error-*.png`: Screenshots de erros

---

### P: O que é uma boa taxa de sucesso?

**R:**
- **> 90%**: Excelente! ✅
- **70-90%**: Bom, mas pode melhorar ⚠️
- **< 70%**: Algo está errado ❌

Se < 70%, verifique:
1. Link de indicação está correto?
2. Interface da plataforma mudou?
3. Timeouts são suficientes?

---

### P: Como ver apenas os erros?

**R:**
```bash
# Ver erros do último relatório
cat reports/report-*.json | jq '.errors'

# Ver usuários que falharam
cat reports/report-*.json | jq '.details[] | select(.success == false)'
```

---

## 🐛 Problemas Comuns

### P: Erro "REFERRAL_LINK não configurado"

**R:** Edite o arquivo `.env` e configure:
```env
REFERRAL_LINK=https://lovable.dev/ref/SEU_CODIGO
```

Não esqueça de substituir `SEU_CODIGO` pelo código real!

---

### P: Erro "command not found: node"

**R:** Node.js não está instalado. Instale em: https://nodejs.org

---

### P: Erro "Cannot find module"

**R:** Dependências não instaladas. Execute:
```bash
npm install
```

---

### P: Erro "Timeout: Email de verificação não recebido"

**R:** Possíveis causas:
1. API de email temporário está lenta
2. Lovable não enviou o email
3. Timeout muito curto

**Solução**: Aumente o timeout no código ou tente novamente.

---

### P: Erro "Botão não encontrado"

**R:** A interface da Lovable pode ter mudado. 

**Solução**:
1. Execute em modo não-headless (`HEADLESS=false`)
2. Veja onde está falhando
3. Ajuste os seletores no código

---

### P: Taxa de sucesso muito baixa (< 50%)

**R:** Checklist:
- [ ] Link de indicação está correto?
- [ ] `.env` está configurado?
- [ ] Rede está estável?
- [ ] Executou `npm run validate`?
- [ ] Testou com 1 usuário primeiro?

Se tudo OK, pode ser que a interface mudou. Execute em modo debug.

---

### P: Muitos erros de timeout

**R:** Aumente os timeouts no `.env`:
```env
TIMEOUT_MS=120000  # 2 minutos
DELAY_BETWEEN_ACTIONS_MS=2000  # 2 segundos
```

---

### P: Navegador não abre (modo não-headless)

**R:** Verifique se os navegadores estão instalados:
```bash
npm run install:browsers
```

---

## 🌐 Proxies

### P: Proxies são obrigatórios?

**R:** Não, mas **recomendados** para:
- Testes com > 100 usuários
- Evitar bloqueios por IP
- Simular usuários de diferentes localizações

---

### P: Como sei se meus proxies estão funcionando?

**R:** Veja as estatísticas no relatório:
```bash
cat reports/report-*.json | jq '.proxyStats'
```

Ou teste manualmente:
```bash
curl -x http://proxy:port https://api.ipify.org?format=json
```

---

### P: Posso usar proxies gratuitos?

**R:** Tecnicamente sim, mas **não recomendado**:
- Geralmente bloqueados
- Lentos
- Instáveis
- Baixa taxa de sucesso

Para produção, use proxies pagos de qualidade.

---

## 📈 Performance

### P: Como fazer os testes rodarem mais rápido?

**R:**
1. Aumentar concorrência:
```bash
node src/index.js --users=100 --concurrent=20
```

2. Reduzir delays (cuidado!):
```env
DELAY_BETWEEN_ACTIONS_MS=500
```

3. Usar máquina mais potente

---

### P: Meu computador está travando durante os testes

**R:** Reduza a concorrência:
```env
MAX_CONCURRENT_USERS=3
```

Ou execute em uma máquina mais potente (servidor, cloud).

---

### P: Posso executar em múltiplas máquinas?

**R:** Sim! Execute em paralelo:
- **Máquina 1**: 500 usuários
- **Máquina 2**: 500 usuários
- **Total**: 1000 usuários em metade do tempo

---

## 🔐 Segurança

### P: Os emails são reais?

**R:** Não, são emails temporários descartáveis. Não use para dados sensíveis.

---

### P: As senhas são seguras?

**R:** Sim, são geradas aleatoriamente e não são armazenadas. Cada teste usa senhas únicas.

---

### P: Posso ser bloqueado pela plataforma?

**R:** Possível se:
- Executar muitos testes sem proxies
- Usar concorrência muito alta
- Não respeitar rate limits

**Prevenção**:
- Use proxies
- Delays realistas
- Comece pequeno

---

## 🎓 Uso Avançado

### P: Como integrar com CI/CD?

**R:** Veja exemplo completo em [EXAMPLES.md](EXAMPLES.md#10-teste-de-integração-contínua-cicd)

Resumo:
```yaml
# .github/workflows/test.yml
- run: npm install
- run: npm run install:browsers
- run: node src/index.js --users=50
```

---

### P: Como salvar histórico de testes?

**R:**
```bash
# Criar estrutura
mkdir -p reports/history/$(date +%Y-%m-%d)

# Mover relatórios
mv reports/report-*.* reports/history/$(date +%Y-%m-%d)/
```

---

### P: Como comparar resultados de diferentes dias?

**R:**
```bash
for dir in reports/history/*/; do
  echo "=== $(basename $dir) ==="
  cat $dir/report-*.json | jq '.summary.successRate'
done
```

---

### P: Posso modificar o fluxo do usuário?

**R:** Sim! Edite os arquivos em `src/automation/`:
- `signup.js`: Cadastro
- `onboarding.js`: Quiz
- `project.js`: Projeto

---

### P: Como adicionar novos domínios de email?

**R:** Edite `src/utils/config.js`:
```javascript
emailDomains: [
  'rhyta.com',
  'teleworm.us',
  'seu-novo-dominio.com'  // Adicione aqui
]
```

---

## 📚 Documentação

### P: Onde encontro mais informações?

**R:** Documentação completa:
- [README.md](README.md): Visão geral
- [QUICKSTART.md](QUICKSTART.md): Início rápido
- [SETUP.md](SETUP.md): Setup detalhado
- [EXAMPLES.md](EXAMPLES.md): Exemplos práticos
- [ARCHITECTURE.md](ARCHITECTURE.md): Arquitetura
- [COMMANDS.md](COMMANDS.md): Comandos úteis

---

### P: Como contribuir com o projeto?

**R:** Veja [CONTRIBUTING.md](CONTRIBUTING.md)

---

## 🆘 Ainda com Problemas?

### P: Nada está funcionando!

**R:** Checklist completo:

1. **Validar setup**:
```bash
npm run validate
```

2. **Testar com 1 usuário em modo debug**:
```bash
# Edite .env: HEADLESS=false
node src/index.js --users=1
```

3. **Verificar logs**:
```bash
cat reports/report-*.txt
```

4. **Ver screenshots de erro**:
```bash
ls reports/error-*.png
```

5. **Verificar configuração**:
```bash
cat .env
```

Se ainda não funcionar, abra uma issue com:
- Logs completos
- Screenshots
- Configuração (sem dados sensíveis)
- Passos para reproduzir

---

## 💡 Dicas Finais

### P: Qual a melhor forma de começar?

**R:**
1. Execute `npm run setup`
2. Configure o `REFERRAL_LINK` no `.env`
3. Execute `npm run test:small` (10 usuários)
4. Analise os resultados
5. Ajuste configurações se necessário
6. Escale gradualmente

---

### P: Qual a configuração ideal?

**R:** Depende do objetivo:

**Para validação rápida**:
```env
MAX_CONCURRENT_USERS=5
HEADLESS=true
DELAY_BETWEEN_ACTIONS_MS=1000
```

**Para produção/escala**:
```env
MAX_CONCURRENT_USERS=10
HEADLESS=true
DELAY_BETWEEN_ACTIONS_MS=2000
PROXY_ENABLED=true
```

**Para debug**:
```env
MAX_CONCURRENT_USERS=1
HEADLESS=false
SLOW_MO=500
DELAY_BETWEEN_ACTIONS_MS=2000
```

---

**Não encontrou sua pergunta? Consulte a [documentação completa](README.md) ou abra uma issue!**

