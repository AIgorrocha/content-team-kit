import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Poppins";

// ----------------------------------------------------------------------------
// StaticCreative - lote de criativo estatico/reel generico, white-label.
// Layout fixo (logo top-left + headline + subhead + cta pill + foto/mockup +
// balao de audio WhatsApp opcional), mas ZERO cor/texto/logo fixo: tudo vem
// via props `theme` e `assets`. Skill dona: ct-criativos-lote.
// Formatos: story 1080x1920 | feed 1080x1350. Reel = tipografia cinetica 9:16.
// Sem travessao em nenhum texto.
// ----------------------------------------------------------------------------

const { fontFamily: DEFAULT_FONT } = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin", "latin-ext"],
  ignoreTooManyRequestsWarning: true,
});

export type CreativeTheme = {
  bg: string;
  ink: string;
  grey: string;
  accent: string;
  accentDark: string;
  bubble: string; // fundo do balao de audio WhatsApp
  watermark: string; // marca d'agua de predios
  fontFamily?: string; // default: Poppins (latin + latin-ext)
};

export type CreativeAssets = {
  logo: string; // caminho relativo em public/ (ex: "cliente/logo-full.png")
  logoIcon: string; // icone redondo pro balao de audio
  workerPhoto?: string; // foto default do variant "worker"
  appMockup?: string; // banda default do variant "appmockup"
};

export type SubRun = { t: string; teal?: boolean; bold?: boolean };
export type StaticCreativeVariant = "worker" | "appmockup";
export type StaticCreativeFormat = "story" | "feed";

export type StaticCreativeProps = {
  theme: CreativeTheme;
  assets: CreativeAssets;
  persona: string; // primeira palavra/trecho em destaque (cor accent)
  headline: string; // restante da headline
  subhead: SubRun[];
  cta: string;
  variant: StaticCreativeVariant;
  format: StaticCreativeFormat;
  // Foto do worker. Default = assets.workerPhoto. cleanPhoto=true encolhe o
  // fade esquerdo (foto ja nasce limpa, sem residuo de texto/seta).
  workerSrc?: string;
  cleanPhoto?: boolean;
};

function scale(format: StaticCreativeFormat) {
  const feed = format === "feed";
  return {
    padTop: feed ? 90 : 130,
    padSide: 84,
    logoH: feed ? 96 : 118,
    hSize: feed ? 82 : 96,
    subSize: feed ? 34 : 40,
    ctaFont: feed ? 34 : 40,
    ctaPadV: feed ? 26 : 32,
  };
}

const BuildingWatermark: React.FC<{ height: number; color: string }> = ({ height, color }) => (
  <svg
    width={1080}
    height={height}
    viewBox={`0 0 1080 ${height}`}
    style={{ position: "absolute", inset: 0 }}
  >
    <g fill={color}>
      <polygon points={`640,0 760,0 760,${height} 640,${height}`} transform="skewX(-14)" />
      <polygon points={`820,0 900,0 900,${height} 820,${height}`} transform="skewX(-14)" />
      <polygon points={`940,0 1000,0 1000,${height} 940,${height}`} transform="skewX(-14)" />
    </g>
    <g fill="none" stroke={color} strokeWidth={26}>
      <path d={`M 760 ${height * 0.08} L 1080 ${height * 0.08}`} />
    </g>
  </svg>
);

const Logo: React.FC<{ src: string; h: number; padTop: number; padSide: number }> = ({
  src,
  h,
  padTop,
  padSide,
}) => (
  <Img
    src={staticFile(src)}
    style={{ position: "absolute", top: padTop, left: padSide, height: h, width: "auto" }}
  />
);

const Headline: React.FC<{
  persona: string;
  rest: string;
  size: number;
  color: string;
  accent: string;
  fontFamily: string;
  animate?: boolean;
}> = ({ persona, rest, size, color, accent, fontFamily, animate }) => {
  const frame = useCurrentFrame();
  const words = rest.split(" ");
  return (
    <h1
      style={{
        fontFamily,
        fontSize: size,
        lineHeight: 1.06,
        letterSpacing: "-0.02em",
        fontWeight: 800,
        color,
        margin: 0,
        maxWidth: 900,
      }}
    >
      <span style={{ color: accent }}>{persona} </span>
      {words.map((w, i) => {
        const delay = 8 + i * 3;
        const o = animate
          ? interpolate(frame, [delay, delay + 10], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          : 1;
        const y = animate
          ? interpolate(frame, [delay, delay + 10], [22, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          : 0;
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: o,
              transform: `translateY(${y}px)`,
              // espaco entre palavras: inline-block engole o " " no fim do span
              marginRight: i < words.length - 1 ? "0.24em" : 0,
            }}
          >
            {w}
          </span>
        );
      })}
    </h1>
  );
};

const Subhead: React.FC<{ runs: SubRun[]; size: number; theme: CreativeTheme; fontFamily: string }> = ({
  runs,
  size,
  theme,
  fontFamily,
}) => (
  <p
    style={{
      fontFamily,
      fontSize: size,
      lineHeight: 1.4,
      color: theme.grey,
      margin: "32px 0 0",
      fontWeight: 400,
      maxWidth: 860,
    }}
  >
    {runs.map((r, i) => (
      <span
        key={i}
        style={{
          color: r.teal ? theme.accent : r.bold ? theme.ink : theme.grey,
          fontWeight: r.bold || r.teal ? 700 : 400,
        }}
      >
        {r.t}
      </span>
    ))}
  </p>
);

const Cta: React.FC<{
  text: string;
  font: number;
  padV: number;
  theme: CreativeTheme;
  fontFamily: string;
  pulse?: boolean;
}> = ({ text, font, padV, theme, fontFamily, pulse }) => {
  const frame = useCurrentFrame();
  const s = pulse ? 1 + 0.02 * Math.sin(frame / 7) : 1;
  const arrowY = pulse ? 4 * Math.sin(frame / 6) : 0;
  const circle = padV * 2 + font;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 22,
        marginTop: 46,
        transform: `scale(${s})`,
        transformOrigin: "left center",
      }}
    >
      <div
        style={{
          background: `linear-gradient(100deg, ${theme.accent} 0%, ${theme.accentDark} 100%)`,
          borderRadius: 999,
          padding: `${padV}px 46px`,
          fontFamily,
          fontSize: font,
          fontWeight: 700,
          color: "#fff",
          boxShadow: `0 18px 40px ${theme.accent}59`,
        }}
      >
        {text}
      </div>
      <div
        style={{
          width: circle,
          height: circle,
          borderRadius: "50%",
          background: `linear-gradient(100deg, ${theme.accent} 0%, ${theme.accentDark} 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 12px 28px ${theme.accent}4d`,
        }}
      >
        <svg
          width={circle * 0.42}
          height={circle * 0.42}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: `translateY(${arrowY}px)` }}
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <polyline points="6 13 12 19 18 13" />
        </svg>
      </div>
    </div>
  );
};

// Balao de audio WhatsApp: avatar (logo icon), play, waveform, "0:28 ✓✓".
const AudioBubble: React.FC<{
  width: number;
  iconSrc: string;
  theme: CreativeTheme;
  fontFamily: string;
  animate?: boolean;
  style?: React.CSSProperties;
}> = ({ width, iconSrc, theme, fontFamily, animate, style }) => {
  const frame = useCurrentFrame();
  const bars = 34;
  return (
    <div
      style={{
        width,
        background: theme.bubble,
        borderRadius: 30,
        padding: "18px 22px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
        ...style,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        <Img src={staticFile(iconSrc)} style={{ width: 40, height: 40, objectFit: "contain" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 2, flex: 1, height: 44 }}>
        <svg width={26} height={26} viewBox="0 0 24 24" fill={theme.accent} style={{ flexShrink: 0, marginRight: 8 }}>
          <polygon points="6,4 20,12 6,20" />
        </svg>
        {Array.from({ length: bars }).map((_, i) => {
          const base = 8 + ((i * 7) % 24);
          const h = animate ? base * (0.6 + 0.4 * Math.abs(Math.sin(frame / 6 + i))) : base;
          return (
            <span
              key={i}
              style={{
                width: 3.5,
                height: h,
                borderRadius: 3,
                background: i < bars * 0.55 ? theme.accent : "#9fbcae",
                display: "inline-block",
              }}
            />
          );
        })}
      </div>
      <span style={{ fontFamily, fontSize: 22, fontWeight: 600, color: theme.grey, whiteSpace: "nowrap" }}>
        0:28
      </span>
      <span style={{ color: theme.accent, fontSize: 22, fontWeight: 700 }}>✓✓</span>
    </div>
  );
};

// Foto real do worker, bleed bottom-right, com fades pra esconder residuo.
const WorkerPhoto: React.FC<{
  format: StaticCreativeFormat;
  src: string;
  theme: CreativeTheme;
  slide?: boolean;
  clean?: boolean;
}> = ({ format, src, theme, slide, clean }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const w = format === "feed" ? 560 : 640;
  const h = w * (840 / 540);
  const enter = slide ? spring({ frame, fps, config: { damping: 200 } }) : 1;
  const tx = interpolate(enter, [0, 1], [120, 0]);
  const fadeW = clean ? w * 0.26 : w * 0.42;
  const fadeMid = clean ? "18%" : "42%";
  return (
    <div
      style={{
        position: "absolute",
        right: 0,
        bottom: 0,
        width: w,
        height: h,
        transform: `translateX(${tx}px)`,
      }}
    >
      <Img src={staticFile(src)} style={{ width: w, height: h, objectFit: "cover" }} />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: fadeW,
          height: h * 0.68,
          background: `linear-gradient(100deg, ${theme.bg} 0%, ${theme.bg} ${fadeMid}, transparent 100%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          right: 0,
          height: 130,
          background: `linear-gradient(to bottom, ${theme.bg} 0%, transparent 100%)`,
        }}
      />
    </div>
  );
};

// Banda foto real (mockup do app).
const AppMockupBand: React.FC<{ src: string; theme: CreativeTheme }> = ({ src, theme }) => (
  <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 470 }}>
    <div
      style={{
        position: "absolute",
        top: -1,
        left: 0,
        right: 0,
        height: 90,
        background: `linear-gradient(to bottom, ${theme.bg} 0%, transparent 100%)`,
        zIndex: 2,
      }}
    />
    <Img src={staticFile(src)} style={{ width: 1080, height: 470, objectFit: "cover" }} />
  </div>
);

const TextBlock: React.FC<{ p: StaticCreativeProps; fontFamily: string; animate?: boolean }> = ({
  p,
  fontFamily,
  animate,
}) => {
  const s = scale(p.format);
  return (
    <div style={{ position: "absolute", top: s.padTop + s.logoH + 60, left: s.padSide, right: s.padSide }}>
      <Headline
        persona={p.persona}
        rest={p.headline}
        size={s.hSize}
        color={p.theme.ink}
        accent={p.theme.accent}
        fontFamily={fontFamily}
        animate={animate}
      />
      <Subhead runs={p.subhead} size={s.subSize} theme={p.theme} fontFamily={fontFamily} />
      <Cta text={p.cta} font={s.ctaFont} padV={s.ctaPadV} theme={p.theme} fontFamily={fontFamily} pulse={animate} />
    </div>
  );
};

// -------------------------- STATICOS (still) --------------------------------
export const StaticCreative: React.FC<StaticCreativeProps> = (p) => {
  const { height } = useVideoConfig();
  const s = scale(p.format);
  const fontFamily = p.theme.fontFamily || DEFAULT_FONT;
  const workerSrc = p.workerSrc || p.assets.workerPhoto;
  const mockupSrc = p.assets.appMockup;
  return (
    <AbsoluteFill style={{ backgroundColor: p.theme.bg }}>
      <BuildingWatermark height={height} color={p.theme.watermark} />
      <Logo src={p.assets.logo} h={s.logoH} padTop={s.padTop} padSide={s.padSide} />
      {p.variant === "worker" && workerSrc ? (
        <WorkerPhoto format={p.format} src={workerSrc} theme={p.theme} clean={p.cleanPhoto} />
      ) : mockupSrc ? (
        <AppMockupBand src={mockupSrc} theme={p.theme} />
      ) : null}
      <TextBlock p={p} fontFamily={fontFamily} />
      {p.variant === "worker" ? (
        <AudioBubble
          width={p.format === "feed" ? 540 : 600}
          iconSrc={p.assets.logoIcon}
          theme={p.theme}
          fontFamily={fontFamily}
          style={{ position: "absolute", left: s.padSide, bottom: p.format === "feed" ? 150 : 240 }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

export const StaticCreativeStory: React.FC<Omit<StaticCreativeProps, "format">> = (p) => (
  <StaticCreative {...p} format="story" />
);
export const StaticCreativeFeed: React.FC<Omit<StaticCreativeProps, "format">> = (p) => (
  <StaticCreative {...p} format="feed" />
);

// -------------------------- REEL (cinetico) ---------------------------------
export type StaticCreativeReelProps = Omit<StaticCreativeProps, "format" | "variant"> & {
  captions: string[]; // legendas queimadas que trocam ao longo do reel
};

const KineticCaption: React.FC<{ captions: string[]; theme: CreativeTheme; fontFamily: string }> = ({
  captions,
  theme,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const per = durationInFrames / captions.length;
  const idx = Math.min(captions.length - 1, Math.floor(frame / per));
  const local = frame - idx * per;
  const o = interpolate(local, [0, 10, per - 10, per], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: 84,
        right: 84,
        bottom: 130,
        textAlign: "center",
        fontFamily,
        fontSize: 46,
        fontWeight: 700,
        color: theme.ink,
        opacity: o,
        background: "rgba(255,255,255,0.72)",
        borderRadius: 22,
        padding: "18px 26px",
      }}
    >
      {captions[idx]}
    </div>
  );
};

export const StaticCreativeReel: React.FC<StaticCreativeReelProps> = (p) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const fontFamily = p.theme.fontFamily || DEFAULT_FONT;
  const workerSrc = p.workerSrc || p.assets.workerPhoto || "";
  const logoO = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const subO = interpolate(frame, [30, 45], [0, 1], { extrapolateRight: "clamp" });
  const bubbleO = interpolate(frame, [55, 70], [0, 1], { extrapolateRight: "clamp" });
  const s = scale("story");
  return (
    <AbsoluteFill style={{ backgroundColor: p.theme.bg }}>
      <BuildingWatermark height={height} color={p.theme.watermark} />
      <WorkerPhoto format="story" src={workerSrc} theme={p.theme} slide clean={p.cleanPhoto} />
      <div style={{ opacity: logoO }}>
        <Logo src={p.assets.logo} h={s.logoH} padTop={s.padTop} padSide={s.padSide} />
      </div>
      <div style={{ position: "absolute", top: s.padTop + s.logoH + 60, left: s.padSide, right: s.padSide }}>
        <Headline
          persona={p.persona}
          rest={p.headline}
          size={s.hSize}
          color={p.theme.ink}
          accent={p.theme.accent}
          fontFamily={fontFamily}
          animate
        />
        <div style={{ opacity: subO }}>
          <Subhead runs={p.subhead} size={s.subSize} theme={p.theme} fontFamily={fontFamily} />
          <Cta text={p.cta} font={s.ctaFont} padV={s.ctaPadV} theme={p.theme} fontFamily={fontFamily} pulse />
        </div>
      </div>
      <div style={{ opacity: bubbleO }}>
        <AudioBubble
          width={600}
          iconSrc={p.assets.logoIcon}
          theme={p.theme}
          fontFamily={fontFamily}
          animate
          style={{ position: "absolute", left: s.padSide, bottom: 360 }}
        />
      </div>
      <KineticCaption captions={p.captions} theme={p.theme} fontFamily={fontFamily} />
    </AbsoluteFill>
  );
};
