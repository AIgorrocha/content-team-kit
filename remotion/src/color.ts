// Helpers de cor e de caminho compartilhados pelas composicoes.

// "#RRGGBB" ou "#RGB" -> "rgba(r,g,b,a)". Entrada invalida vira preto.
export const withAlpha = (hex: string, alpha: number): string => {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  if (Number.isNaN(n) || h.length !== 6) return `rgba(0,0,0,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
};

// URL absoluta (http, //, /) em vez de arquivo de remotion/public/.
export const isUrl = (s: string): boolean => /^(https?:)?\/\//.test(s) || s.startsWith("/");
