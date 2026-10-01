import React from 'react'
import {
  AbsoluteFill,
  OffthreadVideo,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion'

export interface SplitSegment {
  startMs: number
  endMs: number
  text: string
  videoPosition: 'top' | 'bottom'
}

export interface SplitScreenProps {
  videoUrl: string
  segments: SplitSegment[]
  captionColor: 'white' | 'yellow'
  fontSize: number
}

function msToFrame(ms: number, fps: number): number {
  return Math.round((ms / 1000) * fps)
}

/**
 * Split screen composition:
 * - Video takes half the screen
 * - Contextual animation/text takes the other half
 * - Alternates: video top/animation bottom, then video bottom/animation top
 * - Simple captions overlaid (white/yellow with shadow)
 */
export const SplitScreen: React.FC<Record<string, unknown>> = (props) => {
  const videoUrl = (props.videoUrl ?? '') as string
  const segments = (props.segments ?? []) as SplitSegment[]
  const captionColor = (props.captionColor ?? 'white') as 'white' | 'yellow'
  const fontSize = (props.fontSize ?? 42) as number

  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()

  const halfHeight = height / 2
  const color = captionColor === 'yellow' ? '#FFD700' : '#FFFFFF'

  const currentSegment = segments.find((seg) => {
    const startFrame = msToFrame(seg.startMs, fps)
    const endFrame = msToFrame(seg.endMs, fps)
    return frame >= startFrame && frame <= endFrame
  })

  const videoOnTop = currentSegment?.videoPosition === 'top'

  // Animation for text appearing
  const textSpring = currentSegment
    ? spring({
        frame: frame - msToFrame(currentSegment.startMs, fps),
        fps,
        config: { damping: 15, stiffness: 120 },
      })
    : 0

  const textY = interpolate(textSpring, [0, 1], [30, 0])
  const textOpacity = interpolate(textSpring, [0, 1], [0, 1])

  return (
    <AbsoluteFill style={{ backgroundColor: '#0D0D0D' }}>
      {/* Video half */}
      <div
        style={{
          position: 'absolute',
          top: videoOnTop ? 0 : halfHeight,
          left: 0,
          width,
          height: halfHeight,
          overflow: 'hidden',
        }}
      >
        <OffthreadVideo
          src={videoUrl}
          style={{
            width: '100%',
            height: '200%',
            objectFit: 'cover',
            marginTop: videoOnTop ? 0 : '-100%',
          }}
        />
      </div>

      {/* Animation/text half */}
      <div
        style={{
          position: 'absolute',
          top: videoOnTop ? halfHeight : 0,
          left: 0,
          width,
          height: halfHeight,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 60,
          backgroundColor: '#0D0D0D',
        }}
      >
        {currentSegment && (
          <div
            style={{
              transform: `translateY(${textY}px)`,
              opacity: textOpacity,
              textAlign: 'center',
            }}
          >
            <p
              style={{
                fontSize: fontSize * 1.2,
                fontWeight: 700,
                fontFamily: "'Inter', sans-serif",
                color,
                lineHeight: 1.5,
                textShadow: '0 2px 8px rgba(0,0,0,0.5)',
              }}
            >
              {currentSegment.text}
            </p>
          </div>
        )}
      </div>

      {/* Divider line */}
      <div
        style={{
          position: 'absolute',
          top: halfHeight - 1,
          left: 0,
          width,
          height: 2,
          backgroundColor: 'rgba(255,255,255,0.1)',
        }}
      />
    </AbsoluteFill>
  )
}
