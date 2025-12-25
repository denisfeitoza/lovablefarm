# 🚀 Início Rápido - Lovable Referral Tester

## ⚡ Comandos para Iniciar

### Opção 1: Script Bash (Recomendado)
```bash
./start.sh
```

### Opção 2: NPM
```bash
npm start
# ou
npm run web
# ou
npm run dev
```

### Opção 3: Node Direto
```bash
node src/web/server.js
```

---

## 📋 Após Iniciar

1. **Abra o navegador:** http://localhost:3000
2. **Configure domínios de email** (se necessário)
3. **Crie uma nova fila:**
   - Cole o link de indicação
   - Defina nome e quantidade
   - Configure paralelismo (1-10)
4. **Clique em "Iniciar"** e acompanhe em tempo real!

---

## 🔧 Primeira Vez?

Se for a primeira vez, execute:

```bash
npm run setup
```

Isso vai:
- ✅ Instalar dependências
- ✅ Baixar navegadores do Playwright
- ✅ Validar configuração

---

## 📊 Painel de Controle

Após iniciar, você terá acesso a:

- **Dashboard em Tempo Real**: Estatísticas atualizadas ao vivo
- **Gerenciador de Filas**: Criar e controlar múltiplas filas
- **Gerenciador de Domínios**: Adicionar/remover domínios de email
- **Monitor de Execuções**: Ver sessões ativas em tempo real
- **API REST**: Integração via API (porta 3000)

---

## 🎯 Exemplo Rápido

```bash
# 1. Iniciar servidor
./start.sh

# 2. Abrir navegador
# http://localhost:3000

# 3. No dashboard:
# - Clicar em "+ Nova Fila"
# - Cole: https://lovable.dev/invite/XXXXXXX
# - Nome: "Teste 10 créditos"
# - Usuários: 10
# - Paralelo: 3
# - Clicar em "Criar Fila"
# - Clicar em "▶️ Iniciar"

# 4. Acompanhar progresso em tempo real!
```

---

## ⚙️ Configuração Avançada

### Mudar Porta (padrão: 3000)
```bash
WEB_PORT=8080 npm start
```

### Adicionar Domínios de Email
Via interface web:
1. Clicar em ⚙️ ao lado de "Domínios de Email"
2. Adicionar domínios customizados
3. Sistema alterna automaticamente

### Configurar API do Inbound.new
Edite `.env`:
```
INBOUND_API_KEY=sua_api_key_aqui
INBOUND_DOMAIN=seu_dominio.com
```

---

## 📞 Precisa de Ajuda?

- **Logs do Servidor**: Aparecem no terminal
- **Console do Navegador**: F12 para debug
- **Arquivos de Log**: Pasta `reports/`

---

## 🛑 Parar o Servidor

Pressione `Ctrl + C` no terminal onde está rodando.

---

## 🎉 Pronto!

O sistema está configurado para:
- ✅ Execução paralela (até 10 sessões)
- ✅ Fingerprints únicos por sessão
- ✅ WebGL randomizado
- ✅ Alternância de domínios de email
- ✅ Monitoramento em tempo real
- ✅ Interface web moderna

**Comece agora:** `./start.sh` 🚀

