export const VALID_CNPJS = [
  '07348198000148', // DMCAMP DISTRIBUIDORA DE REVISTAS LTDA
  '54511074000111', // EBANCAS EXPERIENCE STORE LTDA (MATRIZ)
  '54511074000200', // EBANCAS EXPERIENCE STORE LTDA (FILIAL)
] as const;

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

export function isLikelyValidCnpj(extracted: string | null | undefined): boolean {
  if (extracted == null) return false;
  const trimmed = extracted.trim();
  if (trimmed.length === 0) return false;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length !== 14) return false;
  return VALID_CNPJS.some(valid => levenshtein(digits, valid) <= 2);
}
