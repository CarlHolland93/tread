import { create } from 'zustand'
import type { Scan } from '@/lib/vision/types'

export type CaptureMode = 'photo' | 'video'

export type Capture = {
  blob: Blob
  /** Object URL for preview. Caller is responsible for revoking on reset. */
  url: string
}

type State = {
  mode: CaptureMode
  /** Photo captures (up to 4) or a single video capture. */
  captures: Capture[]
  result: Scan | null
  setMode: (m: CaptureMode) => void
  addCapture: (blob: Blob) => void
  setResult: (scan: Scan) => void
  reset: () => void
}

/**
 * Current capture session, intentionally NOT persisted.
 * Blobs and object URLs live only for the duration of a scan.
 */
export const useScanStore = create<State>((set, get) => ({
  mode: 'photo',
  captures: [],
  result: null,
  setMode: (m) => set({ mode: m }),
  addCapture: (blob) =>
    set((st) => ({ captures: [...st.captures, { blob, url: URL.createObjectURL(blob) }] })),
  setResult: (scan) => set({ result: scan }),
  reset: () => {
    get().captures.forEach((c) => URL.revokeObjectURL(c.url))
    set({ mode: 'photo', captures: [], result: null })
  },
}))
