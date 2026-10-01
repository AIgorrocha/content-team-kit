import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// Opcional: use um navegador já instalado. Sem isso, Remotion gerencia o navegador.
if (process.env.BROWSER_EXECUTABLE) Config.setBrowserExecutable(process.env.BROWSER_EXECUTABLE);
