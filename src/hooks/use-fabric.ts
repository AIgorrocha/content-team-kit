"use client"

import { useEffect, useRef, useCallback } from "react"
import { Canvas as FabricCanvas, FabricText, FabricImage, FabricObject } from "fabric"
import { useCarouselStore, type SlideData } from "@/stores/carousel-store"

export function useFabric(containerRef: React.RefObject<HTMLDivElement | null>) {
  const canvasRef = useRef<FabricCanvas | null>(null)
  const isLoadingRef = useRef(false)

  const {
    slides,
    activeSlideIndex,
    canvasWidth,
    canvasHeight,
    updateSlideJSON,
    updateSlideThumbnail,
  } = useCarouselStore()

  const activeSlide = slides[activeSlideIndex] as SlideData | undefined

  // Initialize canvas
  useEffect(() => {
    if (!containerRef.current || canvasRef.current) return

    const canvasEl = document.createElement("canvas")
    canvasEl.id = "carousel-canvas"
    containerRef.current.appendChild(canvasEl)

    // Figma-like selection defaults
    FabricObject.ownDefaults = {
      ...FabricObject.ownDefaults,
      borderColor: "#0078FF",
      borderScaleFactor: 1.5,
      cornerColor: "#ffffff",
      cornerStrokeColor: "#0078FF",
      cornerSize: 8,
      cornerStyle: "rect" as const,
      transparentCorners: false,
      padding: 4,
    }

    const canvas = new FabricCanvas(canvasEl, {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: activeSlide?.backgroundColor ?? "#FFFFFF",
      selection: true,
      selectionColor: "rgba(0, 120, 255, 0.08)",
      selectionBorderColor: "#0078FF",
      selectionLineWidth: 1,
    })

    // Hover border (Figma-like)
    canvas.on("mouse:over", (e) => {
      if (!e.target || e.target === canvas.getActiveObject()) return
      (e.target as FabricObject).set({ stroke: "#7B61FF", strokeWidth: 1.5 })
      canvas.renderAll()
    })
    canvas.on("mouse:out", (e) => {
      if (!e.target || e.target === canvas.getActiveObject()) return
      (e.target as FabricObject).set({ stroke: undefined, strokeWidth: 0 })
      canvas.renderAll()
    })

    // Scale canvas to fit container
    const containerW = containerRef.current.clientWidth
    const containerH = containerRef.current.clientHeight
    const scale = Math.min(containerW / canvasWidth, containerH / canvasHeight, 1)
    canvas.setZoom(scale)
    canvas.setDimensions({ width: canvasWidth * scale, height: canvasHeight * scale })

    canvasRef.current = canvas

    return () => {
      canvas.dispose()
      canvasRef.current = null
    }
  }, [containerRef, canvasWidth, canvasHeight])

  // Load active slide
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !activeSlide || isLoadingRef.current) return

    isLoadingRef.current = true
    canvas.set("backgroundColor", activeSlide.backgroundColor)

    const json = activeSlide.fabricJSON as { objects?: unknown[] }
    if (json.objects && json.objects.length > 0) {
      canvas.loadFromJSON(activeSlide.fabricJSON).then(() => {
        canvas.renderAll()
        isLoadingRef.current = false
      })
    } else {
      canvas.clear()
      canvas.set("backgroundColor", activeSlide.backgroundColor)
      canvas.renderAll()
      isLoadingRef.current = false
    }
  }, [activeSlideIndex, activeSlide?.id])

  // Save on modification
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function handleModified() {
      if (isLoadingRef.current) return
      const json = canvas!.toJSON()
      updateSlideJSON(activeSlideIndex, json)

      const thumb = canvas!.toDataURL({ multiplier: 0.1, format: "png" })
      updateSlideThumbnail(activeSlideIndex, thumb)
    }

    canvas.on("object:modified", handleModified)
    canvas.on("object:added", handleModified)
    canvas.on("object:removed", handleModified)

    return () => {
      canvas.off("object:modified", handleModified)
      canvas.off("object:added", handleModified)
      canvas.off("object:removed", handleModified)
    }
  }, [activeSlideIndex, updateSlideJSON, updateSlideThumbnail])

  const addText = useCallback((text: string, options?: { fontSize?: number; fontWeight?: string; fontFamily?: string; fill?: string }) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const textObj = new FabricText(text, {
      left: 65,
      top: 200,
      fontSize: options?.fontSize ?? 48,
      fontWeight: options?.fontWeight ?? "normal",
      fontFamily: options?.fontFamily ?? "Inter",
      fill: options?.fill ?? "#000000",
      width: canvasWidth - 130,
      textAlign: "left",
    })

    canvas.add(textObj)
    canvas.setActiveObject(textObj)
    canvas.renderAll()
  }, [canvasWidth])

  const deleteSelected = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (active) {
      canvas.remove(active)
      canvas.renderAll()
    }
  }, [])

  const updateBackground = useCallback((color: string) => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.set("backgroundColor", color)
    canvas.renderAll()
    useCarouselStore.getState().updateSlideBackground(activeSlideIndex, color)
  }, [activeSlideIndex])

  const addImage = useCallback((dataUrl: string) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const imgEl = new Image()
    imgEl.onload = () => {
      const fabricImg = new FabricImage(imgEl, {
        left: 65,
        top: 200,
      })
      const maxW = canvasWidth - 130
      if (fabricImg.width && fabricImg.width > maxW) {
        fabricImg.scaleToWidth(maxW)
      }
      canvas.add(fabricImg)
      canvas.setActiveObject(fabricImg)
      canvas.renderAll()
    }
    imgEl.src = dataUrl
  }, [canvasWidth])

  return {
    canvasRef: canvasRef as React.MutableRefObject<FabricCanvas | null>,
    addText,
    addImage,
    deleteSelected,
    updateBackground,
  }
}
