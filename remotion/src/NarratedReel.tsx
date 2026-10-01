import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { Audio, Video } from "@remotion/media";
import { z } from "zod";
import { getTheme } from "./themes";
import { isUrl, withAlpha } from "./color";
import { useBrandFonts } from "./fonts";

// ---------------------------------------------------------------------------
// NarratedReel: reel narrado com a VOZ REAL da pessoa + um visual por assunto
// (clipe de video ou imagem) + legenda frase a frase sincronizada com a fala.
// Pipeline completo em skills/ct-reel-narrado-higgsfield/SKILL.md.
//
// Os segmentos (tempos e palavras) saem de scripts/video-editor/build-narrated-captions.mjs
// a partir do WhisperX da narracao. Cada segmento comeca no instante da PRIMEIRA palavra
// real do bloco (nunca em tempo estimado); segmentos contiguos, crossfade curto, SFX opcional.
// Tema (cores e fontes) vem de clients/{slug}/design-system.md (themeSlug).
// Tudo frame a frame (useCurrentFrame), sem CSS transition.
// ---------------------------------------------------------------------------

const capWord = z.object({
  text: z.string(),
  startMs: z.number(), // relativo ao inicio do segmento
  br: z.boolean().default(false), // true = inicia uma nova frase (nova linha de legenda)
});

const segment = z.object({
  key: z.string(),
  src: z.string(), // arquivo em remotion/public/ (ou URL): clipe .mp4/.webm/.mov ou imagem
  kind: z.enum(["video", "image"]).default("video"),
  clipSec: z.number().nullable().default(null), // duracao nativa do clipe: ajusta a velocidade ao segmento
  startMs: z.number(),
  endMs: z.number(),
  words: z.array(capWord).default([]),
  captionAnchor: z.enum(["bottom", "mid"]).default("bottom"),
});

export const narratedReelSchema = z.object({
  themeSlug: z.string().default("exemplo"),
  audioSrc: z.string().nullable().default(null), // narracao em .mp3 (Remotion nao le .m4a)
  sfxSrc: z.string().nullable().default(null), // ex: "sfx/whoosh.wav", tocado a cada troca de cena
  segments: z.array(segment).default([]),
  captionColor: z.string().default("#FFFFFF"),
  captionUppercase: z.boolean().default(true),
  footerText: z.string().default(""), // ex: @perfil da marca (vazio = sem rodape)
  crossfadeFrames: z.number().default(8),
});

// Props de entrada (campos com padrao sao opcionais); o parse acontece na composicao porque o
// Remotion nao aplica os padroes do zod em campos aninhados ao ler --props.
export type NarratedReelProps = z.input<typeof narratedReelSchema>;
type Parsed = z.infer<typeof narratedReelSchema>;
type Seg = Parsed["segments"][number];

const W = 1080;
const H = 1920;
const FPS = 30;
const TAIL_FRAMES = 18;
const SAFE_BOTTOM = 175;
const SAFE_SIDE = 80;

export const narratedReelFrames = (raw: NarratedReelProps): number => {
  const { segments } = narratedReelSchema.parse(raw);
  return segments.length ? Math.round((segments[segments.length - 1].endMs / 1000) * FPS) + TAIL_FRAMES : 30;
};

const src = (s: string) => (isUrl(s) ? s : staticFile(s));

const Visual: React.FC<{ seg: Seg; durF: number }> = ({ seg, durF }) => {
  const frame = useCurrentFrame();
  if (seg.kind === "image") {
    // movimento sutil: zoom lento (nunca imagem parada)
    const zoom = interpolate(frame, [0, durF], [1.0, 1.08], { extrapolateRight: "clamp" });
    return (
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <Img src={src(seg.src)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom})` }} />
      </AbsoluteFill>
    );
  }
  const rate = seg.clipSec ? Math.min(1.8, Math.max(0.6, seg.clipSec / (durF / FPS))) : 1;
  return (
    <AbsoluteFill>
      <Video src={src(seg.src)} playbackRate={rate} muted loop objectFit="cover" style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};

// Legenda frase a frase (frame local da Sequence, deslocado por leadF).
const Caption: React.FC<{
  words: Seg["words"];
  anchor: "bottom" | "mid";
  leadF: number;
  color: string;
  uppercase: boolean;
  fontFamily: string;
}> = ({ words, anchor, leadF, color, uppercase, fontFamily }) => {
  const frame = useCurrentFrame();
  const ms = ((frame - leadF) / FPS) * 1000;
  if (!words.length) return null;
  const lines: { text: string[]; start: number }[] = [];
  words.forEach((w) => {
    if (w.br || lines.length === 0) lines.push({ text: [], start: w.startMs });
    lines[lines.length - 1].text.push(w.text);
  });
  let active = 0;
  lines.forEach((l, i) => {
    if (ms >= l.start) active = i;
  });
  const line = lines[active];
  const local = ms - line.start;
  const opacity = interpolate(local, [0, 120], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(local, [0, 160], [16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        left: SAFE_SIDE,
        right: SAFE_SIDE,
        ...(anchor === "mid" ? { top: H * 0.36 } : { bottom: SAFE_BOTTOM + 110 }),
        textAlign: "center",
        opacity,
        transform: `translateY(${y}px)`,
      }}
    >
      <span
        style={{
          fontFamily,
          fontWeight: 800,
          fontSize: 64,
          lineHeight: 1.06,
          letterSpacing: "0.01em",
          textTransform: uppercase ? "uppercase" : "none",
          color,
          textShadow: "0 4px 18px rgba(0,0,0,0.85)",
        }}
      >
        {line.text.join(" ")}
      </span>
    </div>
  );
};

const SegView: React.FC<{
  seg: Seg;
  durF: number;
  leadF: number;
  xf: number;
  props: Parsed;
  fontFamily: string;
  bg: string;
  textMeta: string;
}> = ({ seg, durF, leadF, xf, props, fontFamily, bg, textMeta }) => {
  const frame = useCurrentFrame();
  // crossfade: entra/sai por xf frames (sobreposicao curta com os vizinhos)
  const fadeIn = interpolate(frame, [0, xf], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durF - xf, durF], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: Math.min(fadeIn, fadeOut) }}>
      <AbsoluteFill style={{ backgroundColor: bg }} />
      <Visual seg={seg} durF={durF} />
      {/* veu na cor de fundo da marca: contraste do texto sobre qualquer visual */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${withAlpha(bg, 0.55)} 0%, ${withAlpha(bg, 0.05)} 30%, ${withAlpha(bg, 0.1)} 55%, ${withAlpha(bg, 0.78)} 100%)`,
        }}
      />
      <Caption
        words={seg.words}
        anchor={seg.captionAnchor}
        leadF={leadF}
        color={props.captionColor}
        uppercase={props.captionUppercase}
        fontFamily={fontFamily}
      />
      {props.footerText ? (
        <div
          style={{
            position: "absolute",
            bottom: SAFE_BOTTOM,
            left: 0,
            width: W,
            textAlign: "center",
            fontFamily,
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: "0.04em",
            color: textMeta,
            opacity: 0.9,
            textShadow: "0 2px 12px rgba(0,0,0,0.7)",
          }}
        >
          {props.footerText}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export const NarratedReel: React.FC<NarratedReelProps> = (raw) => {
  const props = narratedReelSchema.parse(raw);
  const theme = getTheme(props.themeSlug);
  useBrandFonts([theme.fontDisplay, theme.fontBody]);
  const fontFamily = `${theme.fontDisplay}, Inter, sans-serif`;
  const { segments, crossfadeFrames: XF } = props;
  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg }}>
      {props.audioSrc ? <Audio src={src(props.audioSrc)} /> : null}
      {/* SFX em cada transicao (inicio de cada segmento, exceto o 1o) */}
      {props.sfxSrc
        ? segments.map((seg, i) => {
            if (i === 0) return null;
            const s0 = Math.round((seg.startMs / 1000) * FPS);
            return (
              <Sequence key={"sfx" + seg.key} from={Math.max(0, s0 - 6)} durationInFrames={16}>
                <Audio src={src(props.sfxSrc as string)} volume={0.6} />
              </Sequence>
            );
          })
        : null}
      {segments.map((seg, i) => {
        const last = i === segments.length - 1;
        const s0 = Math.round((seg.startMs / 1000) * FPS);
        const e0 = Math.round((seg.endMs / 1000) * FPS);
        const from = i === 0 ? 0 : s0 - XF; // entra XF antes (sobrepoe o anterior)
        const end = last ? e0 + TAIL_FRAMES : e0 + XF; // sai XF depois (sobrepoe o proximo)
        return (
          <Sequence key={seg.key} from={from} durationInFrames={end - from}>
            <SegView
              seg={seg}
              durF={end - from}
              leadF={s0 - from}
              xf={XF}
              props={props}
              fontFamily={fontFamily}
              bg={theme.bg}
              textMeta={theme.textSecondary}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
