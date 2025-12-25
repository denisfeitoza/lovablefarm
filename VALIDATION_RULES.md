# ✅ Regras de Validação de Links de Verificação

## 🎯 Formato Obrigatório

O sistema **APENAS** aceita e clica em links que seguem este formato exato:

```
https://lovable.dev/auth/action?mode=verifyEmail&oobCode=...&apiKey=...&lang=...
```

### ✅ Componentes Obrigatórios

1. **Domínio**: `lovable.dev`
2. **Path**: `/auth/action`
3. **Parâmetro obrigatório**: `mode=verifyEmail`
4. **Parâmetro obrigatório**: `oobCode=...` (código de verificação único)
5. **Parâmetros opcionais**: `apiKey=...`, `lang=...`, etc.

---

## 🚫 O que o Sistema NÃO Aceita

O sistema **REJEITA** qualquer link que não seja deste formato específico:

- ❌ Links de outros domínios
- ❌ Links sem `mode=verifyEmail`
- ❌ Links sem `oobCode`
- ❌ Links de outras rotas (`/verify`, `/confirm`, etc.)
- ❌ Links de outros serviços de email

---

## 🔍 Validação em Duas Etapas

### 1️⃣ Extração do Link (emailService.js)

O sistema procura **apenas** por este padrão no conteúdo do email:

```javascript
/https?:\/\/lovable\.dev\/auth\/action\?mode=verifyEmail[^\s<>"']+/gi
```

**Critérios de aceitação:**
- ✅ URL começa com `https://lovable.dev/auth/action`
- ✅ Contém `mode=verifyEmail`
- ✅ Contém `oobCode=`

### 2️⃣ Validação Antes de Clicar (signup.js)

Antes de navegar para o link, o sistema valida:

```javascript
const isValidLovableLink = 
  verificationLink.includes('lovable.dev/auth/action') &&
  verificationLink.includes('mode=verifyEmail') &&
  verificationLink.includes('oobCode=');
```

Se não passar na validação, **o sistema não clica** e retorna erro.

---

## 📧 Filtragem de Emails

Além de validar o link, o sistema também filtra quais emails processar:

### ✅ Email Aceito Se:

- **De**: Contém "lovable" OU "noreply" OU "no-reply"
- **Assunto**: Contém "verif" OU "confirm" OU "ative" OU "activate" OU "verify"
- **Conteúdo**: Contém link no formato válido

### ❌ Email Rejeitado Se:

- Não é da Lovable
- Assunto não indica verificação
- Não contém link válido

---

## 📊 Exemplo de Validação

### ✅ Link Válido:

```
https://lovable.dev/auth/action?mode=verifyEmail&oobCode=0u4izBT0v3tJOHjyvHdRoJTS_IGvibPM1-S_DxxG7wgAAAGbVi7_DA&apiKey=AIzaSyBQNjlw9Vp4tP4VVeANzyPJnqbG2wLbYPw&lang=en
```

**Resultado**: ✅ Aceito e clicado

### ❌ Link Inválido (Exemplos):

```
https://lovable.dev/verify/abc123
```
**Resultado**: ❌ Rejeitado - não é `/auth/action`

```
https://lovable.dev/auth/action?mode=confirmEmail&token=xyz
```
**Resultado**: ❌ Rejeitado - não tem `mode=verifyEmail`

```
https://example.com/auth/action?mode=verifyEmail&oobCode=abc
```
**Resultado**: ❌ Rejeitado - não é `lovable.dev`

---

## 🔒 Segurança

Esta validação garante que:

1. ✅ **Apenas links da Lovable** são processados
2. ✅ **Apenas links de verificação de email** são usados
3. ✅ **Nenhum link malicioso** pode ser clicado
4. ✅ **Não clica em emails de outros serviços**

---

## 📝 Logs de Validação

Durante a execução, você verá logs assim:

### ✅ Sucesso:

```
[INFO] 🔍 Procurando link de verificação no email...
[SUCCESS] ✅ Link de verificação da Lovable encontrado!
[INFO] ✅ Link de verificação validado
[INFO] url: https://lovable.dev/auth/action?mode=verifyEmail&oobCode=...
[INFO] hasMode: true
[INFO] hasOobCode: true
```

### ❌ Falha:

```
[INFO] 🔍 Procurando link de verificação no email...
[ERROR] ❌ Nenhum link de verificação válido encontrado!
[ERROR] expectedFormat: https://lovable.dev/auth/action?mode=verifyEmail&oobCode=...
```

---

## 🧪 Teste a Validação

Para testar se a validação está funcionando:

```bash
# 1. Execute um teste
node src/index.js --users=1

# 2. Observe os logs
# Procure por:
# - "Link de verificação da Lovable encontrado!" ✅
# - "Link de verificação validado" ✅
# - OU "Nenhum link de verificação válido encontrado!" ❌
```

---

## 📚 Código Relacionado

- **Extração de Link**: `src/services/emailService.js` → `extractVerificationLink()`
- **Validação**: `src/automation/signup.js` → `verifyEmail()`
- **Filtragem de Emails**: `src/services/emailService.js` → `waitForVerificationEmail()`

---

**Status: ✅ VALIDAÇÃO IMPLEMENTADA**

O sistema agora **GARANTE** que apenas links válidos da Lovable no formato correto são processados!

