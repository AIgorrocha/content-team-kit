import { Canvas as FabricCanvas } from "fabric"
import JSZip from "jszip"
import { saveAs } from "file-saver"
import type { SlideData } from "@/stores/carousel-store"

export async function exportCarouselAsZip(
  slides: readonly SlideData[],
  projectName: string,
  width: number,
  height: number
): Promise<void> {
  const container = document.createElement("div")
  container.style.position = "absolute"
  container.style.left = "-9999px"
  document.body.appendChild(container)

  const canvasEl = document.createElement("canvas")
  container.appendChild(canvasEl)

  const offscreen = new FabricCanvas(canvasEl, { width, height })
  const zip = new JSZip()

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]
    offscreen.set("backgroundColor", slide.backgroundColor)

    const json = slide.fabricJSON as { objects?: unknown[] }
    if (json.objects && json.objects.length > 0) {
      await offscreen.loadFromJSON(slide.fabricJSON)
    } else {
      offscreen.clear()
      offscreen.set("backgroundColor", slide.backgroundColor)
    }

    offscreen.renderAll()

    const dataUrl = offscreen.toDataURL({ format: "png", multiplier: 1 })
    const base64 = dataUrl.split(",")[1]
    const fileName = `slide-${String(i + 1).padStart(2, "0")}.png`
    zip.file(fileName, base64, { base64: true })
  }

  offscreen.dispose()
  document.body.removeChild(container)

  const blob = await zip.generateAsync({ type: "blob" })
  const safeName = projectName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
  saveAs(blob, `carousel-${safeName}.zip`)
}
