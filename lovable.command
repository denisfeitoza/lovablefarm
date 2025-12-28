#!/bin/bash

# Obter diretório atual do script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "════════════════════════════════════════════════════════════"
echo "  🚀 LOVABLE REFERRAL TESTER - Iniciando..."
echo "════════════════════════════════════════════════════════════"
echo ""

# Verificar dependências
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
    echo ""
fi

# Usar porta da variável de ambiente ou padrão 3000
PORT=${PORT:-${WEB_PORT:-3000}}

# Verificar e matar processos na porta
PID=$(lsof -ti:$PORT)
if [ ! -z "$PID" ]; then
    echo "⚠️  Porta $PORT já está em uso (PID: $PID)"
    echo "🛑 Encerrando processo anterior..."
    kill -9 $PID 2>/dev/null
    sleep 1
    echo "✅ Porta $PORT liberada"
    echo ""
fi

# Iniciar servidor em background
echo "🚀 Iniciando servidor web..."
npm run web &
SERVER_PID=$!

# Aguardar servidor iniciar
echo "⏳ Aguardando servidor..."
sleep 3

# Abrir navegador padrão
echo "🌐 Abrindo Dashboard..."
open "http://localhost:$PORT"

# Manter terminal aberto e monitorar processo
echo ""
echo "✅ Sistema Online!"
echo "📍 Dashboard: http://localhost:$PORT"
echo "🛑 Pressione Ctrl+C para encerrar"
echo ""

# Função para encerrar servidor ao fechar
cleanup() {
    echo ""
    echo "🛑 Encerrando servidor..."
    kill $SERVER_PID
    exit
}

trap cleanup SIGINT

# Aguardar processo do servidor
wait $SERVER_PID

