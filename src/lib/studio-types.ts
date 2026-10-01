// ============================================
// Video Studio - TypeScript Types
// ============================================

export type TrackType = 'video' | 'audio' | 'text' | 'caption'

export type CaptionStyle = 'bounce' | 'typewriter' | 'highlight' | 'karaoke'

export type TextAnimation = 'none' | 'fade-in' | 'slide-up' | 'scale-in'

export type VideoFormat = '16:9' | '9:16' | '1:1'

export type VideoQuality = '720p' | '1080p' | '4K'

export type ProjectStatus = 'draft' | 'rendering' | 'rendered' | 'error'

export interface TrackSegment {
  id: string
  startFrame: number
  durationFrames: number
  // Video/Audio
  mediaUrl?: string
  mediaId?: string
  mediaName?: string
  // Text
  text?: string
  x?: number
  y?: number
  fontSize?: number
  color?: string
  fontWeight?: number
  animation?: TextAnimation
  // Caption
  srt?: string
  captionStyle?: CaptionStyle
}

export interface Track {
  id: string
  type: TrackType
  name: string
  segments: TrackSegment[]
  muted?: boolean
  visible?: boolean
}

export interface VideoProjectData {
  tracks: Track[]
  format: VideoFormat
  quality: VideoQuality
  fps: number
  width: number
  height: number
  durationFrames: number
}

export interface VideoProject {
  id: string
  name: string
  status: ProjectStatus
  composition_data: VideoProjectData
  duration_seconds: number
  fps: number
  width: number
  height: number
  source_media_ids: string[]
  caption_srt: string | null
  caption_style: CaptionStyle | null
  output_url: string | null
  output_formats: string[]
  render_id: string | null
  render_progress: number | null
  client_slug: string
  created_at: string
  updated_at: string
}

export interface SrtEntry {
  index: number
  startMs: number
  endMs: number
  text: string
}

export function parseSrt(srt: string): SrtEntry[] {
  if (!srt.trim()) return []

  const blocks = srt.trim().split(/\n\s*\n/)
  const entries: SrtEntry[] = []

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length < 3) continue

    const index = parseInt(lines[0], 10)
    if (isNaN(index)) continue

    const timeMatch = lines[1].match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
    )
    if (!timeMatch) continue

    const startMs =
      parseInt(timeMatch[1]) * 3600000 +
      parseInt(timeMatch[2]) * 60000 +
      parseInt(timeMatch[3]) * 1000 +
      parseInt(timeMatch[4])

    const endMs =
      parseInt(timeMatch[5]) * 3600000 +
      parseInt(timeMatch[6]) * 60000 +
      parseInt(timeMatch[7]) * 1000 +
      parseInt(timeMatch[8])

    const text = lines.slice(2).join('\n')

    entries.push({ index, startMs, endMs, text })
  }

  return entries
}

export function msToFrame(ms: number, fps: number): number {
  return Math.round((ms / 1000) * fps)
}

export function frameToMs(frame: number, fps: number): number {
  return Math.round((frame / fps) * 1000)
}

export function frameToTimecode(frame: number, fps: number): string {
  const totalSeconds = frame / fps
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const frames = Math.floor(frame % fps)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(frames).padStart(2, '0')}`
}

export function getFormatDimensions(format: VideoFormat): { width: number; height: number } {
  switch (format) {
    case '16:9':
      return { width: 1920, height: 1080 }
    case '9:16':
      return { width: 1080, height: 1920 }
    case '1:1':
      return { width: 1080, height: 1080 }
  }
}

export function createDefaultProject(name: string, clientSlug: string): Omit<VideoProject, 'id' | 'created_at' | 'updated_at'> {
  const format: VideoFormat = '9:16'
  const { width, height } = getFormatDimensions(format)
  const fps = 30
  const durationFrames = fps * 30 // 30 seconds default

  return {
    name,
    status: 'draft',
    composition_data: {
      tracks: [],
      format,
      quality: '1080p',
      fps,
      width,
      height,
      durationFrames,
    },
    duration_seconds: 30,
    fps,
    width,
    height,
    source_media_ids: [],
    caption_srt: null,
    caption_style: null,
    output_url: null,
    output_formats: [],
    render_id: null,
    render_progress: null,
    client_slug: clientSlug,
  }
}
