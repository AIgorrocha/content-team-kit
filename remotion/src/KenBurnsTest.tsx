import React from "react";
import {
  AbsoluteFill,
  Img,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  staticFile,
} from "remotion";
import { z } from "zod";

// ---------------------------------------------------------------------------
// KenBurnsTest - teste de motion.
// Anima por CODIGO (gratis) um recorte de prancha 2D estatica de alta resolucao:
// pan lateral (esquerda para direita) + zoom suave.
// Tudo frame-a-frame (useCurrentFrame + interpolate), nunca CSS transition.
// White-label: fundo na cor do cliente ativo.
// ---------------------------------------------------------------------------

export const kenBurnsSchema = z.object({
  src: z.string(),
  bg: z.string(),
  // fracao 0..1 de quanto panoramizar na horizontal (esq->dir)
  panX: z.number(),
  panYStart: z.number(),
  zoomFrom: z.number(),
  zoomTo: z.number(),
});

export const KEN_BURNS_FRAMES = 150; // 5s @ 30fps

export const KenBurnsTest: React.FC<z.infer<typeof kenBurnsSchema>> = ({
  src,
  bg,
  panX,
  panYStart,
  zoomFrom,
  zoomTo,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();

  // progresso 0..1 ao longo do clipe
  const p = interpolate(frame, [0, durationInFrames - 1], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Escala base pra COBRIR o frame 1080x1920 com folga (overscan) e sobrar
  // margem de pan horizontal. Imagem de origem = 1080x1350 (4:5).
  // Cover vertical exige >= 1920/1350 = 1.422; usamos base 1.55 pra folga.
  const zoom = interpolate(p, [0, 1], [zoomFrom, zoomTo]);

  // Deslocamento horizontal (pan lateral seguindo a linha da rede).
  // panX = fracao do overscan horizontal a percorrer.
  const scaledW = 1080 * zoom;
  const scaledH = 1350 * zoom;
  const overX = scaledW - width; // sobra horizontal
  const overY = scaledH - height; // sobra vertical (pode ser negativa)

  // comeca deslocado a esquerda, termina a direita
  const tx = interpolate(p, [0, 1], [overX / 2, -overX / 2 + overX * (1 - panX)]);
  // leve deriva vertical pra manter a linha (topo) enquadrada
  const ty = interpolate(p, [0, 1], [overY * panYStart, overY * (panYStart - 0.12)]);

  return (
    <AbsoluteFill style={{ backgroundColor: bg }}>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          overflow: "hidden",
        }}
      >
        <Img
          src={staticFile(src)}
          style={{
            width: scaledW,
            height: scaledH,
            maxWidth: "none",
            transform: `translate(${tx}px, ${ty}px)`,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
