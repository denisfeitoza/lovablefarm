# ⚡ Guia Rápido de Início

## 🚀 Em 5 Minutos

### 1️⃣ Instalar Dependências (2 min)

```bash
cd /Users/denisfeitozadejesus/Documents/Lovable
npm run setup
```

Este comando vai:
- ✅ Instalar todas as dependências do Node.js
- ✅ Baixar navegadores do Playwright
- ✅ Validar a configuração

### 2️⃣ Configurar Link de Indicação (1 min)

Edite o arquivo `.env` e substitua o link de indicação:

```bash
# Abrir no editor
nano .env

# Ou usar qualquer editor de texto
code .env
```

**Importante**: Configure estas linhas:

```env
# Link de indicação (OBRIGATÓRIO)
REFERRAL_LINK=https://lovable.dev/ref/ABC123XYZ

# API Key do ProxiedMail (OBRIGATÓRIO)
PROXIEDMAIL_API_KEY=c9505fd8540287574e26165cb092ccdc
```

Substitua:
- `ABC123XYZ` pelo seu código de indicação real
- A API key já está configurada no exemplo acima

Salve o arquivo (Ctrl+O, Enter, Ctrl+X no nano).

📖 **Veja [ENV_CONFIG.md](ENV_CONFIG.md) para todas as configurações**

### 3️⃣ Executar Primeiro Teste (2 min)

```bash
npm run test:small
```

Isso vai simular **10 usuários** completando o fluxo de indicação.

## 📊 Entender os Resultados

Após a execução, você verá:

```
═══════════════════════════════════════════════════════
           LOVABLE REFERRAL TEST REPORT
═══════════════════════════════════════════════════════

📊 RESUMO
─────────────────────────────────────────────────────
Total de Usuários:       10
✅ Sucessos:             9
❌ Falhas:               1
📈 Taxa de Sucesso:      90.00%
💰 Total de Créditos:    90
⏱️  Tempo de Execução:    2m 15s
```

### Onde Encontrar Relatórios Detalhados

```bash
# Relatórios estão em:
ls -la reports/

# Ver último relatório em texto
cat reports/report-*.txt | tail -100

# Ver último relatório JSON (dados completos)
cat reports/report-*.json | jq .
```

## 🎯 Próximos Passos

### Teste Médio (100 usuários)

```bash
npm run test:medium
```

⏱️ Tempo estimado: 15-20 minutos

### Teste Grande (1000 usuários)

```bash
npm run test:large
```

⏱️ Tempo estimado: 2-3 horas

### Teste Personalizado

```bash
# 50 usuários, 10 simultâneos
node src/index.js --users=50 --concurrent=10
```

## 🔧 Configurações Avançadas

### Ver Navegador em Ação (Debug)

Edite `.env`:
```env
HEADLESS=false
SLOW_MO=500
```

Depois execute:
```bash
node src/index.js --users=1
```

Você verá o navegador executando cada ação!

### Adicionar Rotação de IP

1. Obtenha uma lista de proxies
2. Edite `.env`:

```env
PROXY_ENABLED=true
PROXY_LIST=http://proxy1:8080,http://proxy2:8080
```

3. Execute normalmente

### Ajustar Concorrência

```env
MAX_CONCURRENT_USERS=10  # Mais rápido, mas usa mais recursos
```

Ou via linha de comando:
```bash
node src/index.js --users=100 --concurrent=10
```

## 🚨 Troubleshooting Rápido

### ❌ Erro: "REFERRAL_LINK não configurado"

**Solução**: Edite o arquivo `.env` e configure o link de indicação.

### ❌ Erro: "command not found: node"

**Solução**: Instale o Node.js 18+ em https://nodejs.org

### ❌ Taxa de sucesso muito baixa (< 50%)

**Possíveis causas**:
1. Link de indicação inválido
2. Interface da Lovable mudou
3. Rede instável

**Solução**:
```bash
# 1. Validar configuração
npm run validate

# 2. Executar em modo debug
# Edite .env: HEADLESS=false
node src/index.js --users=1

# 3. Verificar logs
cat reports/report-*.txt
```

### ❌ Muitos timeouts

**Solução**: Aumente o timeout no `.env`:
```env
TIMEOUT_MS=120000  # 2 minutos
DELAY_BETWEEN_ACTIONS_MS=2000  # 2 segundos
```

## 📚 Documentação Completa

- **README.md**: Visão geral do projeto
- **SETUP.md**: Guia detalhado de instalação
- **ARCHITECTURE.md**: Arquitetura técnica
- **CONTRIBUTING.md**: Como contribuir

## 💡 Dicas

### 1. Sempre Começar Pequeno
```bash
# Primeiro teste com 5 usuários
node src/index.js --users=5
```

### 2. Monitorar em Tempo Real
```bash
# Em outro terminal, monitore os logs
tail -f reports/report-*.txt
```

### 3. Limpar Relatórios Antigos
```bash
# Mover relatórios antigos
mkdir -p reports/archive
mv reports/report-*.* reports/archive/
```

### 4. Verificar Taxa de Sucesso
Uma boa taxa de sucesso é **> 90%**. Se estiver abaixo:
- Reduza a concorrência
- Aumente os delays
- Verifique se o link de indicação está correto
- Execute em modo debug para ver o que está falhando

## 🎉 Pronto!

Você agora tem um sistema completo de testes de indicação em escala!

Para dúvidas ou problemas, consulte a documentação completa ou abra uma issue.

---

**Boa sorte com seus testes! 🚀**

