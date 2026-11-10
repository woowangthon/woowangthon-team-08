import "./brand-logo.css"
export function BrandMark({ className }) {
  const link = "M-8.5 -6A8.5 8.5 0 0 1 8.5 -6L8.5 6A8.5 8.5 0 0 1 -8.5 6Z"
  return (
    <svg
      aria-hidden="true"
      className={["brand-mark", className].filter(Boolean).join(" ")}
      fill="none"
      viewBox="0 0 64 64"
    >
      <defs>
        <mask id="mg-a" maskUnits="userSpaceOnUse" x="-10" y="-10" width="84" height="84">
          <rect x="-10" y="-10" width="84" height="84" fill="white" stroke="none" />
          <circle cx="32" cy="38.35" r="5.4" fill="black" stroke="none" />
        </mask>
        <mask id="mg-b" maskUnits="userSpaceOnUse" x="-10" y="-10" width="84" height="84">
          <rect x="-10" y="-10" width="84" height="84" fill="white" stroke="none" />
          <circle cx="32" cy="24.62" r="5.4" fill="black" stroke="none" />
        </mask>
      </defs>
      <rect width="64" height="64" rx="15" fill="#2E625B" />
      <g
        transform="translate(6 6) scale(0.8125)"
        stroke="#E8F1EC"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <g mask="url(#mg-a)">
          <path d={link} transform="translate(22.5 27.5) rotate(-48)" />
        </g>
        <g mask="url(#mg-b)">
          <path d={link} transform="translate(41.5 27.5) rotate(48)" />
        </g>
      </g>
    </svg>
  )
}
export function BrandLogo({ compact = false, className }) {
  return (
    <span className={["brand-logo", className].filter(Boolean).join(" ")}>
      <BrandMark />
      <span className="brand-logo-text">
        <span className="brand-logo-name">마음결</span>
        {!compact && (
          <span className="brand-logo-tagline">마음을 정리하는 작은 연결</span>
        )}
      </span>
    </span>
  )
}
