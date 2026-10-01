#!/usr/bin/env python3
"""
ct-motion-code / engine / beats.py

Analisa uma trilha de audio (wav/mp3) com librosa e devolve bpm, beats,
downbeats (estimados) e hits (picos de onset percussivo) em JSON, pra
sincronizar cenas e SFX na grade de batidas do motor de motion graphics.

Uso (SEM instalar nada no sistema; uv cria um ambiente descartavel na hora):
  uv run --with librosa --with soundfile --with numpy \
      python skills/ct-motion-code/engine/beats.py trilha.wav --out beats.json

ponytail: downbeat aqui e HEURISTICO (assume compasso 4/4, primeira batida
detectada = tempo 1: downbeats = beats[0::4]). Deteccao de downbeat de
verdade, em qualquer compasso, precisa de um modelo tipo madmom, que nao
esta instalado por desenho (peso grande so pra isso). Musica que nao for
4/4: ignorar downbeats e usar beats direto.
"""

import argparse
import json

import librosa
import numpy as np


def analyze(path):
    y, sr = librosa.load(path, sr=None, mono=True)
    duration = float(librosa.get_duration(y=y, sr=sr))

    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, units="frames")
    beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()

    # downbeat heuristico: 1 a cada 4 batidas, comecando na primeira.
    downbeats = beat_times[0::4]

    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    onset_frames = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr, units="frames")
    hit_times = librosa.frames_to_time(onset_frames, sr=sr).tolist()

    bpm = float(tempo) if np.isscalar(tempo) else float(tempo[0])

    return {
        "source": path,
        "duration": round(duration, 3),
        "bpm": round(bpm, 2),
        "beats": [round(t, 3) for t in beat_times],
        "downbeats": [round(t, 3) for t in downbeats],
        "hits": [round(t, 3) for t in hit_times],
    }


def main():
    parser = argparse.ArgumentParser(description="Extrai BPM/beats/downbeats/hits de um audio (librosa).")
    parser.add_argument("audio", help="Caminho do arquivo de audio (wav/mp3).")
    parser.add_argument("--out", help="Caminho do JSON de saida. Sem isso, imprime no stdout.")
    args = parser.parse_args()

    result = analyze(args.audio)
    text = json.dumps(result, ensure_ascii=False, indent=2)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text)
        print(
            f"OK: {args.out} (bpm={result['bpm']}, {len(result['beats'])} beats, "
            f"{len(result['downbeats'])} downbeats, {len(result['hits'])} hits)"
        )
    else:
        print(text)


if __name__ == "__main__":
    main()
