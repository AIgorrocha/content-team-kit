import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { z } from "zod";
import { getTheme } from "./themes";
import { isUrl, withAlpha } from "./color";
import { useBrandFonts } from "./fonts";

// ---------------------------------------------------------------------------
// ReelCover: capa de reel (imagem unica 1080x1920) na identidade da marca.
//   npx remotion still ReelCover ../output/capa.jpg --props='{"themeSlug":"{slug}","image":"capa-foto.jpg","headline":["TITULO EM","DUAS LINHAS"],"highlight":"DESTAQUE"}'
// Regras (references/aprendizados-de-producao.md, secao 5): a foto preenche o quadro; o texto
// NUNCA cobre rosto, olho ou boca (use imageShiftY/scrim para abrir espaco); reservar o canto
// superior esquerdo para o selo de visualizacoes da grade; titulo sempre no mesmo tamanho da marca.
// Entregar em JPEG (a API de publicacao pode recusar PNG na capa).
// ---------------------------------------------------------------------------

export const reelCoverSchema = z.object({
  themeSlug: z.string().default("exemplo"),
  image: z.string().nullable().default(null), // foto/frame em remotion/public/ (ou URL); vazio = so cor da marca
  eyebrow: z.string().default(""), // linha pequena acima do titulo (ex: nome da serie)
  headline: z.array(z.string()).default(["SEU TITULO", "AQUI"]), // linhas do titulo
  highlight: z.string().default(""), // ultima linha, na cor de destaque da marca
  footer: z.string().default(""), // frase de apoio no rodape
  handle: z.string().default(""), // @perfil
  fontSize: z.number().default(132), // tamanho fixo do titulo da marca
  imageShiftY: z.number().default(0), // desloca a foto (px) para tirar o rosto da zona do texto
  scrimTop: z.number().default(0.82), // 0..1, escurece o topo (contraste do titulo)
  scrimBottom: z.number().default(0.9), // 0..1, escurece o rodape (opaco cobre legenda queimada antiga)
  textTop: z.number().default(150), // posicao do bloco do titulo (px do topo)
});

export type ReelCoverProps = z.input<typeof reelCoverSchema>;

export const ReelCover: React.FC<ReelCoverProps> = (raw) => {
  const p = reelCoverSchema.parse(raw);
  const theme = getTheme(p.themeSlug);
  useBrandFonts([theme.fontDisplay, theme.fontBody]);
  const display = `${theme.fontDisplay}, Inter, sans-serif`;
  const body = `${theme.fontBody}, Inter, sans-serif`;
  const bg = theme.bg;
  return (
    <AbsoluteFill style={{ backgroundColor: bg }}>
      {p.image ? (
        <Img
          src={isUrl(p.image) ? p.image : staticFile(p.image)}
          style={{ width: "100%", height: "100%", objectFit: "cover", transform: `translateY(${p.imageShiftY}px)` }}
        />
      ) : null}
      {/* veu para contraste do texto */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${withAlpha(bg, p.scrimTop)} 0%, ${withAlpha(bg, 0.15)} 34%, ${withAlpha(bg, 0.25)} 62%, ${withAlpha(bg, p.scrimBottom)} 100%)`,
        }}
      />
      <div style={{ position: "absolute", top: p.textTop, left: 150, right: 150, textAlign: "center" }}>
        {p.eyebrow ? (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 14, marginBottom: 26 }}>
            <div style={{ width: 60, height: 6, background: theme.accent, borderRadius: 3 }} />
            <span style={{ fontFamily: body, fontSize: 28, fontWeight: 700, letterSpacing: "0.2em", color: theme.accent, textTransform: "uppercase" }}>
              {p.eyebrow}
            </span>
            <div style={{ width: 60, height: 6, background: theme.accent, borderRadius: 3 }} />
          </div>
        ) : null}
        <h1
          style={{
            fontFamily: display,
            fontSize: p.fontSize,
            lineHeight: 0.98,
            color: theme.textPrimary,
            margin: 0,
            textTransform: "uppercase",
            textShadow: "0 6px 26px rgba(0,0,0,0.8)",
          }}
        >
          {p.headline.map((l, i) => (
            <React.Fragment key={i}>
              {l}
              <br />
            </React.Fragment>
          ))}
          {p.highlight ? <span style={{ color: theme.accent }}>{p.highlight}</span> : null}
        </h1>
      </div>
      {p.footer || p.handle ? (
        <div style={{ position: "absolute", bottom: 150, left: 0, width: 1080, textAlign: "center" }}>
          {p.footer ? (
            <div style={{ fontFamily: body, fontSize: 40, fontWeight: 700, color: theme.textPrimary, textShadow: "0 3px 14px rgba(0,0,0,0.8)" }}>
              {p.footer}
            </div>
          ) : null}
          {p.handle ? (
            <div style={{ fontFamily: body, fontSize: 30, fontWeight: 600, color: theme.accent, marginTop: 16 }}>{p.handle}</div>
          ) : null}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
