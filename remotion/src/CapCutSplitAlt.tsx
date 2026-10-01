import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  Img,
  Audio,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  staticFile,
} from "remotion";
import { z } from "zod";
import { getTheme } from "./themes";
import { CaptionText } from "./CaptionText";

// ---------------------------------------------------------------------------
// CapCutSplitAlt - split ALTERNADO do padrao canonico do reel talking-head.
// Diferente do CapCutSplit (rosto sempre em cima, legenda fixa embaixo), aqui:
//  - bandas ASSIMETRICAS (rosto maior);
//  - rosto ALTERNA cima/baixo por bloco (faceBottom);
//  - o rosto renderiza SEMPRE por cima do b-roll (nunca coberto);
//  - b-roll por bloco (screenshot real), objectFit cover na banda;
//  - legenda CONDICIONAL: rosto embaixo -> legenda ACIMA do rosto (com scrim);
//    rosto em cima / tela cheia -> legenda no RODAPE.
// Tudo frame-a-frame (useCurrentFrame), video do talento em UMA instancia
// persistente (nunca desmonta -> sem frame preto na fronteira).
// ---------------------------------------------------------------------------

const wordSchema = z.object({
  word: z.string(),
  startMs: z.number(),
  endMs: z.number(),
});
const pageSchema = z.object({
  startMs: z.number(),
  endMs: z.number(),
  text: z.string(),
  words: z.array(wordSchema),
});
const layoutSegSchema = z.object({
  fromSec: z.number(),
  toSec: z.number(),
  mode: z.enum(["split", "talk"]),
  faceBottom: z.boolean().optional(), // so vale em split
  image: z.string().nullable().optional(),
});

export const capCutSplitAltSchema = z.object({
  // "exemplo" = tema neutro de reserva. Tema da marca: node scripts/video/emit-theme.mjs {slug}.
  themeSlug: z.string().default("exemplo"),
  talkingSrc: z.string(),
  audioSrc: z.string().nullable().default(null),
  captions: z.array(pageSchema).default([]),
  layout: z.array(layoutSegSchema).default([]),
  // Estilo da legenda: vem de clients/{slug}/design-system.md ("Legenda de reel"),
  // preenchido por scripts/video-editor/run-editor.mjs. Padrao do kit = branca, sem destaque.
  captionStyle: z.enum(["phrase", "word"]).default("phrase"),
  captionColor: z.string().default("#FFFFFF"),
  highlightColor: z.string().nullable().default(null), // cor da palavra falada (so em "word")
  captionUppercase: z.boolean().default(true),
  captionBold: z.boolean().default(true),
});
export type CapCutSplitAltProps = z.infer<typeof capCutSplitAltSchema>;

const W = 1080;
const H = 1920;
const FACE_H = 1152; // banda do rosto (60%, sempre MAIOR)
const BROLL_H = H - FACE_H; // 768 (40%)
const OBJ_POS = "center 38%"; // enquadra olhos+boca com folga

type Mode = "split" | "talk";

const segIndexAt = (layout: CapCutSplitAltProps["layout"], sec: number) => {
  for (let i = 0; i < layout.length; i++) {
    if (sec >= layout[i].fromSec && sec < layout[i].toSec) return i;
  }
  return layout.length ? layout.length - 1 : -1;
};

// Caixa do rosto por segmento.
const faceBox = (seg: CapCutSplitAltProps["layout"][number] | null) => {
  if (!seg || seg.mode === "talk") return { top: 0, h: H };
  return seg.faceBottom ? { top: H - FACE_H, h: FACE_H } : { top: 0, h: FACE_H };
};

// -------------------- Legenda (branca classica, posicao condicional) --------------------
const Captions: React.FC<{
  captions: CapCutSplitAltProps["captions"];
  layout: CapCutSplitAltProps["layout"];
  style: Pick<
    CapCutSplitAltProps,
    "captionStyle" | "captionColor" | "highlightColor" | "captionUppercase" | "captionBold"
  >;
}> = ({ captions, layout, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const sec = frame / fps;

  const page = captions.find((p) => ms >= p.startMs && ms < p.endMs);
  if (!page) return null;

  const seg = layout[segIndexAt(layout, sec)] || null;
  const faceBottom = !!(seg && seg.mode === "split" && seg.faceBottom);

  const pageAgeMs = ms - page.startMs;
  const pop = interpolate(pageAgeMs, [0, 120], [0.92, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Rosto embaixo -> legenda ACIMA do rosto (fim do bloco de texto ~20px acima
  // da borda superior da banda do rosto). Rosto em cima / talk -> rodape.
  const faceTopEdge = H - FACE_H; // 768
  const containerStyle: React.CSSProperties = faceBottom
    ? {
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: H - (faceTopEdge - 22), // ancora o fundo do texto ~746px
      }
    : { justifyContent: "flex-end", alignItems: "center", paddingBottom: 250 };

  return (
    <AbsoluteFill style={containerStyle}>
      {/* scrim atras da legenda (segura o branco sobre b-roll claro; regra 1d) */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: faceBottom ? faceTopEdge - 210 : 130,
          height: 300,
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.34) 45%, rgba(0,0,0,0.5) 100%)",
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", transform: `scale(${pop})`, width: "100%", display: "flex", justifyContent: "center" }}>
        <CaptionText
          words={page.words}
          ms={ms}
          captionStyle={style.captionStyle}
          captionColor={style.captionColor}
          highlightColor={style.highlightColor}
          uppercase={style.captionUppercase}
          bold={style.captionBold}
          fontSize={74}
          shadow="0 2px 6px rgba(0,0,0,0.9), 0 4px 16px rgba(0,0,0,0.8)"
        />
      </div>
    </AbsoluteFill>
  );
};

const TalkingVideo: React.FC<{ src: string; muted?: boolean }> = ({
  src,
  muted,
}) => (
  <OffthreadVideo
    src={src.startsWith("http") || src.startsWith("/") ? src : staticFile(src)}
    muted={muted}
    style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: OBJ_POS }}
  />
);

// B-roll do bloco: imagem estatica com leve Ken Burns (zoom lento), slide-in na
// ENTRADA (sem fade de saida). objectFit cover na banda.
const Broll: React.FC<{ src: string; segStartFrame: number }> = ({
  src,
  segStartFrame,
}) => {
  const frame = useCurrentFrame();
  const age = frame - segStartFrame;
  const enter = interpolate(age, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ty = interpolate(enter, [0, 1], [36, 0]);
  const zoom = interpolate(age, [0, 150], [1.0, 1.05], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <Img
      src={
        src.startsWith("http") || src.startsWith("/") ? src : staticFile(src)
      }
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: "top center",
        transform: `translateY(${ty}px) scale(${zoom})`,
        opacity: enter,
      }}
    />
  );
};

export const CapCutSplitAlt: React.FC<CapCutSplitAltProps> = (props) => {
  const { themeSlug, talkingSrc, audioSrc, captions, layout } = props;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = getTheme(themeSlug);
  const sec = frame / fps;
  const segIdx = segIndexAt(layout, sec);
  const seg = segIdx >= 0 ? layout[segIdx] : null;
  const prevSeg = segIdx > 0 ? layout[segIdx - 1] : seg;
  const segStartFrame = seg ? Math.round(seg.fromSec * fps) : 0;

  // spring de transicao da caixa do rosto (preserva a instancia do video)
  const t = spring({
    frame: frame - segStartFrame,
    fps,
    config: { damping: 200 },
    durationInFrames: 12,
  });
  const cur = faceBox(seg);
  const prev = faceBox(prevSeg);
  const lerp = (a: number, b: number) => interpolate(t, [0, 1], [a, b]);
  const boxTop = lerp(prev.top, cur.top);
  const boxH = lerp(prev.h, cur.h);

  const isSplit = seg && seg.mode === "split";
  const faceBottom = !!(seg && seg.faceBottom);
  const brollTop = faceBottom ? 0 : FACE_H; // banda do b-roll
  const segImage = (seg && seg.image) || null;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg }}>
      {/* Fundo persistente: o proprio video da pessoa em tela cheia, mudo. Preenche
          qualquer folga durante as transicoes de layout -> nunca revela preto. */}
      <AbsoluteFill>
        <TalkingVideo src={talkingSrc} muted />
      </AbsoluteFill>

      {/* Banda de b-roll do bloco (so em split, com imagem) */}
      {isSplit && segImage ? (
        <div
          style={{
            position: "absolute",
            top: brollTop,
            left: 0,
            width: W,
            height: BROLL_H,
            overflow: "hidden",
            background: "#0D0D0D",
          }}
        >
          <Broll src={segImage} segStartFrame={segStartFrame} />
        </div>
      ) : null}

      {/* Rosto - instancia UNICA persistente, so a geometria interpola. Renderiza
          SEMPRE por cima do b-roll (rosto nunca coberto). */}
      <div
        style={{
          position: "absolute",
          top: boxTop,
          left: 0,
          width: W,
          height: boxH,
          overflow: "hidden",
          borderTop: isSplit && faceBottom ? "5px solid #FFFFFF" : "none",
          borderBottom: isSplit && !faceBottom ? "5px solid #FFFFFF" : "none",
        }}
      >
        <TalkingVideo src={talkingSrc} muted={!!audioSrc} />
      </div>

      {audioSrc && <Audio src={audioSrc.startsWith("http") ? audioSrc : staticFile(audioSrc)} />}

      <Captions captions={captions} layout={layout} style={props} />
    </AbsoluteFill>
  );
};
