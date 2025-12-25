import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class ReportService {
  constructor() {
    this.results = [];
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * Inicia o relatório
   */
  start() {
    this.startTime = Date.now();
    this.results = [];
  }

  /**
   * Adiciona resultado de um usuário
   */
  addResult(userId, result) {
    this.results.push({
      userId,
      ...result,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Finaliza e gera o relatório
   */
  async finish() {
    this.endTime = Date.now();
    const report = this.generateReport();
    await this.saveReport(report);
    return report;
  }

  /**
   * Gera o relatório com métricas
   */
  generateReport() {
    const totalUsers = this.results.length;
    const successfulUsers = this.results.filter(r => r.success).length;
    const failedUsers = totalUsers - successfulUsers;
    const successRate = totalUsers > 0 ? (successfulUsers / totalUsers * 100).toFixed(2) : 0;

    // Calcular tempo médio por etapa
    const avgTimes = this.calculateAverageTimes();

    // Agrupar erros
    const errors = this.groupErrors();

    // Calcular total de créditos gerados
    const totalCredits = this.results
      .filter(r => r.success && r.creditsEarned)
      .reduce((sum, r) => sum + (r.creditsEarned || 0), 0);

    const report = {
      summary: {
        totalUsers,
        successfulUsers,
        failedUsers,
        successRate: `${successRate}%`,
        totalCredits,
        executionTime: this.formatDuration(this.endTime - this.startTime),
        startTime: new Date(this.startTime).toISOString(),
        endTime: new Date(this.endTime).toISOString()
      },
      performance: {
        averageTimes: avgTimes,
        totalExecutionTimeMs: this.endTime - this.startTime
      },
      errors: errors,
      details: this.results.map(r => ({
        userId: r.userId,
        email: r.email,
        success: r.success,
        error: r.error,
        steps: r.steps,
        creditsEarned: r.creditsEarned,
        executionTime: r.executionTime
      }))
    };

    return report;
  }

  /**
   * Calcula tempo médio por etapa
   */
  calculateAverageTimes() {
    const steps = [
      'signup',
      'emailVerification',
      'quiz',
      'projectCreation',
      'projectRemix',
      'projectPublish'
    ];

    const avgTimes = {};

    for (const step of steps) {
      const times = this.results
        .filter(r => r.steps && r.steps[step])
        .map(r => r.steps[step]);

      if (times.length > 0) {
        const avg = times.reduce((sum, t) => sum + t, 0) / times.length;
        avgTimes[step] = this.formatDuration(avg);
      } else {
        avgTimes[step] = 'N/A';
      }
    }

    return avgTimes;
  }

  /**
   * Agrupa erros por tipo
   */
  groupErrors() {
    const errorGroups = {};

    for (const result of this.results) {
      if (result.error) {
        const errorType = result.error.type || 'Unknown';
        if (!errorGroups[errorType]) {
          errorGroups[errorType] = {
            count: 0,
            examples: []
          };
        }
        errorGroups[errorType].count++;
        if (errorGroups[errorType].examples.length < 3) {
          errorGroups[errorType].examples.push({
            userId: result.userId,
            message: result.error.message
          });
        }
      }
    }

    return errorGroups;
  }

  /**
   * Salva o relatório em arquivo
   */
  async saveReport(report) {
    try {
      const reportsDir = join(__dirname, '../../reports');
      await mkdir(reportsDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `report-${timestamp}.json`;
      const filepath = join(reportsDir, filename);

      await writeFile(filepath, JSON.stringify(report, null, 2));
      
      logger.success(`Relatório salvo em: ${filepath}`);

      // Também salvar versão resumida em texto
      const textReport = this.generateTextReport(report);
      const textFilepath = join(reportsDir, `report-${timestamp}.txt`);
      await writeFile(textFilepath, textReport);
      
      logger.success(`Relatório de texto salvo em: ${textFilepath}`);
    } catch (error) {
      logger.error('Erro ao salvar relatório', error);
    }
  }

  /**
   * Gera relatório em formato texto
   */
  generateTextReport(report) {
    const lines = [];
    lines.push('═══════════════════════════════════════════════════════');
    lines.push('           LOVABLE REFERRAL TEST REPORT');
    lines.push('═══════════════════════════════════════════════════════');
    lines.push('');
    lines.push('📊 RESUMO');
    lines.push('─────────────────────────────────────────────────────');
    lines.push(`Total de Usuários:       ${report.summary.totalUsers}`);
    lines.push(`✅ Sucessos:             ${report.summary.successfulUsers}`);
    lines.push(`❌ Falhas:               ${report.summary.failedUsers}`);
    lines.push(`📈 Taxa de Sucesso:      ${report.summary.successRate}`);
    lines.push(`💰 Total de Créditos:    ${report.summary.totalCredits}`);
    lines.push(`⏱️  Tempo de Execução:    ${report.summary.executionTime}`);
    lines.push('');
    lines.push('⚡ PERFORMANCE (Tempo Médio por Etapa)');
    lines.push('─────────────────────────────────────────────────────');
    for (const [step, time] of Object.entries(report.performance.averageTimes)) {
      lines.push(`${step.padEnd(25)} ${time}`);
    }
    lines.push('');
    
    if (Object.keys(report.errors).length > 0) {
      lines.push('🚨 ERROS ENCONTRADOS');
      lines.push('─────────────────────────────────────────────────────');
      for (const [errorType, data] of Object.entries(report.errors)) {
        lines.push(`${errorType}: ${data.count} ocorrências`);
        data.examples.forEach(ex => {
          lines.push(`  - User ${ex.userId}: ${ex.message}`);
        });
      }
      lines.push('');
    }

    lines.push('═══════════════════════════════════════════════════════');
    lines.push(`Relatório gerado em: ${report.summary.endTime}`);
    lines.push('═══════════════════════════════════════════════════════');

    return lines.join('\n');
  }

  /**
   * Formata duração em ms para formato legível
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Exibe relatório no console
   */
  displayReport(report) {
    console.log('\n');
    console.log(this.generateTextReport(report));
  }
}

export const reportService = new ReportService();

