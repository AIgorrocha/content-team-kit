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
// CapCutSplit - composicao "CapCut em codigo".
// Topo: video da pessoa falando. Base: gravacao da tela (proposta no navegador).
// Layout alterna por cena (split / screen / talk) e legenda anima palavra-a-palavra.
// Tudo frame-a-frame (useCurrentFrame), nunca CSS transition (regra remotion).
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
  mode: z.enum(["split", "screen", "talk"]),
  // imagem especifica deste segmento (ex: screenshot de um repo). Se presente,
  // sobrepoe o screenImage global so enquanto este segmento esta ativo.
  image: z.string().nullable().optional(),
  imageHeight: z.number().optional(),
});

export const capCutSplitSchema = z.object({
  // "exemplo" = tema neutro de reserva. Tema da marca: node scripts/video/emit-theme.mjs {slug}.
  themeSlug: z.string().default("exemplo"),
  talkingSrc: z.string(), // staticFile path (mp4 da pessoa falando)
  screenSrc: z.string().nullable().default(null), // staticFile path (gravacao tela) ou null
  // alternativa SEM stutter: screenshot full-page (imagem alta) que o Remotion
  // rola por codigo (pan determinístico 30fps, zero flicker de captura).
  screenImage: z.string().nullable().default(null),
  screenImageHeight: z.number().default(0), // altura real da imagem (px)
  audioSrc: z.string().nullable().default(null), // audio separado, se houver
  captions: z.array(pageSchema).default([]),
  layout: z.array(layoutSegSchema).default([]),
  // Estilo da legenda: vem de clients/{slug}/design-system.md ("Legenda de reel"),
  // preenchido por scripts/video-editor/run-editor.mjs. Padrao do kit = branca, sem destaque.
  captionStyle: z.enum(["phrase", "word"]).default("phrase"),
  captionColor: z.string().default("#FFFFFF"),
  highlightColor: z.string().nullable().default(null), // cor da palavra falada (so em "word")
  captionUppercase: z.boolean().default(true),
  captionBold: z.boolean().default(true),
  captionPosition: z.enum(["bottom", "center"]).default("bottom"),
  // opcionais (ausente = padrao): fonte, tamanho, espacamentos, linhas no maximo e contorno
  captionFont: z.string().optional(),
  captionSize: z.number().optional(),
  captionLetterSpacing: z.number().optional(),
  captionLineHeight: z.number().optional(),
  captionMaxLines: z.number().nullable().optional(),
  captionOutline: z.object({ color: z.string(), width: z.number() }).nullable().optional(),
});

export type CapCutSplitProps = z.infer<typeof capCutSplitSchema>;

const W = 1080;
const H = 1920;

// Helper: src pode ser URL absoluta, http, ou nome de arquivo em public/
const resolveSrc = (s: string) =>
  s.startsWith("http") || s.startsWith("/") ? s : staticFile(s);

type Mode = "split" | "screen" | "talk";

// Altura do painel de cima por modo.
const topHForMode = (mode: Mode) =>
  mode === "talk" ? H : mode === "screen" ? 0 : Math.round(H * 0.46);

// Indice do segmento ativo neste segundo.
const segIndexAt = (layout: CapCutSplitProps["layout"], sec: number) => {
  for (let i = 0; i < layout.length; i++) {
    if (sec >= layout[i].fromSec && sec < layout[i].toSec) return i;
  }
  return -1;
};

// Qual modo de layout esta ativo neste segundo.
const modeAt = (layout: CapCutSplitProps["layout"], sec: number): Mode => {
  const i = segIndexAt(layout, sec);
  return i >= 0 ? (layout[i].mode as Mode) : "split";
};

// -------------------- Legenda estilo CapCut --------------------
const Captions: React.FC<{
  captions: CapCutSplitProps["captions"];
  style: Pick<
    CapCutSplitProps,
    "captionStyle" | "captionColor" | "highlightColor" | "captionUppercase" | "captionBold" | "captionPosition"
    | "captionFont" | "captionSize" | "captionLetterSpacing" | "captionLineHeight" | "captionMaxLines" | "captionOutline"
  >;
}> = ({ captions, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;

  const page = captions.find((p) => ms >= p.startMs && ms < p.endMs);
  if (!page) return null;

  // pop de entrada da pagina
  const pageAgeMs = ms - page.startMs;
  const pop = interpolate(pageAgeMs, [0, 120], [0.9, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Posicao fixa em todos os modos (terco inferior ou centro, conforme a marca).
  return (
    <AbsoluteFill
      style={{
        justifyContent: style.captionPosition === "center" ? "center" : "flex-end",
        alignItems: "center",
        paddingBottom: style.captionPosition === "center" ? 0 : "13%",
      }}
    >
      <div style={{ transform: `scale(${pop})`, width: "100%", display: "flex", justifyContent: "center" }}>
        <CaptionText
          words={page.words}
          ms={ms}
          captionStyle={style.captionStyle}
          captionColor={style.captionColor}
          highlightColor={style.highlightColor}
          uppercase={style.captionUppercase}
          bold={style.captionBold}
          font={style.captionFont}
          letterSpacing={style.captionLetterSpacing}
          lineHeight={style.captionLineHeight}
          maxLines={style.captionMaxLines}
          outline={style.captionOutline}
          fontSize={style.captionSize ?? 76}
          // legenda classica: cor da marca com sombra preta suave (sem contorno/stroke)
          shadow="0 2px 6px rgba(0,0,0,0.85), 0 4px 14px rgba(0,0,0,0.7)"
        />
      </div>
    </AbsoluteFill>
  );
};

// -------------------- Frames de video --------------------
const TalkingVideo: React.FC<{ src: string; muted?: boolean }> = ({
  src,
  muted,
}) => (
  <OffthreadVideo
    src={resolveSrc(src)}
    muted={muted}
    style={{ width: "100%", height: "100%", objectFit: "cover" }}
  />
);

const ScreenVideo: React.FC<{ src: string }> = ({ src }) => (
  <OffthreadVideo
    src={resolveSrc(src)}
    muted
    style={{ width: "100%", height: "100%", objectFit: "cover" }}
  />
);

// Pan deterministico de uma imagem alta (screenshot full-page da proposta).
// Rola do topo ao fim ao longo de TODA a composicao. Sem stutter de captura.
const ScreenImagePan: React.FC<{ src: string; imgH: number }> = ({
  src,
  imgH,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const maxOffset = Math.max(imgH - H, 0); // imagem tem largura W=1080
  // pausa 0.6s no topo e 0.6s no fim, rola o meio
  const offset = interpolate(
    frame,
    [Math.round(0.6 * 30), durationInFrames - Math.round(0.6 * 30)],
    [0, maxOffset],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <Img
        src={resolveSrc(src)}
        style={{
          position: "absolute",
          top: -offset,
          left: 0,
          width: W,
          height: imgH,
          display: "block",
        }}
      />
    </div>
  );
};

export const CapCutSplit: React.FC<CapCutSplitProps> = (props) => {
  const {
    themeSlug,
    talkingSrc,
    screenSrc,
    screenImage,
    screenImageHeight,
    audioSrc,
    captions,
    layout,
  } = props;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = getTheme(themeSlug);
  const sec = frame / fps;
  const mode = modeAt(layout, sec);

  // Transicao suave (deterministica) de altura do painel de cima.
  // split: ~46% | talk: 100% | screen: 0% (vira PIP).
  const segIdx = segIndexAt(layout, sec);
  const curTarget = topHForMode(mode);
  const prevTarget =
    segIdx > 0 ? topHForMode(layout[segIdx - 1].mode as Mode) : curTarget;
  const segStartFrame =
    segIdx >= 0 ? Math.round(layout[segIdx].fromSec * fps) : 0;
  const t = spring({
    frame: frame - segStartFrame,
    fps,
    config: { damping: 200 },
    durationInFrames: 12,
  });
  const topH = interpolate(t, [0, 1], [prevTarget, curTarget]);

  // imagem especifica do segmento ativo (ex: screenshot de repo) tem prioridade
  const activeSeg = segIdx >= 0 ? layout[segIdx] : null;
  const segImage = (activeSeg && (activeSeg as { image?: string | null }).image) || null;
  const segImageH = (activeSeg && (activeSeg as { imageHeight?: number }).imageHeight) || 1100;

  const hasScreen = !!screenSrc || !!screenImage;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg }}>
      {/* Camada de FUNDO PERSISTENTE: o proprio video da pessoa em tela cheia, mudo,
          sempre montado (nunca desmonta -> nao gera frame preto, ver regra 2).
          Serve so pra preencher qualquer folga durante as transicoes de layout
          (ex: split->talk, quando o painel cresce por spring): a folga revela o
          mesmo rosto em vez do fundo escuro. Em split fica coberto pela imagem do
          repo; em talk fica coberto pelo painel cheio. */}
      <AbsoluteFill>
        <TalkingVideo src={talkingSrc} muted />
      </AbsoluteFill>

      {/* Camada base: imagem do SEGMENTO (repo) ancorada na faixa de baixo, ou a
          tela global. A imagem do segmento fica posicionada de modo que o topo do
          repo (nome + About) caia na faixa VISIVEL abaixo do painel da pessoa falando. */}
      {segImage ? (
        <AbsoluteFill>
          <div style={{ position: "absolute", top: Math.round(topH), left: 0, width: W, height: Math.max(H - Math.round(topH), 0), overflow: "hidden", background: "#ffffff" }}>
            <Img src={resolveSrc(segImage)} style={{ position: "absolute", top: 0, left: 0, width: W, height: segImageH, display: "block" }} />
          </div>
          {/* scrim escuro degradê no rodape: garante que a legenda clara leia
              sobre a pagina clara do GitHub, sem virar caixa (regra legenda classica). */}
          <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 78%, rgba(0,0,0,0.82) 100%)" }} />
        </AbsoluteFill>
      ) : hasScreen ? (
        <AbsoluteFill>
          {screenImage ? (
            <ScreenImagePan src={screenImage} imgH={screenImageHeight} />
          ) : (
            <ScreenVideo src={screenSrc as string} />
          )}
          {/* leve escurecida pra legenda destacar */}
          <AbsoluteFill style={{ background: "rgba(0,0,0,0.12)" }} />
        </AbsoluteFill>
      ) : null}

      {/* Painel da pessoa falando - UM UNICO wrapper persistente (nunca desmonta).
          Antes havia duas <TalkingVideo> em ramos JSX diferentes (painel vs PIP);
          alternar entre ramos faz o React desmontar/remontar o OffthreadVideo
          exatamente no frame de troca de modo = 1 frame preto na fronteira
          (nao fixavel via nudge de fronteira, pois nao e problema de timing).
          Agora o wrapper e sempre o mesmo elemento; so a geometria (top/left/
          width/height/radius/border) e interpolada por `t` (0=modo anterior,
          1=modo atual), preservando a instancia do <video> o tempo todo. */}
      {(() => {
        const isPip = (m: Mode) => m === "screen";
        const boxFor = (m: Mode) =>
          isPip(m)
            ? { top: 60, left: W - 48 - 360, width: 360, height: 360, radius: 28, border: 5 }
            : { top: 0, left: 0, width: W, height: topHForMode(m), radius: 0, border: mode === "split" ? 6 : 0 };
        const prevBox = boxFor(segIdx > 0 ? (layout[segIdx - 1].mode as Mode) : mode);
        const curBox = boxFor(mode);
        const lerp = (a: number, b: number) => interpolate(t, [0, 1], [a, b]);
        const isPipNow = isPip(mode);
        return (
          <div
            style={{
              position: "absolute",
              top: lerp(prevBox.top, curBox.top),
              left: lerp(prevBox.left, curBox.left),
              width: lerp(prevBox.width, curBox.width),
              height: lerp(prevBox.height, curBox.height),
              borderRadius: lerp(prevBox.radius, curBox.radius),
              overflow: "hidden",
              border: isPipNow ? "5px solid #FFFFFF" : "none",
              borderBottom:
                !isPipNow && mode === "split" ? "6px solid #FFFFFF" : undefined,
              boxShadow: isPipNow ? "0 12px 40px rgba(0,0,0,0.5)" : "none",
            }}
          >
            <TalkingVideo src={talkingSrc} muted={!!audioSrc} />
          </div>
        );
      })()}

      {/* Audio (se separado do video) */}
      {audioSrc && <Audio src={resolveSrc(audioSrc)} />}

      {/* Legenda CapCut no estilo da marca, fixa, por cima de tudo */}
      <Captions captions={captions} style={props} />
    </AbsoluteFill>
  );
};
