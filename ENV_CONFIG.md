# 🔧 Configuração de Variáveis de Ambiente

## 📝 Arquivo .env

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
# ========================================
# CONFIGURAÇÕES OBRIGATÓRIAS
# ========================================

# URL da plataforma Lovable
LOVABLE_BASE_URL=https://lovable.dev

# Link de indicação do Usuário A (OBRIGATÓRIO)
REFERRAL_LINK=https://lovable.dev/ref/SEU_CODIGO_AQUI

# API Key do ProxiedMail (OBRIGATÓRIO)
PROXIEDMAIL_API_KEY=c9505fd8540287574e26165cb092ccdc

# ========================================
# CONFIGURAÇÕES OPCIONAIS
# ========================================

# Base URL da API do ProxiedMail (padrão: https://proxiedmail.com/api)
PROXIEDMAIL_BASE_URL=https://proxiedmail.com/api

# Configurações de Proxy (para rotação de IP)
PROXY_ENABLED=false
PROXY_LIST_URL=
PROXY_LIST=

# Configurações de Execução
MAX_CONCURRENT_USERS=5
DELAY_BETWEEN_ACTIONS_MS=1000
TIMEOUT_MS=60000

# Modo de Execução do Navegador
HEADLESS=true
SLOW_MO=0
```

---

## 🔑 Variáveis Detalhadas

### Configurações Obrigatórias

#### `LOVABLE_BASE_URL`
- **Descrição**: URL base da plataforma Lovable
- **Padrão**: `https://lovable.dev`
- **Exemplo**: `https://lovable.dev`

#### `REFERRAL_LINK`
- **Descrição**: Link de indicação completo do Usuário A
- **Obrigatório**: ✅ SIM
- **Formato**: `https://lovable.dev/ref/CODIGO`
- **Exemplo**: `https://lovable.dev/ref/ABC123XYZ`

#### `PROXIEDMAIL_API_KEY`
- **Descrição**: Chave de API do ProxiedMail para criar emails proxy
- **Obrigatório**: ✅ SIM
- **Como obter**: Acesse [ProxiedMail](https://proxiedmail.com) e gere sua API key
- **Exemplo**: `c9505fd8540287574e26165cb092ccdc`
- **Documentação**: [ProxiedMail Docs](https://docs.proxiedmail.com)

---

### Configurações Opcionais

#### `PROXIEDMAIL_BASE_URL`
- **Descrição**: URL base da API do ProxiedMail
- **Padrão**: `https://proxiedmail.com/api`
- **Quando alterar**: Apenas se usar uma instância self-hosted

#### `PROXY_ENABLED`
- **Descrição**: Habilita rotação de IP via proxies
- **Padrão**: `false`
- **Valores**: `true` ou `false`
- **Recomendação**: Use `true` para testes > 100 usuários

#### `PROXY_LIST`
- **Descrição**: Lista de proxies separados por vírgula
- **Formato**: `http://proxy1:port,http://user:pass@proxy2:port`
- **Exemplo**: `http://proxy1.com:8080,http://user:pass@proxy2.com:8080`

#### `PROXY_LIST_URL`
- **Descrição**: URL que retorna lista de proxies (um por linha)
- **Formato**: URL HTTP/HTTPS
- **Exemplo**: `https://api.exemplo.com/proxies.txt`

#### `MAX_CONCURRENT_USERS`
- **Descrição**: Número de usuários executando simultaneamente
- **Padrão**: `5`
- **Recomendação**: 
  - Máquina básica: 3-5
  - Máquina média: 5-10
  - Máquina potente: 10-20

#### `DELAY_BETWEEN_ACTIONS_MS`
- **Descrição**: Delay em milissegundos entre ações do usuário
- **Padrão**: `1000` (1 segundo)
- **Recomendação**:
  - Rápido: 500ms
  - Normal: 1000ms
  - Realista: 2000ms

#### `TIMEOUT_MS`
- **Descrição**: Timeout geral em milissegundos
- **Padrão**: `60000` (60 segundos)
- **Recomendação**: Aumente para 90000-120000 se houver muitos timeouts

#### `HEADLESS`
- **Descrição**: Executa navegador sem interface gráfica
- **Padrão**: `true`
- **Valores**: `true` ou `false`
- **Quando usar `false`**: Debug, visualizar o que está acontecendo

#### `SLOW_MO`
- **Descrição**: Desacelera ações do Playwright em milissegundos
- **Padrão**: `0`
- **Recomendação**:
  - Produção: 0
  - Debug: 500-1000

---

## 🎯 Configurações por Cenário

### 1. Desenvolvimento / Debug

```env
LOVABLE_BASE_URL=https://lovable.dev
REFERRAL_LINK=https://lovable.dev/ref/SEU_CODIGO
PROXIEDMAIL_API_KEY=sua_api_key

MAX_CONCURRENT_USERS=1
DELAY_BETWEEN_ACTIONS_MS=2000
TIMEOUT_MS=90000

HEADLESS=false
SLOW_MO=500

PROXY_ENABLED=false
```

### 2. Teste Pequeno (10-50 usuários)

```env
LOVABLE_BASE_URL=https://lovable.dev
REFERRAL_LINK=https://lovable.dev/ref/SEU_CODIGO
PROXIEDMAIL_API_KEY=sua_api_key

MAX_CONCURRENT_USERS=5
DELAY_BETWEEN_ACTIONS_MS=1000
TIMEOUT_MS=60000

HEADLESS=true
SLOW_MO=0

PROXY_ENABLED=false
```

### 3. Teste Médio (100-500 usuários)

```env
LOVABLE_BASE_URL=https://lovable.dev
REFERRAL_LINK=https://lovable.dev/ref/SEU_CODIGO
PROXIEDMAIL_API_KEY=sua_api_key

MAX_CONCURRENT_USERS=10
DELAY_BETWEEN_ACTIONS_MS=1000
TIMEOUT_MS=60000

HEADLESS=true
SLOW_MO=0

PROXY_ENABLED=true
PROXY_LIST=http://proxy1:8080,http://proxy2:8080
```

### 4. Teste Grande (1000+ usuários)

```env
LOVABLE_BASE_URL=https://lovable.dev
REFERRAL_LINK=https://lovable.dev/ref/SEU_CODIGO
PROXIEDMAIL_API_KEY=sua_api_key

MAX_CONCURRENT_USERS=20
DELAY_BETWEEN_ACTIONS_MS=500
TIMEOUT_MS=90000

HEADLESS=true
SLOW_MO=0

PROXY_ENABLED=true
PROXY_LIST=http://proxy1:8080,http://proxy2:8080,http://proxy3:8080
```

---

## 🔐 Segurança

### ⚠️ IMPORTANTE

- **NUNCA** commite o arquivo `.env` no Git
- **SEMPRE** use `.env.example` como template (sem valores reais)
- **NUNCA** compartilhe sua `PROXIEDMAIL_API_KEY` publicamente
- **SEMPRE** use variáveis de ambiente em produção

### Checklist de Segurança

- [ ] `.env` está no `.gitignore`
- [ ] `.env.example` não contém valores reais
- [ ] API keys são únicas por ambiente
- [ ] Repositório não contém credenciais commitadas

---

## 🧪 Validação

Para validar sua configuração:

```bash
npm run validate
```

Este comando verifica:
- ✅ Arquivo `.env` existe
- ✅ `REFERRAL_LINK` está configurado
- ✅ `PROXIEDMAIL_API_KEY` está configurado
- ✅ Variáveis obrigatórias não estão vazias

---

## 📚 Recursos

- **ProxiedMail**: [proxiedmail.com](https://proxiedmail.com)
- **Documentação ProxiedMail**: [docs.proxiedmail.com](https://docs.proxiedmail.com)
- **GitHub ProxiedMail**: [github.com/proxied-mail](https://github.com/proxied-mail)
- **Playwright Docs**: [playwright.dev](https://playwright.dev)

---

## 💡 Dicas

### Como obter API Key do ProxiedMail

1. Acesse [ProxiedMail](https://proxiedmail.com)
2. Crie uma conta ou faça login
3. Vá em Settings > API Keys
4. Clique em "Create API Key"
5. Copie a chave e cole no `.env`

### Como testar a configuração

```bash
# 1. Validar
npm run validate

# 2. Testar com 1 usuário
node src/index.js --users=1

# 3. Ver resultado
cat reports/report-*.txt
```

---

**Última atualização**: Dezembro 2025

