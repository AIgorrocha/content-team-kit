// Temas white-label do Content Team AI (kit).
// Um tema por cliente, montado a partir de clients/{slug}/design-system.md:
//   node scripts/video/emit-theme.mjs {slug}
// grava o tema em themes.generated.json (este arquivo le). O run-editor.mjs ja faz isso
// sozinho. Para ajustar foto, @handle ou selo de verificado, edite o JSON gerado.
// "exemplo" abaixo e so o tema neutro de reserva.
import generated from "./themes.generated.json";

export type Theme = {
  slug: string;
  bg: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textMeta: string;
  accent: string;
  fontDisplay: string;
  fontBody: string;
  // Header (igual ao carrossel)
  name: string; // nome exibido no header (vazio = sem nome)
  handle: string;
  photo: string | null; // arquivo em public/ (staticFile) ou null
  check: boolean; // selo de verificado azul
};

export const THEMES: Record<string, Theme> = {
  ...(generated as Record<string, Theme>),
  exemplo: {
    slug: "exemplo",
    bg: "#FFFFFF",
    surface: "#F4F6F8",
    textPrimary: "#1A1A1A",
    textSecondary: "#444444",
    textMuted: "#666666",
    textMeta: "#888888",
    accent: "#0066FF",
    fontDisplay: "Inter",
    fontBody: "Inter",
    name: "Nome da Marca",
    handle: "@marca",
    photo: null,
    check: false,
  },
};

export const getTheme = (slug: string): Theme => {
  const theme = THEMES[slug];
  if (theme) return theme;
  console.warn(
    `[themes] tema "${slug}" nao existe: usando o neutro "exemplo". ` +
      `Crie com: node scripts/video/emit-theme.mjs ${slug}`
  );
  return THEMES.exemplo;
};
