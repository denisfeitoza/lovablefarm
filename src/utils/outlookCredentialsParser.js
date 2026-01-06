/**
 * Parser flexível para diferentes formatos de entrada de credenciais Outlook
 * 
 * Suporta formatos:
 * - Email: email@hotmail.com
 *   Senha: senha123
 * 
 * - Email: email@hotmail.com Senha: senha123
 * 
 * - email@hotmail.com,senha123
 * 
 * - email@hotmail.com|senha123
 * 
 * - email@hotmail.com senha123
 * 
 * - email@hotmail.com
 * senha123
 */

/**
 * Extrai email de uma string
 */
function extractEmail(text) {
  // Regex para encontrar emails
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex);
  return matches ? matches[0] : null;
}

/**
 * Extrai senha de uma string (tudo que não é email)
 */
function extractPassword(text, email) {
  if (!email) return null;
  
  // Remover o email da string
  let password = text.replace(email, '').trim();
  
  // Remover prefixos comuns (com espaço após os dois pontos)
  password = password.replace(/^(Email:\s*|email:\s*|E-mail:\s*|e-mail:\s*)/i, '').trim();
  password = password.replace(/^(Senha:\s*|senha:\s*|Password:\s*|password:\s*)/i, '').trim();
  password = password.replace(/^[:\-|,]/g, '').trim();
  
  return password || null;
}

/**
 * Parse de uma linha no formato "Email: ... Senha: ..."
 */
function parseFormattedLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  
  // Tentar encontrar padrão "Email: ... Senha: ..." na mesma linha
  const emailMatch = trimmed.match(/Email:\s*([^\s]+@[^\s]+)/i);
  const passwordMatch = trimmed.match(/Senha:\s*([^\s]+)/i) || trimmed.match(/Password:\s*([^\s]+)/i);
  
  if (emailMatch && passwordMatch) {
    return {
      email: emailMatch[1].trim(),
      password: passwordMatch[1].trim()
    };
  }
  
  // Tentar encontrar apenas email com prefixo "Email:"
  if (emailMatch) {
    const email = emailMatch[1].trim();
    // Se a linha contém "Senha:" mas não encontrou match, tentar extrair depois do email
    const afterEmail = trimmed.substring(trimmed.indexOf(email) + email.length).trim();
    const passwordFromAfter = afterEmail.match(/Senha:\s*(.+)/i) || afterEmail.match(/Password:\s*(.+)/i);
    if (passwordFromAfter) {
      return {
        email,
        password: passwordFromAfter[1].trim()
      };
    }
  }
  
  // Tentar encontrar email e senha separados por espaço
  const email = extractEmail(trimmed);
  if (email) {
    const password = extractPassword(trimmed, email);
    if (password) {
      return { email, password };
    }
  }
  
  return null;
}

/**
 * Parse de linha CSV (email,senha ou email|senha)
 */
function parseCSVLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  
  // Tentar separar por vírgula
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      const email = extractEmail(parts[0]) || parts[0];
      const password = parts[1];
      if (email && password) {
        return { email, password };
      }
    }
  }
  
  // Tentar separar por pipe
  if (trimmed.includes('|')) {
    const parts = trimmed.split('|').map(p => p.trim());
    if (parts.length >= 2) {
      const email = extractEmail(parts[0]) || parts[0];
      const password = parts[1];
      if (email && password) {
        return { email, password };
      }
    }
  }
  
  return null;
}

/**
 * Parse de múltiplas linhas (email na primeira, senha na segunda)
 */
function parseMultiLine(lines, index) {
  if (index >= lines.length - 1) return null;
  
  const line1 = lines[index].trim();
  const line2 = lines[index + 1].trim();
  
  // Verificar se a primeira linha tem padrão "Email: ..."
  const emailMatch = line1.match(/Email:\s*([^\s]+@[^\s]+)/i);
  const email = emailMatch ? emailMatch[1].trim() : extractEmail(line1);
  
  if (!email) return null;
  
  // Verificar se a segunda linha tem padrão "Senha: ..."
  const passwordMatch = line2.match(/Senha:\s*(.+)/i) || line2.match(/Password:\s*(.+)/i);
  let password = passwordMatch ? passwordMatch[1].trim() : (line2 && !line2.includes('@') ? line2 : null);
  
  // Limpar qualquer prefixo restante
  if (password) {
    password = password.replace(/^(Senha:\s*|senha:\s*|Password:\s*|password:\s*)/i, '').trim();
    return { email, password };
  }
  
  return null;
}

/**
 * Parse principal - tenta todos os formatos
 */
export function parseCredentialsInput(input) {
  const credentials = [];
  const lines = input.split('\n').map(l => l.trim()).filter(l => l);
  
  if (lines.length === 0) {
    return { success: false, error: 'Nenhuma linha encontrada', credentials: [] };
  }
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    
    // Tentar formato CSV primeiro
    const csvResult = parseCSVLine(line);
    if (csvResult) {
      credentials.push(csvResult);
      i++;
      continue;
    }
    
    // Tentar formato "Email: ... Senha: ..."
    const formattedResult = parseFormattedLine(line);
    if (formattedResult) {
      credentials.push(formattedResult);
      i++;
      continue;
    }
    
    // Tentar formato multi-linha (email na linha atual, senha na próxima)
    const multiLineResult = parseMultiLine(lines, i);
    if (multiLineResult) {
      credentials.push(multiLineResult);
      i += 2; // Pular duas linhas
      continue;
    }
    
    // Se não conseguiu parsear, pular linha
    i++;
  }
  
  // Validar e limpar credenciais parseadas
  const validCredentials = credentials
    .map(c => {
      // Limpar senha de qualquer prefixo restante
      let cleanPassword = c.password.trim();
      cleanPassword = cleanPassword.replace(/^(Senha:\s*|senha:\s*|Password:\s*|password:\s*)/i, '').trim();
      
      return {
        email: c.email.trim(),
        password: cleanPassword
      };
    })
    .filter(c => {
      const emailValid = c.email && c.email.includes('@') && c.email.includes('.');
      const passwordValid = c.password && c.password.length > 0;
      return emailValid && passwordValid;
    });
  
  if (validCredentials.length === 0) {
    return {
      success: false,
      error: 'Nenhuma credencial válida encontrada. Verifique o formato.',
      credentials: []
    };
  }
  
  return {
    success: true,
    credentials: validCredentials,
    parsed: validCredentials.length,
    skipped: credentials.length - validCredentials.length
  };
}

/**
 * Valida uma credencial individual
 */
export function validateCredential(email, password) {
  if (!email || !email.includes('@')) {
    return { valid: false, error: 'Email inválido' };
  }
  
  if (!password || password.length === 0) {
    return { valid: false, error: 'Senha não pode estar vazia' };
  }
  
  return { valid: true };
}

