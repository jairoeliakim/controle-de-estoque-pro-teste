/**
 * Utilitário de Criptografia e Hashing Seguro de Senhas (SHA-256 com Salt)
 * Garante que nenhuma senha seja gravada em texto puro no SGBD (PostgreSQL / MySQL / SQL Server)
 */

function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

export function sha256(ascii: string): string {
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i: number, j: number;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  // Initial hash value: first 32 bits of the fractional parts of the square roots of the first 8 primes 2..19
  let hash: number[] = [];
  // Round constants: first 32 bits of the fractional parts of the cube roots of the first 64 primes 2..311
  let k: number[] = [];

  let primeCounter = 0;
  const isComposite: Record<number, boolean> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  hash = hash.slice(0, 8);

  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  for (i = 0; i < ascii.length; i++) {
    const charCode = ascii.charCodeAt(i);
    words[i >> 2] |= charCode << (24 - ((i % 4) * 8));
  }

  const w: number[] = [];

  for (i = 0; i < words.length; i += 16) {
    const oldHash = hash.slice(0);

    for (j = 0; j < 64; j++) {
      if (j < 16) {
        w[j] = words[j + i] | 0;
      } else {
        const gamma0 =
          rightRotate(w[j - 15], 7) ^
          rightRotate(w[j - 15], 18) ^
          (w[j - 15] >>> 3);
        const gamma1 =
          rightRotate(w[j - 2], 17) ^
          rightRotate(w[j - 2], 19) ^
          (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + gamma0 + w[j - 7] + gamma1) | 0;
      }

      const s1 =
        rightRotate(hash[4], 6) ^
        rightRotate(hash[4], 11) ^
        rightRotate(hash[4], 25);
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const temp1 = (hash[7] + s1 + ch + k[j] + w[j]) | 0;
      const s0 =
        rightRotate(hash[0], 2) ^
        rightRotate(hash[0], 13) ^
        rightRotate(hash[0], 22);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = (s0 + maj) | 0;

      hash = [
        (temp1 + temp2) | 0,
        hash[0],
        hash[1],
        hash[2],
        (hash[3] + temp1) | 0,
        hash[4],
        hash[5],
        hash[6],
      ];
    }

    for (j = 0; j < 8; j++) {
      hash[j] = (hash[j] + oldHash[j]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }

  return result;
}

export const DEFAULT_SALT = 'ce_cmv_salt_2026';

/**
 * Gera hash criptográfico da senha no formato `sha256$<salt>$<hash>`
 */
export function hashPassword(plainText: string, salt: string = DEFAULT_SALT): string {
  if (!plainText) return '';
  const calculated = sha256(`${salt}:${plainText}`);
  return `sha256$${salt}$${calculated}`;
}

/**
 * Verifica se a senha informada confere com o hash ou valor protegido gravado
 */
export function verifyPassword(inputPassword: string, storedSecret?: string): boolean {
  if (!inputPassword || !storedSecret) return false;

  const trimmedInput = inputPassword.trim();
  const trimmedStored = storedSecret.trim();

  // 1. Formato moderno saltado: sha256$<salt>$<hash>
  if (trimmedStored.startsWith('sha256$')) {
    const parts = trimmedStored.split('$');
    if (parts.length >= 3) {
      const salt = parts[1];
      const targetHash = parts[2];
      const testHash = sha256(`${salt}:${trimmedInput}`);
      return testHash.toLowerCase() === targetHash.toLowerCase();
    }
  }

  // 2. Formato hex simples (64 caracteres)
  if (/^[a-f0-9]{64}$/i.test(trimmedStored)) {
    const withSalt = sha256(`${DEFAULT_SALT}:${trimmedInput}`);
    const withoutSalt = sha256(trimmedInput);
    return (
      trimmedStored.toLowerCase() === withSalt.toLowerCase() ||
      trimmedStored.toLowerCase() === withoutSalt.toLowerCase()
    );
  }

  // 3. Fallback para senha em texto plano legado (permitindo migração transparente)
  return trimmedInput === trimmedStored;
}

/**
 * Gera uma senha aleatória forte e amigável (maiúsculas, minúsculas, números e símbolos)
 */
export function generateRandomPassword(length: number = 10): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%&*';

  // Garante ao menos um caractere de cada categoria
  let chars = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];

  const all = upper + lower + numbers + symbols;
  for (let i = chars.length; i < length; i++) {
    chars.push(all[Math.floor(Math.random() * all.length)]);
  }

  // Embaralha
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}
