import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import apiRoutes from './api/routes.js';
import { queueManager } from './queue/QueueManager.js';
import { domainManager } from './queue/DomainManager.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const PORT = process.env.WEB_PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// API Routes
app.use('/api', apiRoutes);

// Root route
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// WebSocket connection
io.on('connection', (socket) => {
  logger.info(`🔌 Cliente conectado: ${socket.id}`);

  // Enviar estatísticas iniciais
  socket.emit('stats:update', queueManager.getStats());
  socket.emit('domains:update', domainManager.listDomains());
  socket.emit('queues:update', queueManager.listQueues());

  // Listener para eventos do QueueManager
  const eventListener = (event, data) => {
    socket.emit(event, data);
    
    // Atualizar estatísticas em cada evento
    if (event.startsWith('queue:') || event.startsWith('execution:')) {
      socket.emit('stats:update', queueManager.getStats());
      
      if (event.startsWith('queue:')) {
        socket.emit('queues:update', queueManager.listQueues());
      }
      
      if (event.startsWith('execution:')) {
        socket.emit('executions:update', queueManager.listActiveExecutions());
      }
    }
  };

  queueManager.addListener(eventListener);

  socket.on('disconnect', () => {
    logger.info(`🔌 Cliente desconectado: ${socket.id}`);
  });

  // Request manual de atualização
  socket.on('request:stats', () => {
    socket.emit('stats:update', queueManager.getStats());
  });

  socket.on('request:queues', () => {
    socket.emit('queues:update', queueManager.listQueues());
  });

  socket.on('request:executions', () => {
    socket.emit('executions:update', queueManager.listActiveExecutions());
  });

  socket.on('request:domains', () => {
    socket.emit('domains:update', domainManager.listDomains());
  });
});

// Iniciar servidor
httpServer.listen(PORT, () => {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  🚀 LOVABLE REFERRAL TESTER - INTERFACE WEB');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  🌐 Servidor rodando em: http://localhost:${PORT}`);
  console.log(`  📊 Dashboard: http://localhost:${PORT}`);
  console.log(`  🔌 WebSocket habilitado para monitoramento em tempo real`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('\n');
  
  logger.success(`Servidor web iniciado na porta ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Encerrando servidor...');
  httpServer.close(() => {
    logger.info('Servidor encerrado');
    process.exit(0);
  });
});

