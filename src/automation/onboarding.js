import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';

/**
 * Completa o quiz de onboarding
 * Respostas: next, next, other, solo
 */
export async function completeQuiz(page) {
  const startTime = Date.now();
  
  try {
    logger.step(3, 'Completando quiz de onboarding');

    // Aguardar carregamento do quiz
    await page.waitForTimeout(config.delayBetweenActions);

    // Questão 1: Clicar em "Next" ou similar
    await answerQuestion(page, 1, ['next', 'continue', 'próximo', 'continuar']);
    await page.waitForTimeout(1000);

    // Questão 2: Clicar em "Next" ou similar
    await answerQuestion(page, 2, ['next', 'continue', 'próximo', 'continuar']);
    await page.waitForTimeout(1000);

    // Questão 3: Clicar em "Other" ou similar
    await answerQuestion(page, 3, ['other', 'outro', 'outros']);
    await page.waitForTimeout(1000);

    // Questão 4: Clicar em "Solo" ou similar
    await answerQuestion(page, 4, ['solo', 'alone', 'individual', 'sozinho']);
    await page.waitForTimeout(1000);

    // Procurar botão final de conclusão
    const finishSelectors = [
      'button:has-text("Finish")',
      'button:has-text("Complete")',
      'button:has-text("Done")',
      'button:has-text("Start")',
      'button:has-text("Finalizar")',
      'button:has-text("Concluir")',
      'button:has-text("Começar")'
    ];

    for (const selector of finishSelectors) {
      try {
        const button = await page.$(selector);
        if (button && await button.isVisible()) {
          await button.click();
          logger.info('Botão de finalização clicado');
          break;
        }
      } catch (e) {
        continue;
      }
    }

    // Aguardar navegação ou carregamento
    await page.waitForTimeout(config.delayBetweenActions);

    const executionTime = Date.now() - startTime;
    logger.success(`Quiz completado em ${executionTime}ms`);

    return {
      success: true,
      executionTime
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logger.error('Erro ao completar quiz', error);

    return {
      success: false,
      error: error.message,
      executionTime
    };
  }
}

/**
 * Responde uma questão do quiz
 */
async function answerQuestion(page, questionNumber, keywords) {
  logger.info(`Respondendo questão ${questionNumber}`);

  // Tentar encontrar botão ou opção com as palavras-chave
  for (const keyword of keywords) {
    const selectors = [
      `button:has-text("${keyword}")`,
      `[role="button"]:has-text("${keyword}")`,
      `div:has-text("${keyword}")[role="option"]`,
      `label:has-text("${keyword}")`,
      `input[value="${keyword}"]`
    ];

    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (element && await element.isVisible()) {
          await element.click();
          logger.info(`Questão ${questionNumber} respondida: ${keyword}`);
          return true;
        }
      } catch (e) {
        continue;
      }
    }
  }

  // Se não encontrou, tentar clicar em qualquer botão "Next"
  try {
    const nextButton = await page.$('button:has-text("Next")');
    if (nextButton && await nextButton.isVisible()) {
      await nextButton.click();
      logger.warning(`Questão ${questionNumber}: clicou em Next genérico`);
      return true;
    }
  } catch (e) {
    // Ignorar
  }

  logger.warning(`Questão ${questionNumber}: não encontrou opção específica`);
  return false;
}

