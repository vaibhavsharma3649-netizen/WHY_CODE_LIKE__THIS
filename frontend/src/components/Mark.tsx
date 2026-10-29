export function Mark({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="mark"
    >
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <path
        d="M16 9.5L9.5 22M16 9.5L22.5 22M9.5 22H22.5"
        stroke="var(--mark-ink, #f4f3ee)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="9.5" r="2.2" fill="var(--mark-ink, #f4f3ee)" />
      <circle cx="9.5" cy="22" r="2.2" fill="var(--mark-ink, #f4f3ee)" />
      <circle cx="22.5" cy="22" r="2.2" fill="var(--mark-ink, #f4f3ee)" />
    </svg>
  );
}
