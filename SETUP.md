# 🚀 Guia de Setup - Lovable Referral Tester

## 📋 Pré-requisitos

- Node.js 18+ instalado
- npm ou yarn
- Acesso à plataforma Lovable
- Link de indicação válido

## 🔧 Instalação Passo a Passo

### 1. Instalar dependências

```bash
cd /Users/denisfeitozadejesus/Documents/Lovable
npm install
```

### 2. Instalar navegadores do Playwright

```bash
npm run install:browsers
```

### 3. Configurar variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```bash
touch .env
```

**IMPORTANTE**: Edite o arquivo `.env` e configure:

```env
# ⚠️ OBRIGATÓRIO: Link de indicação
REFERRAL_LINK=https://lovable.dev/ref/SEU_CODIGO_AQUI

# ⚠️ OBRIGATÓRIO: API Key do ProxiedMail
PROXIEDMAIL_API_KEY=c9505fd8540287574e26165cb092ccdc

# Opcional: Configure proxies para rotação de IP
PROXY_ENABLED=false
PROXY_LIST=http://proxy1:port,http://proxy2:port
```

📖 **Veja [ENV_CONFIG.md](ENV_CONFIG.md) para configuração completa de todas as variáveis**

### 4. Verificar configuração

Teste se tudo está configurado corretamente:

```bash
node src/index.js --help
```

## 🎯 Como Usar

### Testes Rápidos

```bash
# Teste pequeno (10 usuários)
npm run test:small

# Teste médio (100 usuários)
npm run test:medium

# Teste grande (1000 usuários)
npm run test:large
```

### Testes Personalizados

```bash
# Especificar número de usuários
node src/index.js --users=50

# Especificar concorrência
node src/index.js --users=100 --concurrent=10

# Modo não-headless (ver navegador)
# Edite .env e configure: HEADLESS=false
```

## 📊 Entendendo os Resultados

Após cada execução, você encontrará:

### 1. Relatório em JSON
- Localização: `reports/report-TIMESTAMP.json`
- Contém dados detalhados de cada usuário

### 2. Relatório em Texto
- Localização: `reports/report-TIMESTAMP.txt`
- Resumo legível para humanos

### 3. Screenshots de Erros
- Localização: `reports/error-*.png`
- Capturas de tela quando algo falha

### Exemplo de Relatório

```
═══════════════════════════════════════════════════════
           LOVABLE REFERRAL TEST REPORT
═══════════════════════════════════════════════════════

📊 RESUMO
─────────────────────────────────────────────────────
Total de Usuários:       100
✅ Sucessos:             95
❌ Falhas:               5
📈 Taxa de Sucesso:      95.00%
💰 Total de Créditos:    950
⏱️  Tempo de Execução:    15m 30s

⚡ PERFORMANCE (Tempo Médio por Etapa)
─────────────────────────────────────────────────────
signup                    3s
emailVerification         8s
quiz                      2s
projectCreation           4s
projectRemix              3s
projectPublish            5s
```

## 🔐 Configurações Avançadas

### Rotação de IP com Proxies

Para simular usuários de diferentes localizações:

1. Obtenha uma lista de proxies (recomendado: proxies residenciais)
2. Configure no `.env`:

```env
PROXY_ENABLED=true
PROXY_LIST=http://user:pass@proxy1.com:8080,http://user:pass@proxy2.com:8080
```

### Ajustar Delays

Para simular comportamento mais humano:

```env
DELAY_BETWEEN_ACTIONS_MS=2000  # 2 segundos entre ações
SLOW_MO=100                     # Slow motion de 100ms
```

### Modo Debug

Para ver o navegador em ação:

```env
HEADLESS=false
SLOW_MO=500
```

## 🚨 Troubleshooting

### Erro: "REFERRAL_LINK não configurado"

**Solução**: Edite o arquivo `.env` e configure o link de indicação válido.

### Erro: "Email de verificação não recebido"

**Possíveis causas**:
- API de email temporário está fora do ar
- Lovable mudou o formato do email
- Timeout muito curto

**Solução**: Aumente o timeout no código ou tente novamente.

### Erro: "Botão não encontrado"

**Causa**: A interface da Lovable pode ter mudado.

**Solução**: 
1. Execute em modo não-headless para ver o que está acontecendo
2. Ajuste os seletores no código conforme necessário

### Muitas falhas nos testes

**Possíveis causas**:
- Concorrência muito alta
- Rede instável
- Rate limiting da plataforma

**Solução**:
```env
MAX_CONCURRENT_USERS=2  # Reduzir concorrência
DELAY_BETWEEN_ACTIONS_MS=2000  # Aumentar delays
```

## 📈 Boas Práticas

### 1. Começar Pequeno
Sempre teste com poucos usuários primeiro:
```bash
node src/index.js --users=5
```

### 2. Monitorar Taxa de Sucesso
- Taxa > 90%: Excelente ✅
- Taxa 70-90%: Bom, mas pode melhorar ⚠️
- Taxa < 70%: Investigar problemas ❌

### 3. Respeitar Rate Limits
Não execute testes muito grandes muito frequentemente para não sobrecarregar a plataforma.

### 4. Usar Proxies em Produção
Para testes em larga escala, sempre use rotação de IP para simular usuários reais.

## 🔄 Atualizações

Se a interface da Lovable mudar, você pode precisar atualizar os seletores nos arquivos:
- `src/automation/signup.js`
- `src/automation/onboarding.js`
- `src/automation/project.js`

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs em `reports/`
2. Execute em modo não-headless para debug
3. Verifique se o link de indicação está correto
4. Teste manualmente o fluxo primeiro

## ⚖️ Considerações Legais

Este sistema é para **testes internos** da sua plataforma. Use com responsabilidade:
- ✅ Testar sua própria plataforma
- ✅ Validar sistema de indicação
- ✅ Stress testing
- ❌ Não use para fraude
- ❌ Não abuse da plataforma de terceiros

