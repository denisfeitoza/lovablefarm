# 🎮 Comandos Úteis

## 📦 Instalação e Setup

```bash
# Setup completo (instala tudo)
npm run setup

# Instalar apenas dependências
npm install

# Instalar apenas navegadores
npm run install:browsers

# Validar configuração
npm run validate
```

---

## 🚀 Executar Testes

### Comandos Pré-configurados

```bash
# Teste pequeno (10 usuários)
npm run test:small

# Teste médio (100 usuários)
npm run test:medium

# Teste grande (1000 usuários)
npm run test:large

# Teste padrão (10 usuários)
npm test
```

### Comandos Personalizados

```bash
# Especificar número de usuários
node src/index.js --users=50

# Especificar concorrência
node src/index.js --users=100 --concurrent=10

# Ambos
node src/index.js --users=200 --concurrent=15

# Ver ajuda
node src/index.js --help
```

---

## 📊 Visualizar Relatórios

### Relatórios em Texto

```bash
# Ver último relatório
cat reports/report-*.txt | tail -100

# Ver todos os relatórios
ls -lh reports/

# Ver relatório específico
cat reports/report-2025-12-25T10-30-00-000Z.txt
```

### Relatórios em JSON

```bash
# Ver último relatório JSON (com jq)
cat reports/report-*.json | jq .

# Ver apenas resumo
cat reports/report-*.json | jq '.summary'

# Ver apenas erros
cat reports/report-*.json | jq '.errors'

# Ver performance
cat reports/report-*.json | jq '.performance'

# Ver detalhes de um usuário específico
cat reports/report-*.json | jq '.details[] | select(.userId == 1)'
```

### Extrair Métricas Específicas

```bash
# Taxa de sucesso
cat reports/report-*.json | jq '.summary.successRate'

# Total de créditos
cat reports/report-*.json | jq '.summary.totalCredits'

# Tempo total
cat reports/report-*.json | jq '.summary.executionTime'

# Usuários bem-sucedidos
cat reports/report-*.json | jq '.summary.successfulUsers'

# Usuários que falharam
cat reports/report-*.json | jq '.summary.failedUsers'
```

---

## 🔍 Debug e Troubleshooting

### Ver Logs em Tempo Real

```bash
# Monitorar diretório de relatórios
watch -n 2 'ls -lh reports/ | tail -10'

# Monitorar último relatório
tail -f reports/report-*.txt
```

### Ver Screenshots de Erros

```bash
# Listar screenshots
ls -lh reports/error-*.png

# Abrir último screenshot (macOS)
open $(ls -t reports/error-*.png | head -1)

# Abrir último screenshot (Linux)
xdg-open $(ls -t reports/error-*.png | head -1)
```

### Executar em Modo Debug

```bash
# 1. Editar .env
echo "HEADLESS=false" >> .env
echo "SLOW_MO=500" >> .env

# 2. Executar com 1 usuário
node src/index.js --users=1

# 3. Voltar ao normal
echo "HEADLESS=true" >> .env
echo "SLOW_MO=0" >> .env
```

---

## 🧹 Limpeza e Manutenção

### Limpar Relatórios

```bash
# Criar diretório de arquivo
mkdir -p reports/archive

# Mover relatórios antigos
mv reports/report-*.* reports/archive/

# Limpar screenshots de erro
rm reports/error-*.png

# Limpar tudo
rm -rf reports/*
```

### Limpar node_modules

```bash
# Remover e reinstalar
rm -rf node_modules
npm install
```

---

## 📈 Análise de Dados

### Gerar CSV de Resultados

```bash
# Extrair dados para CSV
echo "userId,success,executionTime,email" > results.csv
cat reports/report-*.json | jq -r '.details[] | [.userId, .success, .executionTime, .email] | @csv' >> results.csv

# Ver CSV
cat results.csv
```

### Comparar Múltiplos Testes

```bash
# Criar estrutura de histórico
mkdir -p reports/history/$(date +%Y-%m-%d)

# Mover relatórios após cada teste
mv reports/report-*.json reports/history/$(date +%Y-%m-%d)/

# Comparar taxas de sucesso
for dir in reports/history/*/; do
  echo "=== $(basename $dir) ==="
  cat $dir/report-*.json | jq '.summary.successRate'
done
```

### Estatísticas Agregadas

```bash
# Total de usuários testados (todos os relatórios)
cat reports/history/*/report-*.json | jq -s 'map(.summary.totalUsers) | add'

# Taxa de sucesso média
cat reports/history/*/report-*.json | jq -s 'map(.summary.successRate | rtrimstr("%") | tonumber) | add / length'

# Total de créditos gerados
cat reports/history/*/report-*.json | jq -s 'map(.summary.totalCredits) | add'
```

---

## 🔧 Configuração

### Ver Configuração Atual

```bash
# Ver arquivo .env
cat .env

# Ver configuração específica
grep REFERRAL_LINK .env
grep MAX_CONCURRENT_USERS .env
```

### Editar Configuração

```bash
# Editar no nano
nano .env

# Editar no vim
vim .env

# Editar no VS Code
code .env
```

### Backup de Configuração

```bash
# Criar backup
cp .env .env.backup

# Restaurar backup
cp .env.backup .env
```

---

## 🌐 Proxies

### Testar Proxies

```bash
# Criar script de teste
cat > test-proxy.sh << 'EOF'
#!/bin/bash
PROXY=$1
curl -x $PROXY -s https://api.ipify.org?format=json
EOF

chmod +x test-proxy.sh

# Testar um proxy
./test-proxy.sh http://proxy.example.com:8080
```

### Validar Lista de Proxies

```bash
# Testar todos os proxies
while IFS= read -r proxy; do
  echo "Testando: $proxy"
  curl -x "$proxy" -s --connect-timeout 5 https://api.ipify.org?format=json || echo "FALHOU"
done < proxies.txt
```

---

## 🔄 Automação

### Agendar Testes (cron)

```bash
# Editar crontab
crontab -e

# Adicionar linha para executar todo dia às 2h
0 2 * * * cd /Users/denisfeitozadejesus/Documents/Lovable && node src/index.js --users=100 >> nightly-test.log 2>&1

# Listar tarefas agendadas
crontab -l
```

### Script de Teste Contínuo

```bash
# Criar script
cat > continuous-test.sh << 'EOF'
#!/bin/bash
while true; do
  echo "Iniciando teste - $(date)"
  node src/index.js --users=10
  echo "Aguardando 1 hora..."
  sleep 3600
done
EOF

chmod +x continuous-test.sh

# Executar em background
nohup ./continuous-test.sh &
```

---

## 📊 Monitoramento

### Monitorar Recursos do Sistema

```bash
# CPU e memória
htop

# Processos do Node
ps aux | grep node

# Uso de disco
df -h

# Espaço usado por relatórios
du -sh reports/
```

### Monitorar Progresso

```bash
# Contar relatórios gerados
ls reports/report-*.json | wc -l

# Ver último relatório gerado
ls -lt reports/report-*.json | head -1

# Monitorar taxa de sucesso em tempo real
watch -n 5 'cat reports/report-*.json 2>/dev/null | jq -r ".summary.successRate" | tail -1'
```

---

## 🐛 Debug Avançado

### Executar com Logs Detalhados

```bash
# Redirecionar logs para arquivo
node src/index.js --users=10 > debug.log 2>&1

# Ver logs em tempo real
tail -f debug.log
```

### Capturar Tráfego de Rede

```bash
# Usar mitmproxy (se instalado)
mitmproxy -p 8080

# Configurar proxy no .env
echo "PROXY_LIST=http://localhost:8080" >> .env
```

### Inspecionar Navegador

```bash
# Executar com DevTools aberto
# Edite src/automation/userFlow.js e adicione:
# browser = await chromium.launch({ devtools: true })
```

---

## 🚀 Performance

### Otimizar para Velocidade

```bash
# Aumentar concorrência
node src/index.js --users=100 --concurrent=20

# Reduzir delays (cuidado!)
# Edite .env:
echo "DELAY_BETWEEN_ACTIONS_MS=500" >> .env
```

### Otimizar para Estabilidade

```bash
# Reduzir concorrência
node src/index.js --users=100 --concurrent=3

# Aumentar delays
echo "DELAY_BETWEEN_ACTIONS_MS=2000" >> .env
```

---

## 📦 Atualização

### Atualizar Dependências

```bash
# Ver dependências desatualizadas
npm outdated

# Atualizar todas
npm update

# Atualizar Playwright
npm install playwright@latest
npm run install:browsers
```

### Atualizar Projeto

```bash
# Se usando git
git pull origin main

# Reinstalar dependências
npm install
```

---

## 🎯 Atalhos Úteis

```bash
# Criar aliases no ~/.bashrc ou ~/.zshrc
alias lovable-test="cd /Users/denisfeitozadejesus/Documents/Lovable && node src/index.js"
alias lovable-small="cd /Users/denisfeitozadejesus/Documents/Lovable && npm run test:small"
alias lovable-report="cat /Users/denisfeitozadejesus/Documents/Lovable/reports/report-*.txt | tail -100"

# Recarregar shell
source ~/.zshrc  # ou source ~/.bashrc

# Usar aliases
lovable-small
lovable-report
```

---

## 💡 Dicas Rápidas

```bash
# Ver versão do Node
node --version

# Ver versão do npm
npm --version

# Verificar se Playwright está instalado
npx playwright --version

# Limpar cache do npm
npm cache clean --force

# Verificar integridade das dependências
npm audit

# Corrigir vulnerabilidades
npm audit fix
```

---

**Para mais informações, consulte a [documentação completa](README.md)!**

