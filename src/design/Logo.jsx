export function LogoMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <g fill="var(--accent-ink)">
        <rect x="7" y="12" width="3" height="8" rx="1.5" />
        <rect x="12" y="7" width="3" height="18" rx="1.5" />
        <rect x="17" y="4" width="3" height="24" rx="1.5" />
        <rect x="22" y="10" width="3" height="12" rx="1.5" />
      </g>
    </svg>
  )
}
