import React from "react";

// Texto de uma "pagina" de legenda (3 a 5 palavras), no estilo definido pela marca em
// clients/{slug}/design-system.md, secao "Legenda de reel" (lida por scripts/video/_brand.mjs).
//  - style "phrase": a pagina inteira aparece de uma vez, sem destaque.
//  - style "word": cada palavra aparece na hora em que e falada; a palavra falada agora
//    ganha a cor de destaque (se a marca definiu uma).
// Padrao do kit (marca sem secao preenchida): phrase, branco, maiusculas, negrito, sombra suave.

export type CaptionWord = { word: string; startMs: number; endMs: number };

export type CaptionStyleProps = {
  captionStyle: "phrase" | "word";
  captionColor: string;
  highlightColor: string | null;
  uppercase: boolean;
  bold: boolean;
};

export const CaptionText: React.FC<
  CaptionStyleProps & {
    words: CaptionWord[];
    ms: number; // tempo atual do video em ms
    fontSize: number;
    shadow: string;
  }
> = ({ words, ms, captionStyle, captionColor, highlightColor, uppercase, bold, fontSize, shadow }) => {
  const progressive = captionStyle === "word";
  // palavra ativa = a ultima que ja comecou
  let active = -1;
  words.forEach((w, i) => {
    if (ms >= w.startMs) active = i;
  });
  return (
    <div
      style={{
        position: "relative",
        maxWidth: "86%",
        textAlign: "center",
        fontFamily: "Inter, sans-serif",
        fontWeight: bold ? 800 : 500,
        fontSize,
        lineHeight: 1.15,
        letterSpacing: -1,
        textTransform: uppercase ? "uppercase" : "none",
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
            }}
          >
            {w.word}
          </span>
        );
      })}
    </div>
  );
};
