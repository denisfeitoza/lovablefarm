# 📋 Comandos Disponíveis

## 🚀 Iniciar Sistema

### Interface Web (Recomendado)
```bash
./start.sh           # Script bash automático
npm start            # Via npm
npm run web          # Alternativa
npm run dev          # Modo desenvolvimento
node src/web/server.js  # Node direto
```

**Acesso:** http://localhost:3000

---

## 🔧 Instalação e Setup

```bash
# Instalação completa (primeira vez)
npm run setup

# Apenas instalar dependências
npm install

# Apenas instalar navegadores
npm run install:browsers

# Validar configuração
npm run validate
```

---

## 🧪 Testes via CLI (sem interface)

```bash
# Teste com 1 usuário
node src/index.js --users=1

# Testes pré-definidos
npm test              # Padrão
npm run test:small    # 10 usuários
npm run test:medium   # 100 usuários
npm run test:large    # 1000 usuários
```

---

## 🌐 Interface Web

### Endpoints da API

```bash
# Stats
GET http://localhost:3000/api/stats

# Listar filas
GET http://localhost:3000/api/queues

# Criar fila
POST http://localhost:3000/api/queues
{
  "referralLink": "https://lovable.dev/invite/XXX",
  "name": "Minha Fila",
  "users": 10,
  "parallel": 3
}

# Iniciar fila
POST http://localhost:3000/api/queues/{queueId}/start

# Listar domínios
GET http://localhost:3000/api/domains

# Adicionar domínio
POST http://localhost:3000/api/domains
{
  "domain": "meudominio.com"
}

# Remover domínio
DELETE http://localhost:3000/api/domains/{domain}

# Resetar alternância de domínios
POST http://localhost:3000/api/domains/reset
```

---

## 🔍 Debug e Monitoramento

```bash
# Logs em tempo real
tail -f reports/*.log

# Ver últimas execuções
ls -lah reports/

# Monitorar porta
lsof -i :3000

# Ver processos Node
ps aux | grep node
```

---

## 🛑 Parar Sistema

```bash
# Pressionar Ctrl+C no terminal

# Ou forçar kill
pkill -f "node src/web/server.js"

# Matar todos os processos Node
pkill node
```

---

## ⚙️ Variáveis de Ambiente

```bash
# Mudar porta (padrão: 3000)
WEB_PORT=8080 npm start

# Modo headless (padrão: true)
HEADLESS=false npm start

# Modo debug
DEBUG_MODE=true npm start

# Inbound API
INBOUND_API_KEY=xxx npm start
INBOUND_DOMAIN=dominio.com npm start
```

---

## 📦 Estrutura de Arquivos

```
.
├── start.sh                 # Script de inicialização
├── package.json            # Dependências
├── .env                    # Configurações
├── src/
│   ├── web/
│   │   ├── server.js       # Servidor Express
│   │   ├── public/         # Interface HTML/CSS/JS
│   │   ├── api/            # Rotas da API
│   │   └── queue/          # Gerenciadores
│   ├── automation/         # Lógica de automação
│   ├── services/           # Serviços (email, proxy)
│   └── utils/              # Utilitários
├── config/
│   └── email-domains.json  # Domínios configurados
└── reports/                # Logs e relatórios
```

---

## 🔗 Links Úteis

- **Dashboard:** http://localhost:3000
- **API Docs:** http://localhost:3000/api/stats
- **WebSocket:** ws://localhost:3000

---

## 💡 Dicas

1. **Primeiro uso:** `npm run setup`
2. **Iniciar rápido:** `./start.sh`
3. **Abrir dashboard:** http://localhost:3000
4. **Adicionar domínios:** Interface web > ⚙️
5. **Criar fila:** Interface web > + Nova Fila
6. **Monitorar:** Painel em tempo real

---

## 🆘 Solução de Problemas

```bash
# Porta em uso?
lsof -i :3000
kill -9 <PID>

# Navegadores não instalados?
npx playwright install chromium

# Dependências faltando?
rm -rf node_modules package-lock.json
npm install

# Reset completo
npm run setup
```

---

## 🎯 Comando Completo de Setup

```bash
# Clone/navegue até o projeto
cd /path/to/lovable-referral-tester

# Instalação e configuração
npm run setup

# Configurar .env
cp .env.example .env
# Editar .env com suas chaves

# Iniciar
./start.sh

# Abrir navegador
open http://localhost:3000
```

---

**✨ Sistema pronto para uso!** 🚀

