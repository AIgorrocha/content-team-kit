import React from 'react'
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion'
import { parseSrt, type CaptionStyle, type SrtEntry } from '@/lib/studio-types'

function msToFrame(ms: number, fps: number): number {
  return Math.round((ms / 1000) * fps)
}

const BounceWord: React.FC<{ word: string; index: number; frame: number; fps: number; startFrame: number }> = ({
  word,
  index,
  frame,
  fps,
  startFrame,
}) => {
  const delay = index * 3
  const localFrame = frame - startFrame - delay

  const scale = spring({
    frame: Math.max(0, localFrame),
    fps,
    config: { damping: 8, stiffness: 200 },
  })

  const opacity = interpolate(Math.max(0, localFrame), [0, 5], [0, 1], {
    extrapolateRight: 'clamp',
  })

  return (
    <span
      style={{
        display: 'inline-block',
        transform: `scale(${scale})`,
        opacity,
        marginRight: 8,
      }}
    >
      {word}
    </span>
  )
}

const TypewriterText: React.FC<{ text: string; frame: number; startFrame: number; endFrame: number }> = ({
  text,
  frame,
  startFrame,
  endFrame,
}) => {
  const progress = interpolate(frame, [startFrame, endFrame - 5], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const charCount = Math.floor(progress * text.length)
  const displayed = text.slice(0, charCount)

  return <span>{displayed}<span style={{ opacity: frame % 15 < 8 ? 1 : 0 }}>|</span></span>
}

const HighlightText: React.FC<{ words: string[]; frame: number; startFrame: number; durationFrames: number }> = ({
  words,
  frame,
  startFrame,
  durationFrames,
}) => {
  const framesPerWord = Math.max(1, Math.floor(durationFrames / words.length))
  const elapsed = frame - startFrame
  const activeIndex = Math.floor(elapsed / framesPerWord)

  return (
    <span>
      {words.map((word, i) => (
        <span
          key={i}
          style={{
            color: i === activeIndex ? '#4A90D9' : '#FFFFFF',
            fontWeight: i === activeIndex ? 800 : 700,
            marginRight: 8,
            transition: 'color 0.1s',
          }}
        >
          {word}
        </span>
      ))}
    </span>
  )
}

const KaraokeText: React.FC<{ words: string[]; frame: number; startFrame: number; durationFrames: number }> = ({
  words,
  frame,
  startFrame,
  durationFrames,
}) => {
  const progress = interpolate(frame, [startFrame, startFrame + durationFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const filledCount = Math.floor(progress * words.length)

  return (
    <span>
      {words.map((word, i) => (
        <span
          key={i}
          style={{
            color: i < filledCount ? '#4A90D9' : 'rgba(255,255,255,0.5)',
            fontWeight: 700,
            marginRight: 8,
          }}
        >
          {word}
        </span>
      ))}
    </span>
  )
}

function renderCaption(
  entry: SrtEntry,
  style: CaptionStyle,
  frame: number,
  fps: number,
): React.ReactNode {
  const startFrame = msToFrame(entry.startMs, fps)
  const endFrame = msToFrame(entry.endMs, fps)
  const durationFrames = endFrame - startFrame
  const words = entry.text.split(/\s+/)

  switch (style) {
    case 'bounce':
      return (
        <span>
          {words.map((word, i) => (
            <BounceWord key={i} word={word} index={i} frame={frame} fps={fps} startFrame={startFrame} />
          ))}
        </span>
      )
    case 'typewriter':
      return <TypewriterText text={entry.text} frame={frame} startFrame={startFrame} endFrame={endFrame} />
    case 'highlight':
      return <HighlightText words={words} frame={frame} startFrame={startFrame} durationFrames={durationFrames} />
    case 'karaoke':
      return <KaraokeText words={words} frame={frame} startFrame={startFrame} durationFrames={durationFrames} />
    default:
      return <span>{entry.text}</span>
  }
}

export const CaptionOverlay: React.FC<Record<string, unknown>> = (props) => {
  const srt = (props.srt ?? '') as string
  const style = (props.style ?? 'highlight') as CaptionStyle
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const entries = parseSrt(srt)
  const currentEntry = entries.find((entry) => {
    const startFrame = msToFrame(entry.startMs, fps)
    const endFrame = msToFrame(entry.endMs, fps)
    return frame >= startFrame && frame <= endFrame
  })

  if (!currentEntry) return null

  const fadeIn = interpolate(
    frame,
    [msToFrame(currentEntry.startMs, fps), msToFrame(currentEntry.startMs, fps) + 5],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  const fadeOut = interpolate(
    frame,
    [msToFrame(currentEntry.endMs, fps) - 5, msToFrame(currentEntry.endMs, fps)],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          bottom: 175,
          left: 65,
          right: 65,
          textAlign: 'center',
          fontSize: 42,
          fontWeight: 700,
          fontFamily: 'Inter, sans-serif',
          color: '#FFFFFF',
          textShadow: '2px 2px 12px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.5)',
          opacity: Math.min(fadeIn, fadeOut),
          lineHeight: 1.4,
        }}
      >
        {renderCaption(currentEntry, style, frame, fps)}
      </div>
    </AbsoluteFill>
  )
}
