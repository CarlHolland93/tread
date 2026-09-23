// Torch is only exposed on some Android/Chrome devices. These constraints aren't
// in the standard MediaTrackConstraintSet types, so we narrow locally.
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean }
type TorchConstraint = MediaTrackConstraintSet & { torch?: boolean }

export function torchSupported(stream: MediaStream | null): boolean {
  const track = stream?.getVideoTracks()[0]
  if (!track?.getCapabilities) return false
  return Boolean((track.getCapabilities() as TorchCapabilities).torch)
}

export async function setTorch(stream: MediaStream | null, on: boolean): Promise<boolean> {
  const track = stream?.getVideoTracks()[0]
  if (!track) return false
  try {
    await track.applyConstraints({ advanced: [{ torch: on } as TorchConstraint] })
    return true
  } catch {
    return false
  }
}
