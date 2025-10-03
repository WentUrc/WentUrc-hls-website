export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '--:--'
  const s = Math.floor(sec % 60)
  const m = Math.floor(sec / 60)
  const mm = m.toString()
  const ss = s.toString().padStart(2, '0')
  return `${mm}:${ss}`
}

export default formatTime
