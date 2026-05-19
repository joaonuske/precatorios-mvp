export function cleanCpf(input: string): string {
  return input.replace(/\D+/g, "");
}

export function formatCpf(cpf: string): string {
  const d = cleanCpf(cpf);
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function isValidCpf(input: string): boolean {
  const d = cleanCpf(input);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false; // repetidos: 000... 111...

  const calc = (slice: string, factor: number) => {
    let sum = 0;
    for (let i = 0; i < slice.length; i++) {
      sum += parseInt(slice[i], 10) * (factor - i);
    }
    const rem = (sum * 10) % 11;
    return rem === 10 ? 0 : rem;
  };

  const d1 = calc(d.slice(0, 9), 10);
  if (d1 !== parseInt(d[9], 10)) return false;
  const d2 = calc(d.slice(0, 10), 11);
  if (d2 !== parseInt(d[10], 10)) return false;
  return true;
}
