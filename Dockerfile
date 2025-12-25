# Use Node.js 20 LTS
FROM node:20-slim

# Instalar dependências do sistema para Playwright
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libatspi2.0-0 \
    libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

# Criar diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências (incluindo dev para playwright)
RUN npm ci

# Instalar navegadores do Playwright
RUN npx playwright install chromium
RUN npx playwright install-deps chromium

# Copiar código da aplicação
COPY . .

# Criar diretório de dados se não existir
RUN mkdir -p data

# Expor porta
EXPOSE 3000

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV WEB_PORT=3000
ENV BASE_PATH=/main

# Comando para iniciar o servidor
CMD ["npm", "start"]

