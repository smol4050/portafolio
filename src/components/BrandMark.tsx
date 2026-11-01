
interface BrandMarkProps {
  className?: string
}

export default function BrandMark({
  className = '',
}: BrandMarkProps) {
  return (
    <svg
      className={`brand-mark ${className}`.trim()}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        className="mark-frame"
        d="M48 10 L79 28 L79 61 L60 76"
      />
      <path
        className="mark-frame mark-frame-secondary"
        d="M41 82 L21 67 L21 35 L42 20"
      />
      <path
        className="mark-inner"
        d="M40 30 H57 L70 43 V57 L56 70 H40 L30 59 V43 Z"
      />
      <path
        className="mark-core"
        d="M50 40 L60 50 L50 60 L40 50 Z"
      />
      <circle className="mark-orbit" cx="50" cy="50" r="16" />
    </svg>
  )
}