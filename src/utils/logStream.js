import { EventEmitter } from 'events';

class LogStream extends EventEmitter {
  emitLog(level, message, data) {
    this.emit('log', {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    });
  }
}

export const logStream = new LogStream();

