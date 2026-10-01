import React from 'react'
import {
  AbsoluteFill,
  OffthreadVideo,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'

export interface CaptionEntry {
  index: number
  startMs: number
  endMs: number
  text: string
}

export interface SimpleCaptionProps {
  videoUrl: string
  entries: CaptionEntry[]
  captionColor: 'white' | 'yellow'
  fontSize: number
}

function msToFrame(ms: number, fps: number): number {
  return Math.round((ms / 1000) * fps)
}

/**
 * Simple caption overlay for Remotion rendering.
 * White or yellow text with strong shadow, no animation.
 * Appears and disappears with the speech.
 */
export const SimpleCaption: React.FC<Record<string, unknown>> = (props) => {
  const videoUrl = (props.videoUrl ?? '') as string
  const entries = (props.entries ?? []) as CaptionEntry[]
  const captionColor = (props.captionColor ?? 'white') as 'white' | 'yellow'
  const fontSize = (props.fontSize ?? 48) as number

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const currentEntry = entries.find((entry) => {
    const startFrame = msToFrame(entry.startMs, fps)
    const endFrame = msToFrame(entry.endMs, fps)
    return frame >= startFrame && frame <= endFrame
  })

  const color = captionColor === 'yellow' ? '#FFD700' : '#FFFFFF'

  return (
    <AbsoluteFill>
      <AbsoluteFill>
        <OffthreadVideo src={videoUrl} />
      </AbsoluteFill>

      {currentEntry && (
        <AbsoluteFill>
          <div
            style={{
              position: 'absolute',
              bottom: 120,
              left: 40,
              right: 40,
              textAlign: 'center',
              fontSize,
              fontWeight: 700,
              fontFamily: "'Inter', sans-serif",
              color,
              textShadow:
                '0 2px 8px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.7), 0 4px 16px rgba(0,0,0,0.5)',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              padding: '8px 20px',
              borderRadius: 8,
              lineHeight: 1.4,
              display: 'inline-block',
              margin: '0 auto',
            }}
          >
            {currentEntry.text}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  )
}
