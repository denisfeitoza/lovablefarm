# 👋 Bem-vindo ao Lovable Referral Tester!

## 🎉 Parabéns! Você tem em mãos um sistema completo de testes em escala.

---

## 🚀 Primeiros Passos (5 minutos)

### 1️⃣ Instale tudo (2 min)

```bash
cd /Users/denisfeitozadejesus/Documents/Lovable
npm run setup
```

### 2️⃣ Configure o link de indicação (1 min)

Edite o arquivo `.env`:

```bash
nano .env
```

Substitua:

```env
REFERRAL_LINK=https://lovable.dev/ref/SEU_CODIGO_AQUI
```

Por seu link real.

### 3️⃣ Execute seu primeiro teste (2 min)

```bash
npm run test:small
```

**Pronto!** Você acabou de simular 10 usuários completando o fluxo de indicação! 🎉

---

## 📚 O que você pode fazer agora?

### 🎯 Testes Rápidos

```bash
# 10 usuários
npm run test:small

# 100 usuários
npm run test:medium

# 1000 usuários
npm run test:large
```

### 📊 Ver Resultados

```bash
# Ver último relatório
cat reports/report-*.txt | tail -100

# Ver relatórios em JSON
cat reports/report-*.json | jq .
```

### 🔧 Personalizar

```bash
# Número específico de usuários
node src/index.js --users=50

# Com mais concorrência
node src/index.js --users=100 --concurrent=10
```

---

## 📖 Documentação Disponível

Você tem acesso a **documentação completa** em português:

| Documento | O que você encontra | Tempo |
|-----------|---------------------|-------|
| **[README.md](README.md)** | Visão geral do projeto | 5 min |
| **[QUICKSTART.md](QUICKSTART.md)** | Guia rápido de início | 5 min |
| **[SETUP.md](SETUP.md)** | Setup e configuração detalhada | 15 min |
| **[EXAMPLES.md](EXAMPLES.md)** | 10+ exemplos práticos | 15 min |
| **[FAQ.md](FAQ.md)** | Perguntas frequentes | 10 min |
| **[COMMANDS.md](COMMANDS.md)** | Todos os comandos úteis | 10 min |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | Como o sistema funciona | 20 min |
| **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** | Resumo completo do projeto | 10 min |
| **[CONTRIBUTING.md](CONTRIBUTING.md)** | Como contribuir | 10 min |

---

## 🎓 Recomendações de Leitura

### Se você é iniciante:

1. **[QUICKSTART.md](QUICKSTART.md)** - Comece aqui! ⚡
2. **[FAQ.md](FAQ.md)** - Tire suas dúvidas ❓
3. **[EXAMPLES.md](EXAMPLES.md)** - Veja casos práticos 📖

### Se você quer entender tudo:

1. **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** - Visão geral 📦
2. **[ARCHITECTURE.md](ARCHITECTURE.md)** - Como funciona 🏗️
3. **[SETUP.md](SETUP.md)** - Configurações avançadas 🔧

### Se você quer dominar o sistema:

1. **[COMMANDS.md](COMMANDS.md)** - Todos os comandos 🎮
2. **[EXAMPLES.md](EXAMPLES.md)** - Casos avançados 🎯
3. **[CONTRIBUTING.md](CONTRIBUTING.md)** - Contribua! 🤝

---

## 💡 Dicas Importantes

### ✅ Sempre Comece Pequeno

```bash
# Primeiro teste com 5 usuários
node src/index.js --users=5
```

### ✅ Valide Sua Configuração

```bash
npm run validate
```

### ✅ Use Modo Debug Quando Necessário

Edite `.env`:

```env
HEADLESS=false
SLOW_MO=500
```

Execute:

```bash
node src/index.js --users=1
```

### ✅ Monitore os Resultados

```bash
# Ver taxa de sucesso
cat reports/report-*.json | jq '.summary.successRate'

# Ver erros
cat reports/report-*.json | jq '.errors'
```

---

## 🎯 Objetivos de Taxa de Sucesso

- **> 90%**: Excelente! Sistema funcionando perfeitamente ✅
- **70-90%**: Bom! Alguns ajustes podem melhorar ⚠️
- **< 70%**: Investigar! Algo pode estar errado ❌

---

## 🚨 Problemas Comuns e Soluções

### ❌ "REFERRAL_LINK não configurado"

**Solução**: Edite `.env` e configure o link de indicação.

### ❌ Taxa de sucesso baixa

**Solução**:

1. Verifique se o link está correto
2. Execute em modo debug
3. Verifique os logs em `reports/`

### ❌ Timeouts frequentes

**Solução**: Aumente os timeouts no `.env`:

```env
TIMEOUT_MS=120000
DELAY_BETWEEN_ACTIONS_MS=2000
```

---

## 🌟 Recursos Disponíveis

### ✅ Emails Rotativos

- 10 domínios diferentes
- Emails únicos por usuário
- Acesso automático à inbox

### ✅ Rotação de IP (opcional)

- Suporte a proxies HTTP/HTTPS
- Configuração simples no `.env`

### ✅ Relatórios Detalhados

- JSON para análise programática
- TXT para leitura humana
- Screenshots de erros

### ✅ Execução em Escala

- 10, 100, 1000+ usuários
- Controle de concorrência
- Progresso em tempo real

---

## 🎁 Bônus: Comandos Úteis

### Ver Ajuda

```bash
node src/index.js --help
```

### Validar Setup

```bash
npm run validate
```

### Ver Último Relatório

```bash
cat reports/report-*.txt | tail -50
```

### Limpar Relatórios Antigos

```bash
mkdir -p reports/archive
mv reports/report-*.* reports/archive/
```

---

## 🤝 Precisa de Ajuda?

### 1. Consulte a documentação

Temos **9 documentos** cobrindo tudo!

### 2. Verifique o FAQ

[FAQ.md](FAQ.md) tem respostas para as perguntas mais comuns.

### 3. Execute em modo debug

```bash
# Edite .env: HEADLESS=false
node src/index.js --users=1
```

### 4. Verifique os logs

```bash
cat reports/report-*.txt
ls reports/error-*.png
```

---

## 🎉 Você está pronto!

Agora você tem:

- ✅ Sistema instalado e configurado
- ✅ Documentação completa em português
- ✅ Exemplos práticos
- ✅ Comandos úteis
- ✅ Suporte para troubleshooting

**Comece seus testes e valide seu sistema de indicação em escala!** 🚀

---

## 📞 Próximos Passos

1. **Execute seu primeiro teste**:

   ```bash
   npm run test:small
   ```

2. **Analise os resultados**:

   ```bash
   cat reports/report-*.txt
   ```

3. **Ajuste as configurações** se necessário

4. **Escale gradualmente**:
   - 10 usuários ✅
   - 50 usuários ✅
   - 100 usuários ✅
   - 1000 usuários ✅

---

## 🌟 Boa sorte com seus testes!

**Lembre-se**: Sempre comece pequeno e escale gradualmente.

**Dúvidas?** Consulte a [documentação completa](README.md)!

---

**Desenvolvido com ❤️ para testes de qualidade em escala**

