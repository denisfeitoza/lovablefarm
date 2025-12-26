import chalk from 'chalk';
import { logStream } from './logStream.js';

class Logger {
  constructor() {
    this.logs = [];
  }

  info(message, data = {}) {
    const timestamp = new Date().toISOString();
    const log = { level: 'info', message, data, timestamp };
    this.logs.push(log);
    logStream.emitLog('info', message, data);
    console.log(chalk.blue(`[INFO]`), chalk.gray(timestamp), message);
    if (Object.keys(data).length > 0) {
      console.log(chalk.gray(JSON.stringify(data, null, 2)));
    }
  }

  success(message, data = {}) {
    const timestamp = new Date().toISOString();
    const log = { level: 'success', message, data, timestamp };
    this.logs.push(log);
    logStream.emitLog('success', message, data);
    console.log(chalk.green(`[SUCCESS]`), chalk.gray(timestamp), message);
    if (Object.keys(data).length > 0) {
      console.log(chalk.gray(JSON.stringify(data, null, 2)));
    }
  }

  warning(message, data = {}) {
    const timestamp = new Date().toISOString();
    const log = { level: 'warning', message, data, timestamp };
    this.logs.push(log);
    logStream.emitLog('warning', message, data);
    console.log(chalk.yellow(`[WARNING]`), chalk.gray(timestamp), message);
    if (Object.keys(data).length > 0) {
      console.log(chalk.gray(JSON.stringify(data, null, 2)));
    }
  }

  error(message, error = null) {
    const timestamp = new Date().toISOString();
    const log = { 
      level: 'error', 
      message, 
      error: error ? error.message : null,
      stack: error ? error.stack : null,
      timestamp 
    };
    this.logs.push(log);
    logStream.emitLog('error', message, { error: log.error });
    console.log(chalk.red(`[ERROR]`), chalk.gray(timestamp), message);
    if (error) {
      console.log(chalk.red(error.message));
      if (error.stack) {
        console.log(chalk.gray(error.stack));
      }
    }
  }

  step(step, message) {
    const timestamp = new Date().toISOString();
    logStream.emitLog('step', `[ETAPA ${step}] ${message}`, { step });
    console.log(chalk.cyan(`[STEP ${step}]`), chalk.gray(timestamp), message);
  }

  confirmed(message, data = {}) {
    const timestamp = new Date().toISOString();
    const log = { level: 'confirmed', message, data, timestamp };
    this.logs.push(log);
    logStream.emitLog('confirmed', message, data);
    console.log(chalk.magenta(`[CONFIRMED]`), chalk.gray(timestamp), chalk.magenta(message));
    if (Object.keys(data).length > 0) {
      console.log(chalk.gray(JSON.stringify(data, null, 2)));
    }
  }

  getLogs() {
    return this.logs;
  }

  clear() {
    this.logs = [];
  }
}

export const logger = new Logger();

