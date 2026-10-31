import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getAudioContext, unlockAudio } from '../../engine/audioContext.js'
import { decodeAudioBlob, peaksFromBuffer } from '../../engine/mix.js'
import { createMixer } from '../../engine/mixer.js'
import { TimelinePlayer, renderTimeline } from '../../engine/player.js'
import { getTake } from '../../storage/takes.js'

const PEAKS_PER_SECOND = 20

// Everything that makes sound for the Timeline screen: the audio context, the mixer, the player, and the
// recordings decoded ready to play. The screen decides what the timeline holds; this plays it.
export function useAudioEngine({ getTimeline, onEnd }) {
  const engineRef = useRef(null)
  const buffersRef = useRef(new Map()) // takeId -> decoded audio
  const peaksRef = useRef(new Map()) // takeId -> waveform for drawing
  const loadingRef = useRef(new Map()) // takeId -> promise, so a recording is only decoded once
  const missingRef = useRef(new Set()) // takes that no longer exist
  const [version, setVersion] = useState(0) // changes whenever a recording finishes loading
  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd

  const loadBuffer = useCallback((takeId) => {
    if (buffersRef.current.has(takeId) || missingRef.current.has(takeId)) return Promise.resolve()
    if (loadingRef.current.has(takeId)) return loadingRef.current.get(takeId)
    const job = (async () => {
      try {
        const take = await getTake(takeId)
        if (!take) {
          missingRef.current.add(takeId)
        } else {
          const buffer = await decodeAudioBlob(getAudioContext(), take.blob)
          buffersRef.current.set(takeId, buffer)
          peaksRef.current.set(takeId, peaksFromBuffer(buffer, Math.max(40, Math.min(4000, Math.ceil(buffer.duration * PEAKS_PER_SECOND)))))
        }
      } catch {
        missingRef.current.add(takeId)
      } finally {
        loadingRef.current.delete(takeId)
        setVersion((v) => v + 1)
      }
    })()
    loadingRef.current.set(takeId, job)
    return job
  }, [])

  // Loads every recording the timeline uses.
  const loadAll = useCallback(
    (timeline) => {
      const ids = new Set()
      for (const track of timeline.tracks) for (const clip of track.clips) if (clip.takeId) ids.add(clip.takeId)
      return Promise.all([...ids].map(loadBuffer))
    },
    [loadBuffer],
  )

  const ensureEngine = useCallback(async () => {
    const ctx = await unlockAudio()
    let engine = engineRef.current
    if (!engine || engine.ctx !== ctx) {
      engine?.player.dispose()
      engine?.mixer.dispose()
      const mixer = createMixer(ctx)
      const player = new TimelinePlayer({
        ctx,
        mixer,
        getTimeline,
        getBuffer: (id) => buffersRef.current.get(id),
        onEnd: () => onEndRef.current?.(),
      })
      engine = { ctx, mixer, player }
      engineRef.current = engine
    }
    engine.mixer.update(getTimeline())
    return engine
  }, [getTimeline])

  // After the timeline changes: keep the mixer in step, and restart playback if a clip changed.
  const apply = useCallback((timeline, { restart = false } = {}) => {
    const engine = engineRef.current
    if (!engine) return
    engine.mixer.update(timeline)
    if (restart) engine.player.refresh()
  }, [])

  const exportMix = useCallback(
    async (timeline) => {
      await loadAll(timeline)
      return renderTimeline(timeline, (id) => buffersRef.current.get(id))
    },
    [loadAll],
  )

  useEffect(
    () => () => {
      const engine = engineRef.current
      engine?.player.dispose()
      engine?.mixer.dispose()
      engineRef.current = null
    },
    [],
  )

  // The api never changes identity, so screens built on it do not redraw for no reason.
  // `version` changes each time a recording finishes loading, so a waveform can appear.
  const api = useMemo(
    () => ({
      engineRef,
      ensureEngine,
      apply,
      loadAll,
      loadBuffer,
      exportMix,
      getPeaks: (takeId) => peaksRef.current.get(takeId),
      getDuration: (takeId) => buffersRef.current.get(takeId)?.duration,
      isMissing: (takeId) => missingRef.current.has(takeId),
    }),
    [ensureEngine, apply, loadAll, loadBuffer, exportMix],
  )
  return { api, version }
}
