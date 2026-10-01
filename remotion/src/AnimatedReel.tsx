import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { getTheme, Theme } from "./themes";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});

// ----------------------------------------------------------------------------
// Reel animado white-label, alinhado ao TEMPLATE OFICIAL do cliente.
// Header (foto+nome+check+handle) e cores vem do tema por slug (ver themes.ts).
// Animacao frame-a-frame (regra remotion-best-practices). Sem CSS transition.
// Safe area Reel 9:16: topo 160 (UI IG), laterais 80, base 240 (legenda+botoes).
// ----------------------------------------------------------------------------

export type Scene = {
  title: string;
  subtitle?: string;
  durationInFrames: number;
};

export type AnimatedReelProps = {
  themeSlug: string;
  scenes: Scene[];
  showHandle: boolean;
};

export const animatedReelSchema = {
  // "exemplo" = tema neutro de reserva. Tema da marca: node scripts/video/emit-theme.mjs {slug}.
  themeSlug: "exemplo",
  showHandle: true,
  scenes: [
    { title: "Cena 1", subtitle: "Legenda da cena", durationInFrames: 90 },
  ],
} as AnimatedReelProps;

const SAFE_TOP = 160;
const SAFE_SIDE = 80;
const SAFE_BOTTOM = 240;

// Header igual ao carrossel: avatar 110px + nome 36/590 + check azul + handle 26/400.
const Header: React.FC<{ theme: Theme }> = ({ theme }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        top: SAFE_TOP,
        left: SAFE_SIDE,
        display: "flex",
        alignItems: "center",
        gap: 24,
        opacity,
      }}
    >
      {theme.photo ? (
        <Img
          src={staticFile(theme.photo)}
          style={{
            width: 110,
            height: 110,
            borderRadius: "50%",
            border: "2px solid rgba(255,255,255,0.08)",
            objectFit: "cover",
          }}
        />
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {theme.name ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontFamily,
              fontSize: 36,
              fontWeight: 600,
              color: theme.textPrimary,
            }}
          >
            {theme.name}
            {theme.check ? (
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  backgroundColor: theme.accent,
                  color: "#fff",
                  fontSize: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✓
              </span>
            ) : null}
          </div>
        ) : null}
        <div
          style={{
            fontFamily,
            fontSize: 26,
            fontWeight: 400,
            color: theme.textMeta,
          }}
        >
          {theme.handle}
        </div>
      </div>
    </div>
  );
};

const SceneCard: React.FC<{ scene: Scene; theme: Theme }> = ({
  scene,
  theme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 200 } });
  const y = interpolate(enter, [0, 1], [40, 0]);
  const opacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });
  const barWidth = interpolate(enter, [0, 1], [0, 200]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        justifyContent: "center",
        alignItems: "flex-start",
        padding: `${SAFE_TOP}px ${SAFE_SIDE}px ${SAFE_BOTTOM}px`,
      }}
    >
      <div style={{ transform: `translateY(${y}px)`, opacity, maxWidth: 920 }}>
        <div
          style={{
            width: barWidth,
            height: 6,
            backgroundColor: theme.accent,
            borderRadius: 3,
            marginBottom: 36,
          }}
        />
        <h1
          style={{
            fontFamily,
            fontSize: 88,
            lineHeight: 1.04,
            letterSpacing: "-0.028em",
            color: theme.textPrimary,
            margin: 0,
            fontWeight: 700,
          }}
        >
          {scene.title}
        </h1>
        {scene.subtitle ? (
          <p
            style={{
              fontFamily,
              fontSize: 40,
              lineHeight: 1.45,
              color: theme.textSecondary,
              marginTop: 32,
              fontWeight: 500,
            }}
          >
            {scene.subtitle}
          </p>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

export const AnimatedReel: React.FC<AnimatedReelProps> = ({
  themeSlug,
  scenes,
  showHandle,
}) => {
  const theme = getTheme(themeSlug);
  let from = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg }}>
      {scenes.map((scene, i) => {
        const seq = (
          <Sequence
            key={i}
            from={from}
            durationInFrames={scene.durationInFrames}
          >
            <SceneCard scene={scene} theme={theme} />
            {showHandle ? <Header theme={theme} /> : null}
          </Sequence>
        );
        from += scene.durationInFrames;
        return seq;
      })}
    </AbsoluteFill>
  );
};
