import React from "react";
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Video } from "@remotion/media";
import { z } from "zod";
import { getTheme } from "./themes";
import { isUrl } from "./color";
import { useBrandFonts } from "./fonts";

// ---------------------------------------------------------------------------
// BlurFillVideo: converte video HORIZONTAL (16:9) em vertical 9:16 sem esticar nem cortar.
// Fundo = o proprio video em cover, desfocado e escurecido; primeiro plano = o video original
// em contain, centralizado. Texto de apresentacao opcional colado a borda superior do video
// (com fundo justo do tamanho do texto) e credito discreto no rodape, dentro da area segura.
// Use so com video que voce tem direito de usar e sempre com o credito da fonte.
// Render: duracao = durationSec (props). Video pelo componente Video do @remotion/media
// (WebCodecs); no Windows o OffthreadVideo ja saiu com quadro branco ou preto em alguns videos.
// ---------------------------------------------------------------------------

export const blurFillVideoSchema = z.object({
  themeSlug: z.string().default("exemplo"),
  src: z.string().default("clipe-horizontal.mp4"), // arquivo em remotion/public/ ou URL
  srcWidth: z.number().default(1920), // tamanho nativo do video (ffprobe)
  srcHeight: z.number().default(1080),
  durationSec: z.number().default(10),
  topText: z.string().default(""), // texto de apresentacao (vazio = sem)
  credit: z.string().default(""), // ex: "via @fonte" (vazio = sem)
});

export type BlurFillVideoProps = z.input<typeof blurFillVideoSchema>;

const W = 1080;
const H = 1920;
const SAFE_BOTTOM = 220; // acima da barra de resposta nativa do Story/Reel

export const BlurFillVideo: React.FC<BlurFillVideoProps> = (raw) => {
  const p = blurFillVideoSchema.parse(raw);
  const theme = getTheme(p.themeSlug);
  useBrandFonts([theme.fontBody]);
  const font = `${theme.fontBody}, Inter, sans-serif`;
  const frame = useCurrentFrame();
  const file = isUrl(p.src) ? p.src : staticFile(p.src);

  const bgScale = Math.max(W / p.srcWidth, H / p.srcHeight) * 1.12; // margem para o blur nao vazar a borda
  const bgW = p.srcWidth * bgScale;
  const bgH = p.srcHeight * bgScale;
  const fgScale = Math.min(W / p.srcWidth, H / p.srcHeight);
  const fgW = p.srcWidth * fgScale;
  const fgH = p.srcHeight * fgScale;
  const fgTop = (H - fgH) / 2;
  const textIn = interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg }}>
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            width: bgW,
            height: bgH,
            left: (W - bgW) / 2,
            top: (H - bgH) / 2,
            filter: "blur(36px) brightness(0.55) saturate(1.05)",
            transform: "scale(1.05)",
          }}
        >
          <Video src={file} volume={0} objectFit="cover" style={{ width: "100%", height: "100%" }} />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0) 78%, rgba(0,0,0,0.55) 100%)" }} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ width: fgW, height: fgH, boxShadow: "0 24px 70px rgba(0,0,0,0.5)" }}>
          <Video src={file} objectFit="contain" style={{ width: "100%", height: "100%" }} />
        </div>
      </AbsoluteFill>
      {p.credit ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: SAFE_BOTTOM,
            textAlign: "center",
            fontFamily: font,
            fontWeight: 600,
            fontSize: 30,
            letterSpacing: "0.02em",
            color: "#FFFFFF",
            textShadow: "0 2px 8px rgba(0,0,0,0.9), 0 4px 16px rgba(0,0,0,0.7)",
          }}
        >
          {p.credit}
        </div>
      ) : null}
      {p.topText ? (
        // ancorado na borda superior do video, sem fade-out: visivel do inicio ao fim
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: fgTop,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            alignItems: "center",
            padding: "0 72px 28px",
            opacity: textIn,
          }}
        >
          <div
            style={{
              background: "rgba(0,0,0,0.58)",
              borderRadius: 20,
              padding: "22px 36px",
              fontFamily: font,
              fontWeight: 400,
              fontSize: 46,
              lineHeight: 1.5,
              color: "#FFFFFF",
              textAlign: "center",
              whiteSpace: "pre-wrap",
              textShadow: "0 2px 8px rgba(0,0,0,0.9)",
            }}
          >
            {p.topText}
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
