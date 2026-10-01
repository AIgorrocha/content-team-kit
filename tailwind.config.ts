import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: "class",
  content: [
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // rgb(var(--x) / <alpha-value>) em vez de hex fixo: permite opacidade
        // (bg-accent/10 etc, usadas em todo o dashboard) e permite a Sala de Comando
        // trocar a paleta por cliente sobrescrevendo as variáveis --ct-* em :root
        // (ver src/components/sala/SalaTema.tsx). Fallback de cada variável em
        // src/app/globals.css :root é o mesmo hex de antes, então fora da Sala (ou
        // sem tema de cliente) o dashboard fica idêntico ao de hoje.
        background: "rgb(var(--ct-bg) / <alpha-value>)",
        surface: "rgb(var(--ct-surface) / <alpha-value>)",
        "surface-hover": "rgb(var(--ct-surface-hover) / <alpha-value>)",
        border: "rgb(var(--ct-border) / <alpha-value>)",
        "text-primary": "rgb(var(--ct-text-primary) / <alpha-value>)",
        "text-secondary": "rgb(var(--ct-text-secondary) / <alpha-value>)",
        accent: "rgb(var(--ct-accent) / <alpha-value>)",
        "accent-hover": "rgb(var(--ct-accent-hover) / <alpha-value>)",
        accent2: "#7C3AED",
        success: "rgb(var(--ct-success) / <alpha-value>)",
        error: "rgb(var(--ct-error) / <alpha-value>)",
        warning: "rgb(var(--ct-warning) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--ct-font-sans)", "Inter", "system-ui", "sans-serif"],
        secondary: ["Space Grotesk", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.25rem",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
