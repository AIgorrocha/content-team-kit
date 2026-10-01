import React from "react";
import { AbsoluteFill, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { Audio, Video } from "@remotion/media";
import { z } from "zod";
import { getTheme } from "./themes";
import { isUrl, withAlpha } from "./color";
import { useBrandFonts } from "./fonts";

// ---------------------------------------------------------------------------
// StoryScenes: reel "storytelling" por cenas de TEXTO GRANDE sobre midia real, com crossfade
// curto, veu de contraste e cartao final com logo. Serve para reel mudo (trilha entra depois,
// em audioSrc) e para o mesmo roteiro em 9:16 e 16:9 (mesmas props, enquadramento por focusY).
// Tipos de cena:
//   video       : clipe real (mudo) cobrindo o quadro
//   image       : foto/imagem com Ken Burns (zoom e deslocamento lentos)
//   infographic : prancha ou print tecnico: zoom na regiao que importa, o resto escurece, e um
//                 NUMERO GRANDE conta de 0 ate o valor (count-up). Nunca mostrar a prancha crua.
// Cada cena aparece uma vez e nao se repete. Tudo frame a frame, sem CSS transition.
// Tema (cores e fontes) vem de clients/{slug}/design-system.md (themeSlug).
// ---------------------------------------------------------------------------

const hero = z.object({
  value: z.number(),
  label: z.string().default(""),
  prefix: z.string().default(""),
  suffix: z.string().default(""),
});

const scene = z.object({
  kind: z.enum(["video", "image", "infographic"]).default("image"),
  src: z.string(), // arquivo em remotion/public/ ou URL
  text: z.string().default(""),
  fontSize: z.number().default(56),
  durationInFrames: z.number().default(120),
  focusX: z.number().default(0.5), // 0..1: ponto da imagem que fica em foco
  focusY: z.number().default(0.5),
  zoomFrom: z.number().default(1.0),
  zoomTo: z.number().default(1.12),
  hero: hero.nullable().default(null), // so em "infographic"
});

export const storyScenesSchema = z.object({
  themeSlug: z.string().default("exemplo"),
  scenes: z.array(scene).default([]),
  endCard: z.object({ text: z.string().default(""), logo: z.string().nullable().default(null) }).nullable().default(null),
  endCardFrames: z.number().default(90),
  audioSrc: z.string().nullable().default(null), // trilha; vazio = reel mudo
  crossfadeFrames: z.number().default(8),
});

// Props de entrada (campos com padrao sao opcionais). O Remotion nao aplica os padroes do zod
// em campos aninhados ao ler --props, entao a composicao faz o parse aqui.
export type StoryScenesProps = z.input<typeof storyScenesSchema>;
type Parsed = z.infer<typeof storyScenesSchema>;
type Scene = Parsed["scenes"][number];

export const storyScenesFrames = (raw: StoryScenesProps): number => {
  const p = storyScenesSchema.parse(raw);
  return Math.max(1, p.scenes.reduce((a, s) => a + s.durationInFrames, 0) + (p.endCard ? p.endCardFrames : 0));
};

const src = (s: string) => (isUrl(s) ? s : staticFile(s));
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const Media: React.FC<{ s: Scene; durF: number }> = ({ s, durF }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const zoom = interpolate(frame, [0, durF], [s.zoomFrom, s.zoomTo], { ...clamp, easing: Easing.inOut(Easing.quad) });
  // transform-origin no ponto de foco: o zoom aproxima dele (e recorta o resto)
  const origin = `${s.focusX * 100}% ${s.focusY * 100}%`;
  const fit = { width, height, objectFit: "cover" as const, objectPosition: origin };
  if (s.kind === "video") {
    return (
      <AbsoluteFill>
        <Video src={src(s.src)} muted loop objectFit="cover" style={{ width: "100%", height: "100%", objectPosition: origin }} />
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Img src={src(s.src)} style={{ ...fit, transformOrigin: origin, transform: `scale(${zoom})` }} />
    </AbsoluteFill>
  );
};

const HeroNumber: React.FC<{ h: NonNullable<Scene["hero"]>; durF: number; accent: string; text: string; font: string }> = ({
  h,
  durF,
  accent,
  text,
  font,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const wide = width > height;
  const t = interpolate(frame, [8, Math.min(durF - 10, 70)], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const shown = Math.round(h.value * t);
  const enter = interpolate(frame, [4, 20], [0, 1], clamp);
  return (
    <div
      style={{
        position: "absolute",
        ...(wide ? { right: 90, top: "50%", transform: `translateY(-50%)`, textAlign: "right" } : { left: 0, right: 0, bottom: 300, textAlign: "center" }),
        opacity: enter,
        fontFamily: font,
      }}
    >
      <div style={{ fontSize: wide ? 170 : 200, fontWeight: 800, lineHeight: 1, color: accent, textShadow: "0 6px 28px rgba(0,0,0,0.7)" }}>
        {h.prefix}
        {shown.toLocaleString("pt-BR")}
        {h.suffix}
      </div>
      {h.label ? <div style={{ fontSize: 40, fontWeight: 600, marginTop: 10, color: text, textShadow: "0 3px 14px rgba(0,0,0,0.8)" }}>{h.label}</div> : null}
    </div>
  );
};

const SceneView: React.FC<{ s: Scene; durF: number; xf: number; bg: string; accent: string; textColor: string; font: string }> = ({
  s,
  durF,
  xf,
  bg,
  accent,
  textColor,
  font,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const wide = width > height;
  // entrada e saida por crossfade (sobreposicao curta com os vizinhos)
  const opacity = Math.min(interpolate(frame, [0, xf], [0, 1], clamp), interpolate(frame, [durF - xf, durF], [1, 0], clamp));
  const textIn = interpolate(frame, [xf, xf + 14], [0, 1], clamp);
  const textY = interpolate(frame, [xf, xf + 18], [22, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  const side = wide ? 120 : 84;
  return (
    <AbsoluteFill style={{ opacity, backgroundColor: bg }}>
      <Media s={s} durF={durF} />
      {s.kind === "infographic" ? (
        // escurece o que nao e a regiao em foco
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at ${s.focusX * 100}% ${s.focusY * 100}%, rgba(0,0,0,0) 12%, ${withAlpha(bg, 0.78)} 70%)`,
          }}
        />
      ) : null}
      {/* veu para ler o texto sobre qualquer fundo */}
      <AbsoluteFill
        style={{ background: `linear-gradient(180deg, ${withAlpha(bg, 0.35)} 0%, ${withAlpha(bg, 0.05)} 35%, ${withAlpha(bg, 0.7)} 100%)` }}
      />
      {s.text ? (
        <div
          style={{
            position: "absolute",
            left: side,
            right: wide && s.kind === "infographic" ? width * 0.42 : side,
            bottom: wide ? 110 : 240,
            textAlign: wide && s.kind === "infographic" ? "left" : "center",
            fontFamily: font,
            fontWeight: 800,
            fontSize: wide ? Math.round(s.fontSize * 0.85) : s.fontSize,
            lineHeight: 1.14,
            color: textColor,
            textShadow: "0 4px 22px rgba(0,0,0,0.85)",
            opacity: textIn,
            transform: `translateY(${textY}px)`,
          }}
        >
          {s.text}
        </div>
      ) : null}
      {s.kind === "infographic" && s.hero ? <HeroNumber h={s.hero} durF={durF} accent={accent} text={textColor} font={font} /> : null}
    </AbsoluteFill>
  );
};

const EndCard: React.FC<{ card: NonNullable<Parsed["endCard"]>; bg: string; textColor: string; font: string }> = ({ card, bg, textColor, font }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, 18], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: bg, justifyContent: "center", alignItems: "center", gap: 36, opacity: t }}>
      {card.logo ? <Img src={src(card.logo)} style={{ width: 340, height: "auto", objectFit: "contain" }} /> : null}
      {card.text ? <div style={{ fontFamily: font, fontSize: 52, fontWeight: 700, color: textColor, textAlign: "center", padding: "0 100px" }}>{card.text}</div> : null}
    </AbsoluteFill>
  );
};

export const StoryScenes: React.FC<StoryScenesProps> = (raw) => {
  const p = storyScenesSchema.parse(raw);
  const theme = getTheme(p.themeSlug);
  useBrandFonts([theme.fontDisplay, theme.fontBody]);
  const font = `${theme.fontDisplay}, Inter, sans-serif`;
  const XF = p.crossfadeFrames;
  let cursor = 0;
  const placed = p.scenes.map((s) => {
    // cada cena comeca XF frames antes do fim da anterior (sobreposicao do crossfade)
    const from = Math.max(0, cursor - (cursor > 0 ? XF : 0));
    const dur = s.durationInFrames + (cursor > 0 ? XF : 0);
    cursor += s.durationInFrames;
    return { s, from, dur };
  });
  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg }}>
      {p.audioSrc ? <Audio src={src(p.audioSrc)} /> : null}
      {placed.map(({ s, from, dur }, i) => (
        <Sequence key={i} from={from} durationInFrames={dur}>
          <SceneView s={s} durF={dur} xf={XF} bg={theme.bg} accent={theme.accent} textColor={theme.textPrimary} font={font} />
        </Sequence>
      ))}
      {p.endCard ? (
        <Sequence from={cursor} durationInFrames={p.endCardFrames}>
          <EndCard card={p.endCard} bg={theme.bg} textColor={theme.textPrimary} font={font} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};
