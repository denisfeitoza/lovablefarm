# 🏗️ Arquitetura do Sistema

## 📐 Visão Geral

O Lovable Referral Tester é um sistema de automação em escala para testar fluxos de indicação. A arquitetura foi projetada para ser:

- **Escalável**: Suporta de 10 a 1000+ usuários simultâneos
- **Resiliente**: Tratamento de erros em cada etapa
- **Observável**: Logs detalhados e relatórios completos
- **Realista**: Simula comportamento humano com delays e variações

## 🗂️ Estrutura de Diretórios

```
lovable-referral-tester/
├── src/
│   ├── index.js                 # Ponto de entrada e orchestrator
│   ├── services/                # Serviços auxiliares
│   │   ├── emailService.js      # Gerenciamento de emails temporários
│   │   ├── proxyService.js      # Rotação de IPs
│   │   └── reportService.js     # Geração de relatórios
│   ├── automation/              # Módulos de automação
│   │   ├── userFlow.js          # Fluxo completo do usuário
│   │   ├── signup.js            # Cadastro e verificação
│   │   ├── onboarding.js        # Quiz de onboarding
│   │   └── project.js           # Criação/remix/publicação
│   └── utils/                   # Utilitários
│       ├── config.js            # Configurações centralizadas
│       └── logger.js            # Sistema de logs
├── reports/                     # Relatórios gerados
├── package.json
├── .env                         # Configurações (não versionado)
├── .env.example                 # Template de configurações
├── README.md                    # Documentação principal
├── SETUP.md                     # Guia de instalação
└── ARCHITECTURE.md              # Este arquivo
```

## 🔄 Fluxo de Execução

```
┌─────────────────────────────────────────────────────────┐
│                    1. Inicialização                      │
│  • Validar configuração                                  │
│  • Inicializar serviços (proxy, email)                   │
│  • Criar estrutura de relatórios                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              2. Orchestrator (index.js)                  │
│  • Criar pool de execução com p-limit                    │
│  • Gerenciar concorrência (5 usuários simultâneos)      │
│  • Monitorar progresso com spinner                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│           3. User Flow (para cada usuário)               │
│                                                           │
│  ┌─────────────────────────────────────────────┐        │
│  │ 3.1 Gerar Email Temporário                  │        │
│  │  • emailService.generateEmail()             │        │
│  │  • Domínio rotativo                         │        │
│  └─────────────────┬───────────────────────────┘        │
│                    │                                     │
│  ┌─────────────────▼───────────────────────────┐        │
│  │ 3.2 Configurar Navegador                    │        │
│  │  • Playwright + um                    │        │
│  │  • Proxy (se habilitado)                    │        │
│  │  • User-Agent aleatório                     │        │
│  │  • Geolocalização brasileira                │        │
│  │  • Anti-detecção de bot                     │        │
│  └─────────────────┬───────────────────────────┘        │
│                    │                                     │
│  ┌─────────────────▼───────────────────────────┐        │
│  │ 3.3 Cadastro (signup.js)                    │        │
│  │  • Navegar para link de indicação           │        │
│  │  • Preencher email e senha                  │        │
│  │  • Submeter formulário                      │        │
│  └─────────────────┬───────────────────────────┘        │
│                    │                                     │
│  ┌─────────────────▼───────────────────────────┐        │
│  │ 3.4 Verificação de Email                    │        │
│  │  • Aguardar email (polling)                 │        │
│  │  • Extrair link de verificação              │        │
│  │  • Clicar no link                           │        │
│  └─────────────────┬───────────────────────────┘        │
│                    │                                     │
│  ┌─────────────────▼───────────────────────────┐        │
│  │ 3.5 Quiz (onboarding.js)                    │        │
│  │  • Responder: next, next, other, solo       │        │
│  │  • Finalizar onboarding                     │        │
│  └─────────────────┬───────────────────────────┘        │
│                    │                                     │
│  ┌─────────────────▼───────────────────────────┐        │
│  │ 3.6 Projeto Template (project.js)           │        │
│  │  • Abrir template                           │        │
│  │  • Remixar projeto                          │        │
│  │  • Publicar projeto                         │        │
│  └─────────────────┬───────────────────────────┘        │
│                    │                                     │
│                    ▼                                     │
│              ✅ Sucesso!                                 │
│              💰 10 créditos gerados                      │
└─────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              4. Relatório (reportService.js)             │
│  • Agregar resultados                                    │
│  • Calcular métricas                                     │
│  • Gerar relatório JSON e TXT                            │
│  • Exibir no console                                     │
└─────────────────────────────────────────────────────────┘
```

## 🧩 Componentes Principais

### 1. **Orchestrator (index.js)**

Responsável por:
- Gerenciar execução em escala
- Controlar concorrência com `p-limit`
- Exibir progresso em tempo real
- Coordenar serviços

**Tecnologias**:
- `p-limit`: Controle de concorrência
- `ora`: Spinner de progresso
- `chalk`: Colorização de output

### 2. **Email Service (emailService.js)**

Responsável por:
- Gerar emails únicos com domínios rotativos
- Acessar inbox via RapidAPI
- Aguardar email de verificação (polling)
- Extrair links de verificação

**API**: RapidAPI Temp Mail (Privatix)

**Domínios suportados**:
- rhyta.com
- teleworm.us
- dayrep.com
- einrot.com
- armyspy.com
- superrito.com
- cuvox.de
- fleckens.hu
- gustr.com
- jourrapide.com

### 3. **Proxy Service (proxyService.js)**

Responsável por:
- Carregar lista de proxies
- Rotação round-robin ou aleatória
- Validação de proxies
- Estatísticas de uso

**Suporte**:
- HTTP/HTTPS proxies
- Autenticação (username/password)
- Lista manual ou URL

### 4. **Report Service (reportService.js)**

Responsável por:
- Coletar resultados de cada usuário
- Calcular métricas agregadas
- Gerar relatórios JSON e TXT
- Agrupar erros por tipo

**Métricas**:
- Taxa de sucesso
- Tempo médio por etapa
- Total de créditos gerados
- Distribuição de erros

### 5. **User Flow (userFlow.js)**

Orquestra o fluxo completo de um usuário:
- Inicializa navegador com Playwright
- Executa cada etapa sequencialmente
- Trata erros e captura screenshots
- Retorna resultado estruturado

**Anti-detecção**:
- Remove flag `navigator.webdriver`
- User-Agent aleatório
- Geolocalização brasileira
- Timezone correto
- Plugins simulados

### 6. **Automation Modules**

#### signup.js
- Preenche formulário de cadastro
- Múltiplos seletores (fallback)
- Verifica email via link

#### onboarding.js
- Completa quiz com respostas específicas
- Navegação entre questões
- Finalização do onboarding

#### project.js
- Abre template
- Remixa projeto
- Publica projeto
- Validação de sucesso

## 🔧 Tecnologias Utilizadas

### Core
- **Node.js 18+**: Runtime JavaScript
- **Playwright**: Automação de navegador
- **Axios**: Cliente HTTP

### Utilities
- **p-limit**: Controle de concorrência
- **ora**: Spinner de progresso
- **chalk**: Colorização de terminal
- **dotenv**: Gerenciamento de variáveis de ambiente

### APIs Externas
- **RapidAPI Temp Mail**: Emails temporários

## 🎯 Padrões de Design

### 1. **Service Layer Pattern**
Serviços isolados e reutilizáveis (email, proxy, report)

### 2. **Strategy Pattern**
Múltiplos seletores com fallback para encontrar elementos

### 3. **Factory Pattern**
Geração de User-Agents, geolocalizações, senhas

### 4. **Observer Pattern**
Sistema de logs e relatórios observam execução

### 5. **Promise Pool Pattern**
Controle de concorrência com `p-limit`

## 🔐 Segurança

### Dados Sensíveis
- `.env` não é versionado
- Senhas geradas aleatoriamente
- Emails temporários (descartáveis)

### Rate Limiting
- Delays entre ações
- Concorrência controlada
- Comportamento humano simulado

### Proxies
- Suporte a autenticação
- Validação de proxies
- Distribuição de carga

## 📊 Escalabilidade

### Vertical (mais recursos)
- Aumentar `MAX_CONCURRENT_USERS`
- Mais memória para navegadores

### Horizontal (mais máquinas)
- Executar em múltiplas máquinas
- Dividir carga de usuários
- Agregar relatórios

### Limites
- **Recomendado**: 5-10 usuários simultâneos por máquina
- **Máximo testado**: 1000 usuários totais
- **Bottleneck**: API de email temporário

## 🐛 Debugging

### Modo Debug
```env
HEADLESS=false
SLOW_MO=500
```

### Screenshots
Automaticamente capturados em erros em `reports/error-*.png`

### Logs
Sistema de logs estruturado com níveis:
- INFO: Informações gerais
- SUCCESS: Operações bem-sucedidas
- WARNING: Avisos
- ERROR: Erros com stack trace

## 🔄 Manutenção

### Atualizar Seletores
Se a interface da Lovable mudar, atualizar em:
- `src/automation/signup.js`
- `src/automation/onboarding.js`
- `src/automation/project.js`

### Adicionar Novos Domínios
Editar `config.emailDomains` em `src/utils/config.js`

### Adicionar Novas Métricas
Estender `reportService.generateReport()` em `src/services/reportService.js`

## 🚀 Melhorias Futuras

1. **Suporte a múltiplos navegadores** (Firefox, Safari)
2. **Integração com CI/CD** (GitHub Actions, Jenkins)
3. **Dashboard web** para visualização de resultados
4. **Suporte a múltiplas plataformas** (não apenas Lovable)
5. **Machine Learning** para adaptar seletores automaticamente
6. **Distributed testing** com Redis/RabbitMQ
7. **Captcha solving** se necessário
8. **Webhook notifications** (Slack, Discord)

