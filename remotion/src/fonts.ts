import { useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";
import { getAvailableFonts } from "@remotion/google-fonts";

// Carrega as fontes da marca (campo fontDisplay/fontBody do tema) do Google Fonts e segura o
// render ate ficarem prontas. Fonte que nao e do Google Fonts (arquivo proprio da marca) nao
// carrega aqui: veja a regra local-fonts da skill oficial remotion-best-practices (npx skills add remotion-dev/skills). Nesse caso
// o texto cai na fonte reserva (Inter).
export const useBrandFonts = (names: string[]): void => {
  const [handle] = useState(() => delayRender("fontes da marca"));
  useEffect(() => {
    const all = getAvailableFonts();
    Promise.all(
      Array.from(new Set(names.concat("Inter"))).map(async (name) => {
        const found = all.find((f) => f.fontFamily.toLowerCase() === name.toLowerCase());
        if (!found) {
          console.warn(`[fonts] "${name}" nao esta no Google Fonts: usando a reserva.`);
          return;
        }
        const mod = await found.load();
        // opcoes tipadas por fonte: aqui so pedimos pesos e subconjunto comuns
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (mod as any)
          .loadFont("normal", { weights: ["400", "600", "700", "800"], subsets: ["latin"], ignoreTooManyRequestsWarning: true })
          .waitUntilDone();
      })
    )
      .catch((e) => console.warn("[fonts] falha ao carregar fonte:", e))
      .finally(() => continueRender(handle));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
