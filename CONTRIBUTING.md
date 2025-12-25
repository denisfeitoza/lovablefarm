# 🤝 Guia de Contribuição

## 📝 Como Contribuir

Obrigado por considerar contribuir para o Lovable Referral Tester! Este documento fornece diretrizes para contribuições.

## 🐛 Reportar Bugs

Se encontrar um bug, por favor abra uma issue com:

1. **Descrição clara** do problema
2. **Passos para reproduzir**
3. **Comportamento esperado** vs **comportamento atual**
4. **Screenshots** (se aplicável)
5. **Logs** relevantes de `reports/`
6. **Ambiente**:
   - Versão do Node.js
   - Sistema operacional
   - Configurações relevantes do `.env`

## ✨ Sugerir Melhorias

Para sugerir novas funcionalidades:

1. Verifique se já não existe uma issue similar
2. Descreva o problema que a feature resolve
3. Proponha uma solução
4. Considere alternativas

## 🔧 Desenvolvimento

### Setup do Ambiente de Desenvolvimento

```bash
# Clone o repositório
git clone <repo-url>
cd lovable-referral-tester

# Instale dependências
npm install

# Configure ambiente
cp .env.example .env
# Edite .env com suas configurações

# Instale navegadores
npm run install:browsers
```

### Estrutura de Branches

- `main`: Branch principal (produção)
- `develop`: Branch de desenvolvimento
- `feature/nome-da-feature`: Novas funcionalidades
- `fix/nome-do-bug`: Correções de bugs

### Padrões de Código

#### JavaScript/Node.js
- Use ES6+ modules (`import/export`)
- Use `async/await` ao invés de callbacks
- Prefira `const` e `let` ao invés de `var`
- Use template strings quando apropriado
- Documente funções complexas com JSDoc

#### Exemplo de Código

```javascript
/**
 * Gera um email temporário único
 * @param {number} userId - ID do usuário
 * @returns {Promise<Object>} Dados do email gerado
 */
async function generateEmail(userId) {
  try {
    // Implementação
    return { email, domain, md5Hash };
  } catch (error) {
    logger.error('Erro ao gerar email', error);
    throw error;
  }
}
```

#### Commits

Use mensagens de commit descritivas:

```
feat: adicionar suporte a proxies SOCKS5
fix: corrigir extração de link de verificação
docs: atualizar guia de instalação
refactor: simplificar lógica de retry
test: adicionar testes para emailService
```

Prefixos:
- `feat`: Nova funcionalidade
- `fix`: Correção de bug
- `docs`: Documentação
- `refactor`: Refatoração de código
- `test`: Testes
- `chore`: Tarefas de manutenção

### Testes

Antes de submeter um PR:

```bash
# Teste com poucos usuários
node src/index.js --users=5

# Verifique os logs
cat reports/report-*.txt

# Execute em modo não-headless para debug
# Edite .env: HEADLESS=false
```

### Pull Requests

1. Crie uma branch a partir de `develop`
2. Faça suas alterações
3. Teste localmente
4. Commit com mensagens descritivas
5. Push para seu fork
6. Abra PR para `develop`

**Checklist do PR**:
- [ ] Código testado localmente
- [ ] Documentação atualizada
- [ ] Sem erros de lint
- [ ] Commits com mensagens descritivas
- [ ] Screenshots (se mudança visual)

## 📚 Áreas que Precisam de Ajuda

### Alta Prioridade
- [ ] Testes unitários e de integração
- [ ] Suporte a mais navegadores (Firefox, Safari)
- [ ] Dashboard web para visualização
- [ ] Integração com CI/CD

### Média Prioridade
- [ ] Suporte a proxies SOCKS5
- [ ] Sistema de retry mais inteligente
- [ ] Captcha solving
- [ ] Webhooks para notificações

### Baixa Prioridade
- [ ] Suporte a múltiplas linguagens
- [ ] CLI mais interativo
- [ ] Docker support
- [ ] Kubernetes deployment

## 🎨 Melhorias de UX

- Melhorar mensagens de erro
- Adicionar barra de progresso mais detalhada
- Relatórios em HTML
- Gráficos de performance

## 🔐 Segurança

Se encontrar uma vulnerabilidade de segurança:

1. **NÃO** abra uma issue pública
2. Entre em contato diretamente
3. Forneça detalhes da vulnerabilidade
4. Aguarde resposta antes de divulgar

## 📄 Licença

Ao contribuir, você concorda que suas contribuições serão licenciadas sob a mesma licença do projeto (MIT).

## 💬 Comunicação

- Issues: Para bugs e features
- Discussions: Para perguntas e ideias
- Email: Para questões privadas

## 🙏 Reconhecimento

Todos os contribuidores serão reconhecidos no README.md!

---

Obrigado por contribuir! 🚀

