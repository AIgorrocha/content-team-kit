import React from 'react'
import { Composition } from 'remotion'
import { SimpleCaption } from './compositions/SimpleCaption'
import { SplitScreen } from './compositions/SplitScreen'
import { CaptionOverlay } from './compositions/CaptionOverlay'

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Simple captions: white/yellow with shadow, no animation */}
      <Composition
        id="SimpleCaption"
        component={SimpleCaption}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          videoUrl: '',
          entries: [],
          captionColor: 'white' as const,
          fontSize: 48,
        }}
      />

      {/* Split screen: video half + animation half, alternating */}
      <Composition
        id="SplitScreen"
        component={SplitScreen}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          videoUrl: '',
          segments: [],
          captionColor: 'white' as const,
          fontSize: 42,
        }}
      />

      {/* Legacy: animated caption styles (bounce, typewriter, highlight, karaoke) */}
      <Composition
        id="CaptionOverlay"
        component={CaptionOverlay}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          srt: '',
          style: 'highlight',
        }}
      />
    </>
  )
}
