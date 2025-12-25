#!/bin/bash

# Script de inicialização do Lovable Referral Tester
# Interface Web com Dashboard

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  🚀 LOVABLE REFERRAL TESTER - Iniciando..."
echo "════════════════════════════════════════════════════════════"
echo ""

# Verificar se node_modules existe
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
    echo ""
fi

# Verificar se Playwright está instalado
if [ ! -d "node_modules/playwright/.local-browsers" ]; then
    echo "🌐 Instalando navegadores do Playwright..."
    npx playwright install chromium
    echo ""
fi

# Iniciar servidor web
echo "🚀 Iniciando servidor web..."
echo ""
npm run web

