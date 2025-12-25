# 📖 Exemplos de Uso

## 🎯 Cenários Comuns

### 1. Teste Básico de Validação

**Objetivo**: Validar que o sistema está funcionando corretamente

```bash
# Executar com 5 usuários
node src/index.js --users=5

# Verificar relatório
cat reports/report-*.txt | tail -50
```

**Resultado esperado**:
- Taxa de sucesso: > 80%
- Tempo médio: 1-2 minutos por usuário
- Créditos gerados: 5 × 10 = 50 créditos

---

### 2. Teste de Capacidade (Capacity Test)

**Objetivo**: Validar que o sistema suporta 100 usuários simultâneos

```bash
# 100 usuários, 10 simultâneos
node src/index.js --users=100 --concurrent=10
```

**Configuração recomendada** (`.env`):
```env
MAX_CONCURRENT_USERS=10
DELAY_BETWEEN_ACTIONS_MS=1000
TIMEOUT_MS=60000
HEADLESS=true
```

**Resultado esperado**:
- Taxa de sucesso: > 85%
- Tempo total: 15-20 minutos
- Créditos gerados: ~850-900 créditos

---

### 3. Teste de Stress (Stress Test)

**Objetivo**: Testar limites do sistema com 1000 usuários

```bash
# 1000 usuários, 20 simultâneos
node src/index.js --users=1000 --concurrent=20
```

**Configuração recomendada** (`.env`):
```env
MAX_CONCURRENT_USERS=20
DELAY_BETWEEN_ACTIONS_MS=500
TIMEOUT_MS=90000
HEADLESS=true
PROXY_ENABLED=true
```

**Resultado esperado**:
- Taxa de sucesso: > 75%
- Tempo total: 2-3 horas
- Créditos gerados: ~7500-8500 créditos

**⚠️ Importante**: Use proxies para evitar bloqueios!

---

### 4. Teste de Antifraude

**Objetivo**: Validar que o sistema detecta padrões suspeitos

```bash
# 50 usuários em sequência rápida
node src/index.js --users=50 --concurrent=1
```

**Configuração** (`.env`):
```env
MAX_CONCURRENT_USERS=1
DELAY_BETWEEN_ACTIONS_MS=100  # Muito rápido (suspeito)
PROXY_ENABLED=false  # Mesmo IP
```

**Resultado esperado**:
- Sistema deve detectar e bloquear após X tentativas
- Taxa de sucesso deve cair após detecção
- Validar logs de segurança

---

### 5. Teste Realista com Proxies

**Objetivo**: Simular usuários reais de diferentes localizações

```bash
# 200 usuários com proxies
node src/index.js --users=200 --concurrent=10
```

**Configuração** (`.env`):
```env
PROXY_ENABLED=true
PROXY_LIST=http://proxy1:8080,http://proxy2:8080,http://proxy3:8080
MAX_CONCURRENT_USERS=10
DELAY_BETWEEN_ACTIONS_MS=2000  # Comportamento humano
```

**Resultado esperado**:
- Taxa de sucesso: > 90%
- IPs distribuídos
- Comportamento natural

---

### 6. Debug de Problemas

**Objetivo**: Investigar por que usuários estão falhando

```bash
# 1 usuário em modo debug
node src/index.js --users=1
```

**Configuração** (`.env`):
```env
HEADLESS=false  # Ver navegador
SLOW_MO=500     # Câmera lenta
DELAY_BETWEEN_ACTIONS_MS=2000
```

**Como usar**:
1. Execute o comando
2. Observe o navegador
3. Identifique onde está falhando
4. Ajuste seletores se necessário

---

### 7. Teste Noturno Automatizado

**Objetivo**: Executar testes durante a noite

```bash
# Criar script de teste noturno
cat > run-nightly-test.sh << 'EOF'
#!/bin/bash
echo "Iniciando teste noturno - $(date)"
node src/index.js --users=500 --concurrent=10 > nightly-test.log 2>&1
echo "Teste concluído - $(date)"
EOF

chmod +x run-nightly-test.sh

# Executar
./run-nightly-test.sh
```

**Agendar com cron**:
```bash
# Executar todo dia às 2h da manhã
crontab -e

# Adicionar linha:
0 2 * * * cd /Users/denisfeitozadejesus/Documents/Lovable && ./run-nightly-test.sh
```

---

### 8. Teste de Recuperação de Falhas

**Objetivo**: Validar que o sistema continua após falhas

```bash
# Executar com configuração propensa a falhas
node src/index.js --users=50 --concurrent=5
```

**Configuração** (`.env`):
```env
TIMEOUT_MS=5000  # Timeout curto (vai causar falhas)
```

**Análise**:
```bash
# Ver relatório de erros
cat reports/report-*.json | jq '.errors'

# Contar tipos de erro
cat reports/report-*.json | jq '.errors | keys'
```

---

### 9. Comparação de Performance

**Objetivo**: Comparar diferentes configurações

```bash
# Teste 1: Baixa concorrência
node src/index.js --users=100 --concurrent=5 > test1.log

# Teste 2: Alta concorrência
node src/index.js --users=100 --concurrent=20 > test2.log

# Comparar resultados
echo "=== Teste 1 (concorrência 5) ==="
grep "Taxa de Sucesso" test1.log
grep "Tempo de Execução" test1.log

echo "=== Teste 2 (concorrência 20) ==="
grep "Taxa de Sucesso" test2.log
grep "Tempo de Execução" test2.log
```

---

### 10. Teste de Integração Contínua (CI/CD)

**Objetivo**: Integrar testes no pipeline de CI/CD

**GitHub Actions** (`.github/workflows/test.yml`):
```yaml
name: Referral System Tests

on:
  schedule:
    - cron: '0 2 * * *'  # Todo dia às 2h
  workflow_dispatch:  # Manual

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Install browsers
        run: npm run install:browsers
      
      - name: Run tests
        env:
          REFERRAL_LINK: ${{ secrets.REFERRAL_LINK }}
          RAPIDAPI_KEY: ${{ secrets.RAPIDAPI_KEY }}
        run: node src/index.js --users=50
      
      - name: Upload reports
        uses: actions/upload-artifact@v3
        with:
          name: test-reports
          path: reports/
```

---

## 📊 Análise de Resultados

### Extrair Métricas Específicas

```bash
# Taxa de sucesso
cat reports/report-*.json | jq '.summary.successRate'

# Total de créditos
cat reports/report-*.json | jq '.summary.totalCredits'

# Tempo médio de cadastro
cat reports/report-*.json | jq '.performance.averageTimes.signup'

# Erros mais comuns
cat reports/report-*.json | jq '.errors | to_entries | sort_by(.value.count) | reverse | .[0:3]'
```

### Gerar Gráfico de Performance

```bash
# Extrair dados para CSV
cat reports/report-*.json | jq -r '.details[] | [.userId, .success, .executionTime] | @csv' > results.csv

# Importar no Excel/Google Sheets para visualização
```

---

## 🔧 Troubleshooting por Cenário

### Cenário: Taxa de sucesso < 50%

**Diagnóstico**:
```bash
# Ver erros mais comuns
cat reports/report-*.json | jq '.errors'

# Ver screenshots de erro
ls -la reports/error-*.png
```

**Soluções**:
1. Verificar se link de indicação está correto
2. Aumentar timeouts
3. Reduzir concorrência
4. Executar em modo debug

---

### Cenário: Muitos timeouts de email

**Diagnóstico**:
```bash
# Ver quantos falharam na verificação de email
cat reports/report-*.json | jq '[.details[] | select(.steps.emailVerification == null)] | length'
```

**Soluções**:
1. Aumentar timeout de email no código
2. Verificar se API de email está funcionando
3. Testar manualmente o recebimento de email

---

### Cenário: Proxies não funcionando

**Diagnóstico**:
```bash
# Ver estatísticas de proxy
cat reports/report-*.json | jq '.proxyStats'
```

**Soluções**:
1. Validar proxies manualmente
2. Usar proxies de melhor qualidade
3. Desabilitar proxies temporariamente

---

## 💡 Dicas Avançadas

### 1. Executar em Paralelo em Múltiplas Máquinas

```bash
# Máquina 1
node src/index.js --users=500 --concurrent=10

# Máquina 2
node src/index.js --users=500 --concurrent=10

# Total: 1000 usuários em metade do tempo
```

### 2. Monitorar em Tempo Real

```bash
# Terminal 1: Executar teste
node src/index.js --users=100

# Terminal 2: Monitorar progresso
watch -n 5 'ls -lh reports/ | tail -5'

# Terminal 3: Monitorar recursos
htop
```

### 3. Salvar Histórico de Testes

```bash
# Criar estrutura de histórico
mkdir -p reports/history/$(date +%Y-%m-%d)

# Após cada teste, mover relatórios
mv reports/report-*.* reports/history/$(date +%Y-%m-%d)/

# Comparar testes ao longo do tempo
for dir in reports/history/*/; do
  echo "=== $dir ==="
  cat $dir/report-*.json | jq '.summary.successRate'
done
```

---

## 🎓 Casos de Uso Reais

### Startup validando MVP
- **Objetivo**: Validar que 100 usuários conseguem se cadastrar
- **Teste**: `npm run test:medium`
- **Sucesso**: Taxa > 90%

### Empresa preparando para lançamento
- **Objetivo**: Stress test com 1000 usuários
- **Teste**: `npm run test:large` com proxies
- **Sucesso**: Sistema aguenta carga sem degradação

### Equipe de QA em teste contínuo
- **Objetivo**: Testes diários automatizados
- **Teste**: CI/CD com 50 usuários
- **Sucesso**: Detecta regressões rapidamente

---

**Para mais exemplos, consulte a [documentação completa](README.md)!**

