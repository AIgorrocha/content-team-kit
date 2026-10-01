import React from "react";
import { useBrandFonts } from "./fonts";

// Texto de uma "pagina" de legenda (3 a 5 palavras), no estilo definido pela marca em
// clients/{slug}/design-system.md, secao "Legenda de reel" (lida por scripts/video/_brand.mjs).
//  - style "phrase": a pagina inteira aparece de uma vez, sem destaque.
//  - style "word": cada palavra aparece na hora em que e falada; a palavra falada agora
//    ganha a cor de destaque (se a marca definiu uma).
// Padrao sem configuracao: phrase, branco, maiusculas, negrito, Inter, sombra suave, sem contorno.
// O modelo de design-system.md ja vem no estilo CapCut (palavra a palavra, destaque, contorno).

export type CaptionWord = { word: string; startMs: number; endMs: number };

export type CaptionStyleProps = {
  captionStyle: "phrase" | "word";
  captionColor: string;
  highlightColor: string | null;
  uppercase: boolean;
  bold: boolean;
  // opcionais: ausente = padrao
  font?: string; // nome no Google Fonts (padrao Inter)
  letterSpacing?: number; // px (padrao -1)
  lineHeight?: number; // multiplicador (padrao 1.15)
  maxLines?: number | null; // null/ausente = sem limite
  outline?: { color: string; width: number } | null; // contorno, largura visivel em px
};

const FontGate: React.FC<{ font: string; children: React.ReactNode }> = ({ font, children }) => {
  useBrandFonts([font]);
  return <>{children}</>;
};

export const CaptionText: React.FC<
  CaptionStyleProps & {
    words: CaptionWord[];
    ms: number; // tempo atual do video em ms
    fontSize: number;
    shadow: string;
  }
> = ({
  words, ms, captionStyle, captionColor, highlightColor, uppercase, bold, fontSize, shadow,
  font = "Inter", letterSpacing = -1, lineHeight = 1.15, maxLines = null, outline = null,
}) => {
  const progressive = captionStyle === "word";
  let size = fontSize;
  if (maxLines) {
    // Estimativa (0.66em por letra, 86% de 1080px, margem de 10%), sem medir o texto.
    // Se falhar numa fonte muito larga, trocar por measureText de @remotion/layout-utils.
    const chars = words.reduce((n, w) => n + w.word.length, 0);
    const room = maxLines * 0.86 * 1080 * 0.9 - 16 * words.length;
    size = Math.max(24, Math.min(size, room / Math.max(chars * 0.66, 1)));
  }
  // palavra ativa = a ultima que ja comecou
  let active = -1;
  words.forEach((w, i) => {
    if (ms >= w.startMs) active = i;
  });
  const body = (
    <div
      style={{
        position: "relative",
        maxWidth: "86%",
        textAlign: "center",
        fontFamily: `${font}, sans-serif`,
        fontWeight: bold ? 800 : 500,
        fontSize: size,
        lineHeight,
        letterSpacing,
        textTransform: uppercase ? "uppercase" : "none",
        whiteSpace: maxLines === 1 ? "nowrap" : undefined,
      }}
    >
      {words.map((w, i) => {
        if (!w.word) return null;
        const hidden = progressive && ms < w.startMs;
        const isActive = progressive && highlightColor !== null && i === active;
        return (
          <span
            key={i}
            style={{
              color: isActive ? (highlightColor as string) : captionColor,
              opacity: hidden ? 0 : 1,
              textShadow: shadow,
              display: "inline-block",
              marginRight: 16,
              ...(outline
                ? { WebkitTextStroke: `${outline.width * 2}px ${outline.color}`, paintOrder: "stroke fill" }
                : {}),
            }}
          >
            {w.word}
          </span>
        );
      })}
    </div>
  );
  // Inter e a fonte padrao das composicoes (nao precisa carregar).
  return font === "Inter" ? body : <FontGate font={font}>{body}</FontGate>;
};
