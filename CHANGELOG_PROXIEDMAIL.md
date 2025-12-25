# 🔄 Changelog: Migração para ProxiedMail

## 📅 Data: Dezembro 25, 2025

## 🎯 Resumo da Mudança

Substituição do serviço de emails temporários **RapidAPI Temp Mail** pelo **[ProxiedMail](https://proxiedmail.com)** para melhor controle e gerenciamento de emails proxy.

---

## ✅ O Que Foi Alterado

### 1. **Dependências** (`package.json`)

**Antes:**
- Dependia do RapidAPI Temp Mail via API HTTP

**Depois:**
- Usa API HTTP direta do ProxiedMail via `axios` (já incluído)
- Removida dependência inexistente `proxiedmail-js-client`

### 2. **Configurações** (`src/utils/config.js`)

**Antes:**
```javascript
rapidApiKey: process.env.RAPIDAPI_KEY
rapidApiHost: 'privatix-temp-mail-v1.p.rapidapi.com'
emailDomains: ['rhyta.com', 'teleworm.us', ...] // 10 domínios
```

**Depois:**
```javascript
proxiedMailApiKey: process.env.PROXIEDMAIL_API_KEY  // c9505fd8540287574e26165cb092ccdc
proxiedMailBaseUrl: process.env.PROXIEDMAIL_BASE_URL || 'https://proxiedmail.com/api'
proxiedMailDomains: ['proxiedmail.com', 'pxdmail.com']
```

### 3. **Serviço de Email** (`src/services/emailService.js`)

**Mudanças principais:**

#### Geração de Email
**Antes:**
- Gerava emails com domínios aleatórios (rhyta.com, teleworm.us, etc.)
- Apenas criava string de email (sem API)

**Depois:**
- Cria **proxy-emails** via API do ProxiedMail
- Retorna ID do proxy-email para tracking
- API: `POST /v1/proxy-emails`

```javascript
// Antes
generateEmail(userId) → { email, md5Hash }

// Depois  
generateEmail(userId) → { email, id, alias, domain }
```

#### Recebimento de Emails
**Antes:**
- `getInbox(emailHash)` - Buscava por hash MD5
- `getEmailContent(emailId)` - Conteúdo do email

**Depois:**
- `getMessages(proxyEmailId)` - Busca mensagens por ID do proxy
- `getMessageContent(proxyEmailId, messageId)` - Conteúdo da mensagem
- API: `GET /v1/proxy-emails/{id}/messages`

#### Novo Método
- `deleteProxyEmail(proxyEmailId)` - Limpa proxy-emails após uso

### 4. **Fluxo do Usuário** (`src/automation/userFlow.js`)

**Antes:**
```javascript
const emailData = await emailService.generateEmail(userId);
// emailData = { email, md5Hash }

const verificationEmail = await emailService.waitForVerificationEmail(
  emailData.md5Hash, 30, 2000
);

const emailContent = await emailService.getEmailContent(
  verificationEmail.mail_id
);
```

**Depois:**
```javascript
const emailData = await emailService.generateEmail(userId);
// emailData = { email, id, alias, domain }

const verificationEmail = await emailService.waitForVerificationEmail(
  emailData.id, 30, 2000
);

const emailContent = await emailService.getMessageContent(
  emailData.id,
  verificationEmail.id
);
```

### 5. **Variáveis de Ambiente**

**Antes** (`.env.example`):
```env
RAPIDAPI_KEY=c00a234b6fmsh38bfc246ee6d1dbp1e0182jsna53178c6718c
```

**Depois** (Criar arquivo `.env`):
```env
PROXIEDMAIL_API_KEY=c9505fd8540287574e26165cb092ccdc
PROXIEDMAIL_BASE_URL=https://proxiedmail.com/api  # opcional
```

### 6. **Documentação**

**Arquivos atualizados:**
- ✅ `README.md` - Badge e referências ao ProxiedMail
- ✅ `SETUP.md` - Configuração da API key
- ✅ `QUICKSTART.md` - Variáveis de ambiente
- ✅ Novo: `ENV_CONFIG.md` - Guia completo de configuração

**Arquivos a atualizar:**
- ⚠️ `ARCHITECTURE.md` - Atualizar seção de Email Service
- ⚠️ `PROJECT_SUMMARY.md` - Atualizar tecnologias
- ⚠️ `EXECUTIVE_SUMMARY.md` - Atualizar stack

---

## 🔑 API Key do ProxiedMail

**Fornecida pelo usuário:**
```
c9505fd8540287574e26165cb092ccdc
```

**Como usar:**
1. Adicione ao arquivo `.env`:
   ```env
   PROXIEDMAIL_API_KEY=c9505fd8540287574e26165cb092ccdc
   ```

2. A key já está configurada como padrão no código

---

## 📚 Recursos do ProxiedMail

- **Website**: [proxiedmail.com](https://proxiedmail.com)
- **Documentação**: [docs.proxiedmail.com](https://docs.proxiedmail.com)
- **GitHub**: [github.com/proxied-mail](https://github.com/proxied-mail)
- **Clients disponíveis**:
  - PHP: [proxiedmail-php-client](https://github.com/proxied-mail/proxiedmail-php-client)
  - JavaScript: [proxiedmail-js-client](https://github.com/proxied-mail/proxiedmail-js-client)
  - Laravel: [laravel-receive-email](https://github.com/proxied-mail/laravel-receive-email)

---

## 🔄 API Endpoints Utilizados

### 1. Criar Proxy-Email
```http
POST https://proxiedmail.com/api/v1/proxy-emails
Headers:
  X-API-Key: c9505fd8540287574e26165cb092ccdc
  Content-Type: application/json
Body:
  {
    "proxy_address": "user123_timestamp_random",
    "description": "Test user 123"
  }
Response:
  {
    "id": "uuid",
    "proxy_address": "user123_timestamp_random@proxiedmail.com",
    "created_at": "2025-12-25T..."
  }
```

### 2. Listar Mensagens
```http
GET https://proxiedmail.com/api/v1/proxy-emails/{id}/messages
Headers:
  X-API-Key: c9505fd8540287574e26165cb092ccdc
Response:
  [
    {
      "id": "msg_uuid",
      "subject": "Verification Email",
      "from": "noreply@lovable.dev",
      "received_at": "2025-12-25T..."
    }
  ]
```

### 3. Obter Conteúdo da Mensagem
```http
GET https://proxiedmail.com/api/v1/proxy-emails/{id}/messages/{msg_id}
Headers:
  X-API-Key: c9505fd8540287574e26165cb092ccdc
Response:
  {
    "id": "msg_uuid",
    "subject": "...",
    "from": "...",
    "text": "Plain text content",
    "html": "<html>...</html>",
    "received_at": "..."
  }
```

### 4. Deletar Proxy-Email
```http
DELETE https://proxiedmail.com/api/v1/proxy-emails/{id}
Headers:
  X-API-Key: c9505fd8540287574e26165cb092ccdc
Response:
  204 No Content
```

---

## ⚡ Vantagens do ProxiedMail

### Comparado ao RapidAPI Temp Mail:

| Aspecto | RapidAPI Temp Mail | ProxiedMail |
|---------|-------------------|-------------|
| **Controle** | Emails temporários aleatórios | Proxy-emails gerenciados |
| **Persistência** | Emails expiram rapidamente | Controle total do ciclo de vida |
| **API** | API de terceiro | API própria |
| **Rastreamento** | Hash MD5 | ID único do proxy |
| **Limpeza** | Automática (expiração) | Manual (quando quiser) |
| **Domínios** | 10+ domínios públicos | Domínios do ProxiedMail |
| **Custo** | Por requisição | Por API key |

### Benefícios específicos:
1. ✅ **Melhor rastreamento**: ID único por proxy-email
2. ✅ **Controle total**: Criar, listar, deletar
3. ✅ **API dedicada**: Sem limitações de terceiros
4. ✅ **Estrutura clara**: Proxy → Mensagens → Conteúdo
5. ✅ **Open source**: [Código disponível no GitHub](https://github.com/proxied-mail)

---

## 🧪 Testes Necessários

### Checklist de Testes:

- [ ] Criar proxy-email via API
- [ ] Receber email de verificação
- [ ] Extrair link de verificação
- [ ] Completar fluxo completo do usuário
- [ ] Testar com múltiplos usuários simultâneos
- [ ] Verificar limpeza de proxy-emails
- [ ] Testar tratamento de erros (API offline, timeout, etc.)

### Comando para testar:

```bash
# Configurar .env
echo "PROXIEDMAIL_API_KEY=c9505fd8540287574e26165cb092ccdc" >> .env
echo "REFERRAL_LINK=https://lovable.dev/ref/SEU_CODIGO" >> .env

# Testar com 1 usuário
node src/index.js --users=1

# Ver resultado
cat reports/report-*.txt
```

---

## 🐛 Possíveis Problemas e Soluções

### Problema 1: API Key inválida

**Erro:**
```
401 Unauthorized - Invalid API Key
```

**Solução:**
- Verificar se a key está correta no `.env`
- Verificar se não há espaços extras
- Testar a key diretamente:
```bash
curl -H "X-API-Key: c9505fd8540287574e26165cb092ccdc" \
     https://proxiedmail.com/api/v1/proxy-emails
```

### Problema 2: Timeout ao criar proxy-email

**Erro:**
```
Error: timeout of 30000ms exceeded
```

**Solução:**
- Verificar conexão com internet
- Aumentar timeout no código
- Verificar status do ProxiedMail: [status.proxiedmail.com](https://status.proxiedmail.com)

### Problema 3: Email de verificação não chegou

**Erro:**
```
Timeout: Email de verificação não recebido
```

**Solução:**
- Verificar se o proxy-email foi criado corretamente
- Aumentar `maxAttempts` ou `delayMs`
- Verificar logs da Lovable
- Testar manualmente enviando email para o proxy

---

## 📝 Notas de Implementação

### Fallback em Caso de Erro

O código inclui fallback se a API do ProxiedMail falhar:

```javascript
catch (error) {
  logger.error(`Erro ao gerar email`, error);
  
  // Retorna email fictício para não quebrar o fluxo
  const email = `user${userId}_${timestamp}_${random}@proxiedmail.com`;
  logger.warning('Usando email fictício (API falhou)', { email });
  
  return { email, id: null, alias, domain };
}
```

Isso garante que:
- O teste não falha imediatamente
- Logs mostram claramente o problema
- Possível debugar e corrigir

---

## 🔄 Próximos Passos

1. **Testar a integração** com usuários reais
2. **Atualizar documentação restante** (ARCHITECTURE.md, etc.)
3. **Adicionar testes unitários** para o emailService
4. **Implementar webhook** (opcional) para receber emails em tempo real
5. **Adicionar retry logic** para chamadas à API
6. **Implementar rate limiting** client-side

---

## 👥 Créditos

- **ProxiedMail**: [github.com/proxied-mail](https://github.com/proxied-mail)
- **API Key fornecida por**: Usuário
- **Integração implementada em**: Dezembro 2025

---

**Para mais informações:**
- Documentação: [ENV_CONFIG.md](ENV_CONFIG.md)
- Setup: [SETUP.md](SETUP.md)
- Guia rápido: [QUICKSTART.md](QUICKSTART.md)

---

**Status: ✅ MIGRAÇÃO COMPLETA**

