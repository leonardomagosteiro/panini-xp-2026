import { isLikelyValidCnpj } from './cnpj-match';

let failed = false;

function check(description: string, actual: boolean, expected: boolean): void {
  if (actual !== expected) {
    console.error(`FAIL: ${description} — expected ${expected}, got ${actual}`);
    failed = true;
  }
}

// Exact match
check('Exact DMCAMP CNPJ', isLikelyValidCnpj('07348198000148'), true);

// Distance 1
check('Distance 1 (one digit off)', isLikelyValidCnpj('07348196000148'), true);

// Distance 2 — real production case
check('Distance 2 (real production case)', isLikelyValidCnpj('07341898000148'), true);
check('Distance 2 (transposition at positions 11-12)', isLikelyValidCnpj('07348198001048'), true);

// Distance 3
check('Distance 3 (should be false)', isLikelyValidCnpj('07394088001486'), false);

// Completely different CNPJ
check('Completely different CNPJ', isLikelyValidCnpj('33041230000162'), false);

// Formatted with punctuation
check('Formatted 07.348.198/0001-48', isLikelyValidCnpj('07.348.198/0001-48'), true);

// With spaces
check('With spaces 07 348 198 0001 48', isLikelyValidCnpj('07 348 198 0001 48'), true);

// Null
check('null returns false', isLikelyValidCnpj(null), false);

// Undefined
check('undefined returns false', isLikelyValidCnpj(undefined), false);

// Empty string
check('Empty string returns false', isLikelyValidCnpj(''), false);

// Whitespace only
check('Whitespace only returns false', isLikelyValidCnpj('   '), false);

// Too short (13 digits)
check('Too short (13 digits)', isLikelyValidCnpj('0734819800014'), false);

// Too long (15 digits)
check('Too long (15 digits)', isLikelyValidCnpj('073481980001480'), false);

// 14 chars with letters — only 11 digits after stripping
check('14 chars with letters (11 digits after strip)', isLikelyValidCnpj('07348198abc148'), false);

// EBANCAS matriz tests
check('Exact EBANCAS matriz', isLikelyValidCnpj('54511074000111'), true);
check('EBANCAS matriz distance 1', isLikelyValidCnpj('54511074000112'), true);
check('EBANCAS matriz distance 2', isLikelyValidCnpj('54511074000122'), true);
check('EBANCAS matriz formatted', isLikelyValidCnpj('54.511.074/0001-11'), true);

// EBANCAS filial tests
check('Exact EBANCAS filial', isLikelyValidCnpj('54511074000200'), true);
check('EBANCAS filial distance 1', isLikelyValidCnpj('54511074000201'), true);
check('EBANCAS filial distance 2', isLikelyValidCnpj('54511074000211'), true);

// Negative case between matriz and filial (they are distance 3 apart, so a midpoint should fail for both — but actually they're close enough that no CNPJ is distance 3+ from BOTH; instead test a clearly different CNPJ)
check('Completely different CNPJ (none match)', isLikelyValidCnpj('12345678000199'), false);

if (failed) {
  process.exit(1);
}

console.log('All CNPJ match tests passed.');
