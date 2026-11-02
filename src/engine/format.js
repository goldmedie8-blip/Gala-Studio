// 83500 -> "1:23"
export function formatDuration(ms) {
    // A very short sound shows as 0:01 instead of 0:00, so a quick drum hit does not look empty.
  const total = Math.max(ms > 0 ? 1 : 0, Math.floor(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = String(total % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}
