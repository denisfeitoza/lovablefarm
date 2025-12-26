/**
 * Utilitário para normalizar links de indicação
 * Converte qualquer formato para: https://lovable.dev/signup?referral_code=XXXXX
 */

/**
 * Normaliza link de indicação para o formato padrão
 * @param {string} link - Link de indicação (qualquer formato)
 * @returns {string} - Link normalizado no formato /signup?referral_code=
 */
export function normalizeReferralLink(link) {
  if (!link) {
    throw new Error('Link de indicação é obrigatório');
  }

  const trimmedLink = link.trim();

  // Se já está no formato correto, retornar como está
  if (trimmedLink.includes('/signup?referral_code=')) {
    return trimmedLink;
  }

  // Extrair código de indicação de diferentes formatos
  let referralCode = null;

  // Formato: https://lovable.dev/invite/XXXXX
  const inviteMatch = trimmedLink.match(/\/invite\/([A-Z0-9]+)/i);
  if (inviteMatch) {
    referralCode = inviteMatch[1];
  }

  // Formato: https://lovable.dev/invite?code=XXXXX
  const inviteCodeMatch = trimmedLink.match(/[?&]code=([A-Z0-9]+)/i);
  if (inviteCodeMatch) {
    referralCode = inviteCodeMatch[1];
  }

  // Formato: https://lovable.dev/signup?referral=XXXXX
  const signupReferralMatch = trimmedLink.match(/[?&]referral=([A-Z0-9]+)/i);
  if (signupReferralMatch) {
    referralCode = signupReferralMatch[1];
  }

  // Se não encontrou código, tentar pegar o último segmento da URL
  if (!referralCode) {
    const urlMatch = trimmedLink.match(/([A-Z0-9]{6,})/i);
    if (urlMatch) {
      referralCode = urlMatch[1];
    }
  }

  if (!referralCode) {
    throw new Error('Não foi possível extrair o código de indicação do link');
  }

  // Retornar no formato padrão
  return `https://lovable.dev/signup?referral_code=${referralCode}`;
}

