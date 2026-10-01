import React from "react";
import { Composition } from "remotion";
import { AnimatedReel, animatedReelSchema } from "./AnimatedReel";
import { CapCutSplit, capCutSplitSchema } from "./CapCutSplit";
import { CapCutSplitAlt, capCutSplitAltSchema } from "./CapCutSplitAlt";
import { NarratedReel, narratedReelSchema, narratedReelFrames } from "./NarratedReel";
import { ReelCover, reelCoverSchema } from "./ReelCover";
import { StoryScenes, storyScenesSchema, storyScenesFrames } from "./StoryScenes";
import { BlurFillVideo, blurFillVideoSchema } from "./BlurFillVideo";
import { DrawOn, drawOnSchema } from "./DrawOn";
import { KenBurnsTest, kenBurnsSchema, KEN_BURNS_FRAMES } from "./KenBurnsTest";
import { StaticCreativeStory, StaticCreativeFeed, StaticCreativeReel } from "./StaticCreative";

// Props default de exemplo pra StaticCreative* (fabrica de criativo generica,
// skill ct-criativos-lote). Cliente real passa tema/assets/copy via --props.
const staticCreativeDefaultProps = {
  theme: {
    bg: "#f4f6f8",
    ink: "#1a1a1a",
    grey: "#555555",
    accent: "#0066ff",
    accentDark: "#0050cc",
    bubble: "#dcf8c6",
    watermark: "#e9edf1",
  },
  assets: {
    logo: "placeholder/logo-full.png",
    logoIcon: "placeholder/logo-icon.png",
    workerPhoto: "placeholder/worker.png",
    appMockup: "placeholder/appmockup.png",
  },
  persona: "Cliente,",
  headline: "exemplo de headline do criativo.",
  subhead: [{ t: "Texto de exemplo do subhead." }],
  cta: "Call to action",
  variant: "worker" as const,
  cleanPhoto: false,
};

// Exemplo de StoryScenes: imagens neutras geradas por remotion/scripts/make-placeholders.mjs
// (roda sozinho antes de studio/render/still). Troque por midia real da marca via --props.
const storyScenesDefault = storyScenesSchema.parse({
  scenes: [
    { kind: "image", src: "placeholder/cena.png", text: "Cena de exemplo", durationInFrames: 90 },
    {
      kind: "infographic",
      src: "placeholder/cena.png",
      text: "Numero de exemplo",
      durationInFrames: 120,
      hero: { value: 100, label: "EXEMPLO", suffix: "%" },
    },
  ],
  endCard: { text: "Fecho de exemplo", logo: null },
});

// Duracao total = soma das cenas. Pra metadata dinamica, o ct-video-remotion
// pode calcular via calculateMetadata; aqui usamos um default seguro.
const defaultScenes = animatedReelSchema.scenes;
const totalFrames = defaultScenes.reduce(
  (acc, s) => acc + s.durationInFrames,
  0
);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Reel vertical 9:16 1080x1920, 30fps. Tema via props. */}
      <Composition
        id="AnimatedReel"
        component={AnimatedReel}
        durationInFrames={totalFrames}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={animatedReelSchema}
        calculateMetadata={({ props }) => {
          const frames = props.scenes.reduce(
            (acc, s) => acc + s.durationInFrames,
            0
          );
          return { durationInFrames: Math.max(frames, 1) };
        }}
      />
      {/* KenBurnsTest - teste T3 motion: pan/zoom por codigo sobre prancha 2D */}
      <Composition
        id="KenBurnsTest"
        component={KenBurnsTest}
        durationInFrames={KEN_BURNS_FRAMES}
        fps={30}
        width={1080}
        height={1920}
        schema={kenBurnsSchema}
        defaultProps={{
          src: "imagem-exemplo.png",
          bg: "#FFFFFF",
          panX: 1,
          panYStart: 0.32,
          zoomFrom: 1.55,
          zoomTo: 1.78,
        }}
      />
      {/* CapCutSplit - edicao "CapCut em codigo": pessoa falando + tela proposta
          + legenda palavra-a-palavra. Props vem do orquestrador run-editor.mjs.
          Duracao = ultima legenda + cauda, ou fallback 30s. */}
      <Composition
        id="CapCutSplit"
        component={CapCutSplit}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
        schema={capCutSplitSchema}
        defaultProps={{
          themeSlug: "exemplo",
          talkingSrc: "talking.mp4",
          screenSrc: null,
          screenImage: null,
          screenImageHeight: 0,
          audioSrc: null,
          captions: [],
          layout: [],
          // estilo da legenda: o run-editor.mjs preenche a partir do design-system da marca
          captionStyle: "phrase" as const,
          captionColor: "#FFFFFF",
          highlightColor: null,
          captionUppercase: true,
          captionBold: true,
          captionPosition: "bottom" as const,
        }}
        calculateMetadata={({ props }) => {
          const fps = 30;
          const lastMs = props.captions.length
            ? props.captions[props.captions.length - 1].endMs
            : 30000;
          // cauda curta pra nao passar do fim do video gravado (senao da frame preto)
          const frames = Math.round(((lastMs + 120) / 1000) * fps);
          return { durationInFrames: Math.max(frames, 30), fps };
        }}
      />
      {/* CapCutSplitAlt - split ALTERNADO: rosto maior que a tela, alterna cima/baixo por bloco
          (faceBottom), b-roll por bloco (imagem real), legenda acima do rosto quando ele esta
          embaixo. Layout por bloco vem do config do run-editor.mjs ("composition": "CapCutSplitAlt"). */}
      <Composition
        id="CapCutSplitAlt"
        component={CapCutSplitAlt}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
        schema={capCutSplitAltSchema}
        defaultProps={{
          themeSlug: "exemplo",
          talkingSrc: "talking.mp4",
          audioSrc: null,
          captions: [],
          layout: [],
          captionStyle: "phrase" as const,
          captionColor: "#FFFFFF",
          highlightColor: null,
          captionUppercase: true,
          captionBold: true,
        }}
        calculateMetadata={({ props }) => {
          const fps = 30;
          const lastMs = props.captions.length
            ? props.captions[props.captions.length - 1].endMs
            : 30000;
          return { durationInFrames: Math.max(Math.round(((lastMs + 120) / 1000) * fps), 30), fps };
        }}
      />
      {/* NarratedReel - reel narrado com a voz real: um visual por assunto + legenda frase a frase.
          Segmentos vem de scripts/video-editor/build-narrated-captions.mjs (skill ct-reel-narrado-higgsfield). */}
      <Composition
        id="NarratedReel"
        component={NarratedReel}
        durationInFrames={30}
        fps={30}
        width={1080}
        height={1920}
        schema={narratedReelSchema}
        defaultProps={{
          themeSlug: "exemplo",
          audioSrc: null,
          sfxSrc: null,
          segments: [],
          captionColor: "#FFFFFF",
          captionUppercase: true,
          footerText: "",
          crossfadeFrames: 8,
        }}
        calculateMetadata={({ props }) => ({ durationInFrames: narratedReelFrames(props) })}
      />
      {/* ReelCover - capa do reel (1 quadro 1080x1920). Uso: npx remotion still ReelCover capa.jpg --props=... */}
      <Composition
        id="ReelCover"
        component={ReelCover}
        durationInFrames={1}
        fps={30}
        width={1080}
        height={1920}
        schema={reelCoverSchema}
        defaultProps={reelCoverSchema.parse({})}
      />
      {/* StoryScenes - storytelling por cenas de texto grande sobre midia real (9:16 e 16:9, mesmas props) */}
      <Composition
        id="StoryScenes"
        component={StoryScenes}
        durationInFrames={120}
        fps={30}
        width={1080}
        height={1920}
        schema={storyScenesSchema}
        defaultProps={storyScenesDefault}
        calculateMetadata={({ props }) => ({ durationInFrames: storyScenesFrames(props) })}
      />
      <Composition
        id="StoryScenes16x9"
        component={StoryScenes}
        durationInFrames={120}
        fps={30}
        width={1920}
        height={1080}
        schema={storyScenesSchema}
        defaultProps={storyScenesDefault}
        calculateMetadata={({ props }) => ({ durationInFrames: storyScenesFrames(props) })}
      />
      {/* BlurFillVideo - video horizontal vira vertical (fundo desfocado + video contido) */}
      <Composition
        id="BlurFillVideo"
        component={BlurFillVideo}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        schema={blurFillVideoSchema}
        defaultProps={blurFillVideoSchema.parse({})}
        calculateMetadata={({ props }) => ({ durationInFrames: Math.max(Math.round((props.durationSec ?? 10) * 30), 1) })}
      />
      {/* DrawOn - tracos SVG que se desenham sozinhos (assinatura, fluxo, contorno) */}
      <Composition
        id="DrawOn"
        component={DrawOn}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
        schema={drawOnSchema}
        defaultProps={drawOnSchema.parse({})}
        calculateMetadata={({ props }) => ({ durationInFrames: props.durationInFrames ?? 150 })}
      />
      {/* StaticCreative* - fabrica de criativo estatico/reel generica white-label
          (skill ct-criativos-lote, dono ct-designer). Tema/assets/copy vem
          sempre via --props (JSON gerado por scripts/criativos/emit-props.mjs
          a partir de clients/{slug}/criativos/presets.json). */}
      <Composition
        id="StaticCreativeStory"
        component={StaticCreativeStory}
        durationInFrames={1}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={staticCreativeDefaultProps}
      />
      <Composition
        id="StaticCreativeFeed"
        component={StaticCreativeFeed}
        durationInFrames={1}
        fps={30}
        width={1080}
        height={1350}
        defaultProps={staticCreativeDefaultProps}
      />
      <Composition
        id="StaticCreativeReel"
        component={StaticCreativeReel}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          ...staticCreativeDefaultProps,
          captions: ["Legenda 1.", "Legenda 2.", "Legenda 3."],
        }}
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.max((props.captions?.length || 1) * 90, 90),
        })}
      />
    </>
  );
};
