/**
 * Gerador de nomes aleatórios para emails
 */

// Lista de nomes comuns brasileiros
const firstNames = [
  'joao', 'maria', 'jose', 'ana', 'antonio', 'francisco', 'carlos', 'paulo',
  'lucas', 'pedro', 'marcos', 'andre', 'rafael', 'fernando', 'gabriel',
  'bruno', 'rodrigo', 'diego', 'gustavo', 'felipe', 'leandro', 'ricardo',
  'juliana', 'mariana', 'fernanda', 'patricia', 'aline', 'camila', 'amanda',
  'jessica', 'leticia', 'carolina', 'bianca', 'bruna', 'vanessa', 'priscila',
  'adriana', 'renata', 'monica', 'claudia', 'sandra', 'beatriz', 'larissa'
];

const lastNames = [
  'silva', 'santos', 'oliveira', 'souza', 'rodrigues', 'ferreira', 'alves',
  'pereira', 'lima', 'gomes', 'costa', 'ribeiro', 'martins', 'carvalho',
  'rocha', 'almeida', 'nascimento', 'araujo', 'soares', 'fernandes', 'vieira',
  'barbosa', 'cardoso', 'machado', 'freitas', 'cavalcanti', 'azevedo', 'campos'
];

/**
 * Gera um nome aleatório com números
 * Formatos possíveis:
 * - nome.sobrenome123
 * - nomesobrenome456
 * - nome123sobrenome
 * - n.sobrenome789
 * - nome_sobrenome012
 */
export function generateRandomUsername() {
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const numbers = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  
  // Escolher formato aleatório
  const formats = [
    `${firstName}.${lastName}${numbers}`,                    // joao.silva1234
    `${firstName}${lastName}${numbers}`,                     // joaosilva5678
    `${firstName}${numbers}${lastName}`,                     // joao1234silva
    `${firstName[0]}.${lastName}${numbers}`,                 // j.silva9012
    `${firstName}_${lastName}${numbers}`,                    // joao_silva3456
    `${firstName}.${lastName.substring(0, 4)}${numbers}`,    // joao.silv7890
    `${firstName}${numbers}`,                                // joao2345
    `${lastName}${numbers}`,                                 // silva6789
    `${firstName[0]}${lastName}${numbers}`,                  // jsilva4567
    `${firstName}.${lastName[0]}${numbers}`                  // joao.s8901
  ];
  
  return formats[Math.floor(Math.random() * formats.length)];
}

/**
 * Gera um username único com timestamp para garantir unicidade
 */
export function generateUniqueUsername(userId) {
  const baseName = generateRandomUsername();
  const timestamp = Date.now().toString().slice(-6); // últimos 6 dígitos
  
  // Misturar para parecer mais natural
  const mixFormats = [
    `${baseName}`,           // nome123
    `${baseName}${timestamp}`,   // nome123456789
    `${baseName}_${timestamp}`,  // nome123_456789
  ];
  
  return mixFormats[Math.floor(Math.random() * mixFormats.length)];
}

/**
 * Gera um email completo com domínio
 */
export function generateRandomEmail(userId, domains) {
  const username = generateUniqueUsername(userId);
  const domain = domains[Math.floor(Math.random() * domains.length)];
  
  return {
    username,
    domain,
    email: `${username}@${domain}`
  };
}

/**
 * Gera uma senha aleatória que atende aos requisitos:
 * - Pelo menos 8 caracteres
 * - Pelo menos um número (0-9)
 * - Pelo menos uma letra maiúscula
 * - Pelo menos uma letra minúscula
 */
export function generateRandomPassword() {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const special = '!@#$%&*';
  
  // Garantir pelo menos um de cada tipo
  let password = '';
  password += lowercase[Math.floor(Math.random() * lowercase.length)]; // 1 minúscula
  password += uppercase[Math.floor(Math.random() * uppercase.length)]; // 1 maiúscula
  password += numbers[Math.floor(Math.random() * numbers.length)];     // 1 número
  password += special[Math.floor(Math.random() * special.length)];     // 1 especial
  
  // Completar até 12 caracteres com caracteres aleatórios
  const allChars = lowercase + uppercase + numbers + special;
  for (let i = password.length; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Embaralhar a senha para não ter padrão previsível
  password = password.split('').sort(() => Math.random() - 0.5).join('');
  
  return password;
}

