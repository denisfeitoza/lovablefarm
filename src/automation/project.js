import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';

/**
 * Abre um projeto template
 */
export async function openTemplateProject(page) {
  const startTime = Date.now();
  
  try {
    logger.step(4, 'Abrindo projeto template');

    // Aguardar carregamento da página
    await page.waitForTimeout(config.delayBetweenActions);

    // Procurar por templates ou projetos disponíveis
    const templateSelectors = [
      '[data-testid="template"]',
      '.template-card',
      'button:has-text("Use template")',
      'button:has-text("Start from template")',
      'button:has-text("Usar template")',
      '[role="button"]:has-text("template")'
    ];

    let templateFound = false;
    for (const selector of templateSelectors) {
      try {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          // Clicar no primeiro template
          await elements[0].click();
          logger.info('Template selecionado');
          templateFound = true;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!templateFound) {
      // Tentar procurar link para templates
      const templateLinks = [
        'a:has-text("Templates")',
        'a:has-text("Browse templates")',
        'a:has-text("Modelos")',
        '[href*="template"]'
      ];

      for (const selector of templateLinks) {
        try {
          const link = await page.$(selector);
          if (link && await link.isVisible()) {
            await link.click();
            logger.info('Navegando para templates');
            await page.waitForTimeout(2000);
            
            // Tentar selecionar template novamente
            const templates = await page.$$('[data-testid="template"], .template-card');
            if (templates.length > 0) {
              await templates[0].click();
              templateFound = true;
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }
    }

    if (!templateFound) {
      throw new Error('Nenhum template encontrado');
    }

    await page.waitForTimeout(config.delayBetweenActions);

    const executionTime = Date.now() - startTime;
    logger.success(`Projeto template aberto em ${executionTime}ms`);

    return {
      success: true,
      executionTime
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logger.error('Erro ao abrir projeto template', error);

    try {
    } catch (e) {
      // Ignorar erro de screenshot
    }

    return {
      success: false,
      error: error.message,
      executionTime
    };
  }
}

/**
 * Remixa o projeto (cria uma cópia editável)
 */
export async function remixProject(page) {
  const startTime = Date.now();
  
  try {
    logger.step(5, 'Remixando projeto');

    // Aguardar carregamento
    await page.waitForTimeout(config.delayBetweenActions);

    // Procurar botão de remix
    const remixSelectors = [
      'button:has-text("Remix")',
      'button:has-text("Fork")',
      'button:has-text("Duplicate")',
      'button:has-text("Copy")',
      'button:has-text("Remixar")',
      'button:has-text("Duplicar")',
      '[data-testid="remix-button"]'
    ];

    let remixed = false;
    for (const selector of remixSelectors) {
      try {
        const button = await page.$(selector);
        if (button && await button.isVisible()) {
          await button.click();
          logger.info('Botão de remix clicado');
          remixed = true;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!remixed) {
      // Pode ser que o projeto já esteja em modo de edição
      logger.warning('Botão de remix não encontrado - projeto pode já estar editável');
    }

    // Aguardar carregamento do editor
    await page.waitForTimeout(config.delayBetweenActions * 2);

    // Verificar se está no editor (procurar elementos típicos)
    const editorSelectors = [
      '[data-testid="editor"]',
      '.editor',
      '[role="textbox"]',
      '.monaco-editor'
    ];

    let inEditor = false;
    for (const selector of editorSelectors) {
      try {
        const editor = await page.$(selector);
        if (editor) {
          inEditor = true;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!inEditor) {
      logger.warning('Editor não detectado - continuando mesmo assim');
    }

    const executionTime = Date.now() - startTime;
    logger.success(`Projeto remixado em ${executionTime}ms`);

    return {
      success: true,
      executionTime
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logger.error('Erro ao remixar projeto', error);

    return {
      success: false,
      error: error.message,
      executionTime
    };
  }
}

/**
 * Publica o projeto
 */
export async function publishProject(page) {
  const startTime = Date.now();
  
  try {
    logger.step(6, 'Publicando projeto');

    // Aguardar carregamento
    await page.waitForTimeout(config.delayBetweenActions);

    // Procurar botão de publicação
    const publishSelectors = [
      'button:has-text("Publish")',
      'button:has-text("Deploy")',
      'button:has-text("Share")',
      'button:has-text("Publicar")',
      'button:has-text("Compartilhar")',
      '[data-testid="publish-button"]',
      '[aria-label*="publish" i]'
    ];

    let published = false;
    for (const selector of publishSelectors) {
      try {
        const button = await page.$(selector);
        if (button && await button.isVisible()) {
          await button.click();
          logger.info('Botão de publicação clicado');
          published = true;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!published) {
      throw new Error('Botão de publicação não encontrado');
    }

    // Aguardar modal ou confirmação
    await page.waitForTimeout(2000);

    // Procurar botão de confirmação no modal
    const confirmSelectors = [
      'button:has-text("Confirm")',
      'button:has-text("Yes")',
      'button:has-text("Publish")',
      'button:has-text("Deploy")',
      'button:has-text("Confirmar")',
      'button:has-text("Sim")'
    ];

    for (const selector of confirmSelectors) {
      try {
        const button = await page.$(selector);
        if (button && await button.isVisible()) {
          await button.click();
          logger.info('Publicação confirmada');
          break;
        }
      } catch (e) {
        continue;
      }
    }

    // Aguardar conclusão da publicação
    await page.waitForTimeout(config.delayBetweenActions * 2);

    // Procurar por mensagem de sucesso
    const successSelectors = [
      'text=published',
      'text=deployed',
      'text=success',
      'text=publicado',
      'text=sucesso'
    ];

    let success = false;
    for (const selector of successSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        success = true;
        break;
      } catch (e) {
        continue;
      }
    }

    const executionTime = Date.now() - startTime;
    logger.success(`Projeto publicado em ${executionTime}ms`);

    return {
      success: true,
      executionTime
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logger.error('Erro ao publicar projeto', error);

    return {
      success: false,
      error: error.message,
      executionTime
    };
  }
}

