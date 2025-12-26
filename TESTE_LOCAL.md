# 🧪 Como Testar Localmente - Detecção de Domínio Cansado

## 🚀 Teste Rápido

### Opção 1: Teste Simples (Domínio Automático)

```bash
node test-local.js
```

### Opção 2: Teste com Domínio Específico

```bash
node test-local.js funcionariosdeia.com
```

ou

```bash
node test-local.js pixelhausia.com
```

---

## 📋 O Que o Teste Faz

1. ✅ Gera um email único
2. ✅ Abre o navegador (modo não-headless para você ver)
3. ✅ Preenche o formulário de cadastro
4. ✅ Clica em "Create"
5. ✅ **VERIFICA se aparece a notificação "Email address not eligible for referral program"**
6. ✅ Se aparecer, lança erro específico que será contabilizado no dashboard

---

## 🔍 Verificando a Detecção

### Se o Domínio Estiver Cansado:

Você verá no console:
```
❌ DOMÍNIO CANSADO DETECTADO!
📝 Notificação: Email address not eligible for referral program
📧 Email usado: usuario@dominio.com
```

E o resultado mostrará:
```
🔍 DETECÇÃO DE DOMÍNIO CANSADO:
✅ A notificação foi detectada corretamente!
✅ O erro será contabilizado no dashboard como erro de domínio.
```

### Se o Domínio Estiver OK:

O fluxo continua normalmente e você verá:
```
✅ TESTE CONCLUÍDO COM SUCESSO!
💰 Créditos gerados: 10
```

---

## 🎯 Testando com Dashboard

Para ver os erros no dashboard:

1. **Inicie o dashboard:**
```bash
npm run web
```

2. **Acesse:** http://localhost:3000

3. **Crie uma fila** com um domínio que você sabe que está cansado

4. **Execute o teste** e veja o erro aparecer na seção de erros, agrupado por domínio

---

## 🐛 Modo Debug

O teste roda em modo **não-headless** por padrão, então você pode ver o navegador abrindo e executando as ações.

Para ver mais logs detalhados, verifique o console do terminal.

---

## 📝 Notas

- O teste usa o link de indicação do arquivo `.env` ou o padrão
- Se quiser testar com um link específico, edite `test-local.js` ou use variável de ambiente:
  ```bash
  REFERRAL_LINK=https://lovable.dev/invite/SEU_CODIGO node test-local.js
  ```

