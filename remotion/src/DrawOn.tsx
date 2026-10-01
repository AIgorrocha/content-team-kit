import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { z } from "zod";
import { getTheme } from "./themes";
import { useBrandFonts } from "./fonts";

// ---------------------------------------------------------------------------
// DrawOn: tracos SVG que se desenham sozinhos (draw-on). Serve para assinatura, sublinhado,
// diagrama de fluxo, contorno de planta ou wireframe: cada caminho (path) e desenhado em
// sequencia (stagger); caminho fechado (termina em Z) preenche depois do traco. Legenda opcional
// entra quando o desenho termina. O truque: pathLength="1" faz strokeDasharray 1 e
// strokeDashoffset ir de 1 ate 0 em funcao do frame (deterministico, sem CSS animation).
//   npx remotion still DrawOn ../output/x.png --props='{"paths":[{"d":"M100 900 C400 600 700 1200 980 900"}]}'
// Cores e fonte vem do tema da marca (themeSlug).
// ---------------------------------------------------------------------------

const pathSpec = z.object({
  d: z.string(), // dados do caminho SVG, no viewBox abaixo
  drawFrames: z.number().default(45), // quanto tempo leva para desenhar
  fill: z.boolean().default(false), // preenche depois de desenhar (use com caminho fechado)
});

export const drawOnSchema = z.object({
  themeSlug: z.string().default("exemplo"),
  viewBox: z.string().default("0 0 1080 1920"),
  paths: z
    .array(pathSpec)
    .default([{ d: "M140 960 C360 640 620 1280 940 960", drawFrames: 60, fill: false }]),
  strokeWidth: z.number().default(10),
  staggerFrames: z.number().default(20), // espera entre o inicio de um traco e o do proximo
  glow: z.boolean().default(false), // brilho suave na cor de destaque (use com moderacao)
  caption: z.string().default(""), // frase que aparece quando tudo terminou
  durationInFrames: z.number().default(150),
});

export type DrawOnProps = z.input<typeof drawOnSchema>;

export const DrawOn: React.FC<DrawOnProps> = (raw) => {
  const p = drawOnSchema.parse(raw);
  const frame = useCurrentFrame();
  const theme = getTheme(p.themeSlug);
  useBrandFonts([theme.fontDisplay]);
  let start = 0;
  let end = 0;
  const timed = p.paths.map((s) => {
    const from = start;
    start += p.staggerFrames;
    end = Math.max(end, from + s.drawFrames);
    return { s, from };
  });
  const capIn = interpolate(frame, [end + 6, end + 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, justifyContent: "center", alignItems: "center" }}>
      <svg viewBox={p.viewBox} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        {timed.map(({ s, from }, i) => {
          const t = interpolate(frame, [from, from + s.drawFrames], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.inOut(Easing.cubic),
          });
          const fillIn = s.fill ? interpolate(frame, [from + s.drawFrames, from + s.drawFrames + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
          return (
            <path
              key={i}
              d={s.d}
              pathLength={1}
              fill={theme.accent}
              fillOpacity={fillIn}
              stroke={theme.accent}
              strokeWidth={p.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={1}
              strokeDashoffset={1 - t}
              style={p.glow ? { filter: `drop-shadow(0 0 14px ${theme.accent})` } : undefined}
            />
          );
        })}
      </svg>
      {p.caption ? (
        <div
          style={{
            position: "absolute",
            bottom: 300,
            left: 90,
            right: 90,
            textAlign: "center",
            fontFamily: `${theme.fontDisplay}, Inter, sans-serif`,
            fontWeight: 800,
            fontSize: 64,
            color: theme.textPrimary,
            opacity: capIn,
            transform: `translateY(${(1 - capIn) * 20}px)`,
          }}
        >
          {p.caption}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
