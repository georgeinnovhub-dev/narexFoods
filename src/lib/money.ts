/** GH₵ money helpers — prices are integer pesewas everywhere (GH₵1 = 100p). */
export function formatGHS(pesewas: number): string {
  const cedis = Math.floor(Math.abs(pesewas) / 100);
  const p = Math.abs(pesewas) % 100;
  const sign = pesewas < 0 ? "-" : "";
  return `${sign}GH₵${cedis.toLocaleString("en-GH")}${p ? `.${p.toString().padStart(2, "0")}` : ""}`;
}

export function formatGHSDecimal(pesewas: number): string {
  return `${(pesewas / 100).toFixed(2)}`;
}

export function cedisToPesewas(cedis: number): number {
  return Math.round(cedis * 100);
}
