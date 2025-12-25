#!/usr/bin/env node

/**
 * Script para validar a configuração do projeto
 */

import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log(chalk.cyan('\n🔍 Validando configuração do projeto...\n'));

let hasErrors = false;

// 1. Verificar se .env existe
console.log(chalk.blue('1. Verificando arquivo .env...'));
if (existsSync(join(projectRoot, '.env'))) {
  console.log(chalk.green('   ✅ Arquivo .env encontrado'));
} else {
  console.log(chalk.red('   ❌ Arquivo .env não encontrado'));
  console.log(chalk.yellow('   💡 Execute: cp .env.example .env'));
  hasErrors = true;
}

// 2. Verificar se node_modules existe
console.log(chalk.blue('\n2. Verificando dependências...'));
if (existsSync(join(projectRoot, 'node_modules'))) {
  console.log(chalk.green('   ✅ Dependências instaladas'));
} else {
  console.log(chalk.red('   ❌ Dependências não instaladas'));
  console.log(chalk.yellow('   💡 Execute: npm install'));
  hasErrors = true;
}

// 3. Verificar estrutura de diretórios
console.log(chalk.blue('\n3. Verificando estrutura de diretórios...'));
const requiredDirs = [
  'src',
  'src/services',
  'src/automation',
  'src/utils',
  'reports'
];

for (const dir of requiredDirs) {
  if (existsSync(join(projectRoot, dir))) {
    console.log(chalk.green(`   ✅ ${dir}/`));
  } else {
    console.log(chalk.red(`   ❌ ${dir}/ não encontrado`));
    hasErrors = true;
  }
}

// 4. Verificar arquivos principais
console.log(chalk.blue('\n4. Verificando arquivos principais...'));
const requiredFiles = [
  'src/index.js',
  'src/services/emailService.js',
  'src/services/proxyService.js',
  'src/services/reportService.js',
  'src/automation/userFlow.js',
  'src/automation/signup.js',
  'src/automation/onboarding.js',
  'src/automation/project.js',
  'src/utils/config.js',
  'src/utils/logger.js',
  'package.json',
  'README.md'
];

for (const file of requiredFiles) {
  if (existsSync(join(projectRoot, file))) {
    console.log(chalk.green(`   ✅ ${file}`));
  } else {
    console.log(chalk.red(`   ❌ ${file} não encontrado`));
    hasErrors = true;
  }
}

// 5. Verificar variáveis de ambiente
console.log(chalk.blue('\n5. Verificando variáveis de ambiente...'));
try {
  const dotenv = await import('dotenv');
  dotenv.config({ path: join(projectRoot, '.env') });
  
  const requiredVars = [
    'REFERRAL_LINK',
    'RAPIDAPI_KEY'
  ];
  
  for (const varName of requiredVars) {
    if (process.env[varName] && process.env[varName] !== 'SEU_CODIGO_AQUI') {
      console.log(chalk.green(`   ✅ ${varName} configurado`));
    } else {
      console.log(chalk.red(`   ❌ ${varName} não configurado`));
      console.log(chalk.yellow(`   💡 Edite o arquivo .env e configure ${varName}`));
      hasErrors = true;
    }
  }
} catch (error) {
  console.log(chalk.yellow('   ⚠️  Não foi possível verificar variáveis de ambiente'));
}

// Resultado final
console.log(chalk.cyan('\n' + '='.repeat(60)));
if (hasErrors) {
  console.log(chalk.red.bold('\n❌ Configuração incompleta!'));
  console.log(chalk.yellow('\nPor favor, corrija os erros acima antes de continuar.'));
  console.log(chalk.yellow('Consulte o arquivo SETUP.md para mais informações.\n'));
  process.exit(1);
} else {
  console.log(chalk.green.bold('\n✅ Configuração válida!'));
  console.log(chalk.green('\nVocê está pronto para executar os testes:'));
  console.log(chalk.gray('  npm run test:small    # 10 usuários'));
  console.log(chalk.gray('  npm run test:medium   # 100 usuários'));
  console.log(chalk.gray('  npm run test:large    # 1000 usuários\n'));
  process.exit(0);
}

