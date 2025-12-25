# 🎯 INTEGRAÇÃO INBOUND.NEW

## 📋 Resumo
**Inbound.new** é uma plataforma de email programável que permite:
- ✅ Enviar emails
- ✅ Receber emails (via webhooks ou API)  
- ✅ Domínios customizados (como `equipeartificial.com`)

## 🔧 Configuração Necessária

### 1. Configurar Domínio no Painel
1. Acesse https://inbound.new/dashboard
2. Adicione o domínio: `equipeartificial.com`
3. Copie os registros DNS fornecidos

### 2. Configurar DNS
Adicione no seu provedor de DNS:
- **Registros MX**: Para receber emails
- **Registros TXT (SPF/DKIM)**: Para autenticação

### 3. Obter API Key
1. No painel do inbound.new
2. Vá em Settings → API Keys
3. Crie uma nova API key
4. Guarde a key com segurança

## 📦 Instalação

```bash
npm install inboundemail
```

## 🚀 Uso da API

### Enviar Email
```javascript
import inbound from 'inboundemail'

const client = inbound({ apiKey: 'sua-api-key' })

await client.email.send({
  from: 'Nome <email@equipeartificial.com>',
  to: ['destino@example.com'],
  subject: 'Assunto',
  html: '<p>Conteúdo</p>'
})
```

### Receber Emails (2 opções)

#### Opção 1: Webhooks (Recomendado)
- Configure um webhook endpoint no painel
- Inbound.new envia POST request quando email chega
- Mais rápido e eficiente

#### Opção 2: Polling via API
```javascript
// Listar mailboxes
const mailboxes = await client.mailboxes.list()

// Obter emails de um mailbox
const emails = await client.mailboxes.emails.list({
  mailbox_id: 'mailbox-id'
})

// Ler email específico
const email = await client.mailboxes.emails.get({
  mailbox_id: 'mailbox-id',
  email_id: 'email-id'
})
```

## 🎯 Para Nossa Automação

### O que precisamos:
1. **API Key do Inbound.new**
2. **Domínio configurado**: `equipeartificial.com`
3. **Criar mailbox** para receber emails
4. **Polling** para verificar emails de verificação

### Fluxo:
1. Gerar email: `randomname@equipeartificial.com`
2. Cadastrar no Lovable com esse email
3. Aguardar email de verificação (via polling ou webhook)
4. Extrair link de verificação
5. Clicar no link
6. Continuar automação

