# 🧪 Como Testar - Guia Completo

## 🚀 Início Rápido

### Passo 1: Executar o Script Interativo

```bash
node test-interactive.js
```

### Passo 2: Responder as Perguntas

O script vai perguntar:

1. **📎 Link de indicação**: Cole seu link (ex: `https://lovable.dev/invite/FDKI2B1`)
2. **👥 Quantas indicações**: Digite o número (ex: `5`)
3. **▶️  Continuar?**: Digite `s` para confirmar

### Passo 3: Assistir os Testes

O navegador vai abrir e você verá:
- ✅ Cada etapa sendo executada
- 📸 Screenshots automáticos em `reports/`
- 📝 Logs detalhados no terminal

---

## 🎯 O Que o Sistema Faz

### Para CADA Indicação:

1. **Gera email único** (ex: `joao.silva1234@funcionariosdeia.com`)
2. **Acessa o link de indicação**
3. **Cadastra o usuário**:
   - Preenche email
   - Clica em "Continuar"
   - Preenche senha
   - Clica em "Criar"
4. **Monitora email de verificação**
5. **Clica no link de verificação** (na mesma sessão)
6. **Pula o quiz** (se aparecer)
7. **Vai para o template**
8. **Clica em "Usar Template"**
9. **Clica em "Publish"**
10. **✅ PRONTO!** 💰 +10 créditos

---

## 🐛 Modo DEBUG (Ativado Automaticamente)

O sistema já está configurado para DEBUG mode com:

### ✅ Screenshots Automáticos:

Salvos em `reports/debug-user-X-[etapa]-[timestamp].png`:

- `after-load-referral` - Depois de carregar link
- `before-email` - Antes de preencher email
- `after-email-fill` - Depois de preencher email
- `after-continue` - Depois de clicar em Continuar
- `after-password-fill` - Depois de preencher senha
- `after-create-click` - Depois de clicar em Criar
- `after-verify-link` - Depois de clicar no link de verificação
- `before-skip-quiz` - Antes de pular quiz
- `template-loaded` - Quando template carregar
- `before-use-template` - Antes de usar template
- `after-use-template-click` - Depois de clicar em Usar Template
- `after-publish-click` - Depois de clicar em Publish
- `publish-complete` - Depois de publicar

### ❌ Screenshots de Erro:

Se algo falhar:
- `error-user-X-[etapa]-[timestamp].png`
- `error-user-X-[etapa]-[timestamp].html` (HTML da página)

---

## ⚡ Otimizações Implementadas

### 🚀 Script Injection (Ativado)

Ao invés de simular cliques, o sistema **injeta JavaScript** diretamente na página quando possível:

```javascript
// Preencher campos INSTANTANEAMENTE:
input.value = 'valor';
input.dispatchEvent(new Event('input', { bubbles: true }));

// Clicar INSTANTANEAMENTE:
element.click();
```

**Vantagem**: Até **3x mais rápido** que cliques simulados!

### ⏱️ Timeouts Dinâmicos

- **Pageload**: 30s (generous para páginas lentas)
- **Email**: 15s para encontrar campo
- **Senha**: 15s para encontrar campo
- **Botões**: 8-20s dependendo da importância
- **Email chegando**: 60s de monitoramento

### 🔄 Fallback Automático

Se script injection falhar → usa método tradicional automaticamente

---

## 📊 O Que Você Verá no Terminal

```
════════════════════════════════════════════════════════
        🧪 LOVABLE REFERRAL TESTER - MODO DEBUG        
════════════════════════════════════════════════════════

📎 Link de indicação (ex: https://lovable.dev/invite/FDKI2B1): 
[VOCÊ COLA AQUI]

👥 Quantas indicações deseja testar? (cada uma = 10 créditos): 
[VOCÊ DIGITA AQUI]

════════════════════════════════════════════════════════
📋 RESUMO DO TESTE:
────────────────────────────────────────────────────────
📎 Link: https://lovable.dev/invite/FDKI2B1
👥 Indicações: 5
💰 Créditos esperados: 50
🐛 Modo DEBUG: ATIVADO (screenshots + logs detalhados)
⚡ Script Injection: ATIVADO (mais rápido)
🔍 Sistema de Ajuda: ATIVADO
════════════════════════════════════════════════════════

▶️  Continuar? (s/n): s

🚀 Iniciando testes...

════════════════════════════════════════════════════════
🚀 TESTANDO INDICAÇÃO 1/5
════════════════════════════════════════════════════════

📧 Gerando email temporário...
[INFO] Gerando email: joao.silva1234@funcionariosdeia.com
[SUCCESS] ✅ Email proxy criado!

📝 Etapa 1: Cadastro na Lovable
[INFO] Navegando para: https://lovable.dev/invite/FDKI2B1
[INFO] 📸 Screenshot salvo: reports/debug-user-1-after-load-referral-*.png
[SUCCESS] ✅ Link de indicação carregado
[INFO] 🔍 Procurando campo de email...
[SUCCESS] ✅ campo de email encontrado: input[type="email"] (2.3s)
[INFO] Preenchendo email: joao.silva1234@funcionariosdeia.com
[INFO] ⚡ Campo preenchido via script: input[type="email"]
[SUCCESS] ✅ Email preenchido
[SUCCESS] ✅ botão Continuar encontrado: button:has-text("Continue")
[INFO] ⚡ Clique via script: button:has-text("Continue")
[SUCCESS] ✅ Clicou em Continuar
[SUCCESS] ✅ campo de senha encontrado: input[type="password"] (1.8s)
[INFO] ⚡ Campo preenchido via script: input[type="password"]
[SUCCESS] ✅ Senha preenchida
[SUCCESS] ✅ botão Criar conta encontrado: button:has-text("Create")
[INFO] ⚡ Clique via script: button:has-text("Create")
[SUCCESS] ✅ Clicou em Criar conta
[SUCCESS] ✅ Cadastro concluído em 4500ms

📬 Etapa 2: Aguardando Email de Verificação
[INFO] 🔍 Monitorando chegada de email de verificação...
[INFO] 📬 Verificando inbox... (1/30)
[INFO] 📬 Verificando inbox... (2/30)
[INFO] ✉️  1 email(s) encontrado(s)
[SUCCESS] ✅ Email de verificação encontrado! (tempo: 4s)
[SUCCESS] ✅ Link extraído: https://lovable.dev/auth/action?...

✅ Etapa 3: Clicando em Link de Verificação (mesma sessão)
[INFO] ✅ Link de verificação validado
[SUCCESS] ✅ Email verificado em 6200ms

⏭️  Etapa 4: Pulando Quiz e Indo para Template
[SUCCESS] ✅ Quiz pulado
[SUCCESS] ✅ Template carregado

🚀 Etapa 5: Usando Template e Publicando
[SUCCESS] ✅ botão Usar Template encontrado: button:has-text("Use Template") (3.2s)
[INFO] ⚡ Clique via script: button:has-text("Use Template")
[SUCCESS] ✅ Clicou em "Usar Template"
[SUCCESS] ✅ botão Publish encontrado: button:has-text("Publish") (5.1s)
[INFO] ⚡ Clique via script: button:has-text("Publish")
[SUCCESS] ✅ Clicou em "Publish"
[SUCCESS] ✅ Template usado e publicado em 15800ms

✅ Indicação 1 concluída com sucesso! (32.5s)
💰 +10 créditos gerados

⏳ Aguardando 3 segundos antes da próxima indicação...

... (repete para indicações 2-5)

════════════════════════════════════════════════════════
           📊 RELATÓRIO FINAL DE TESTES
════════════════════════════════════════════════════════

✅ Sucessos: 5/5
❌ Falhas: 0/5
📈 Taxa de sucesso: 100.00%
💰 Créditos gerados: 50/50
⏱️  Tempo médio por indicação: 31.2s

════════════════════════════════════════════════════════
```

---

## ❌ Se Algo Falhar

### O sistema vai:

1. **Parar o teste**
2. **Mostrar o erro**:
   ```
   ❌ Indicação 3 falhou: Timeout: Email de verificação não recebido
   📍 Etapa que falhou: Verificação de Email
   📸 Screenshot salvo em: reports/error-user-3-verify-1234567890.png
   ```

3. **Perguntar se deve continuar**:
   ```
   ⚠️  Erro encontrado! Continuar testando próxima indicação? (s/n): 
   ```

### Você pode:

- Digite `n` → **Para e mostra relatório**
- Digite `s` → **Continua para próxima indicação**

---

## 🔍 Como Analisar Erros

### 1. Abra o screenshot do erro:

```bash
open reports/error-user-3-verify-1234567890.png
```

### 2. Veja o HTML (se necessário):

```bash
open reports/error-user-3-verify-1234567890.html
```

### 3. Veja todos os screenshots de debug:

```bash
ls -lh reports/debug-user-3-*.png
open reports/debug-user-3-*.png
```

### 4. Me mostre o erro:

- Compartilhe o screenshot
- Me diga qual etapa falhou
- Eu ajusto os seletores CSS

---

## 💡 Dicas

### Se botão não for encontrado:

1. **Verifique o screenshot** para ver o texto exato do botão
2. **Me informe**: "O botão está escrito 'Usar este template' ao invés de 'Use Template'"
3. **Eu adiciono** o seletor correto no código

### Se página demorar muito:

- Os timeouts já estão generosos (30s)
- Mas posso aumentar se necessário

### Para ver TUDO em câmera lenta:

Edite `.env` e adicione:
```env
DELAY_BETWEEN_ACTIONS_MS=3000
```

---

## 📁 Estrutura de Arquivos

Depois de executar, você terá:

```
reports/
├── debug-user-1-after-load-referral-1234567890.png
├── debug-user-1-before-email-1234567891.png
├── debug-user-1-after-email-fill-1234567892.png
├── ... (todos os screenshots de debug)
├── error-user-3-verify-1234567900.png (se houver erro)
└── error-user-3-verify-1234567900.html (HTML do erro)
```

---

## 🚀 Pronto!

Execute agora:

```bash
node test-interactive.js
```

E me avise se encontrar qualquer problema! 💪

---

**Lembre-se**:
- ✅ Navegador abre automaticamente (modo visual)
- ✅ Screenshots salvos automaticamente
- ✅ Script injection ativado (mais rápido)
- ✅ Sistema de ajuda integrado
- ✅ Cada indicação = 10 créditos

**Vamos testar!** 🎉

