import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function HomeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />
    </svg>
  );
}

export function TradeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 17 10 11l4 4 6-8" />
      <path d="M14 7h6v6" />
    </svg>
  );
}

export function ArenaIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m6 4 12 16M18 4 6 20" />
      <path d="m4 2 5 2-4 5M20 2l-5 2 4 5M3 21l4-4M21 21l-4-4" />
    </svg>
  );
}

export function TrophyIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8 3h8v5a4 4 0 0 1-8 0Z" />
      <path d="M8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4M12 12v5M8 21h8M9 17h6" />
    </svg>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3.5 20v-2a5.5 5.5 0 0 1 11 0v2M14 15.5a4.5 4.5 0 0 1 6.5 4" />
    </svg>
  );
}

export function FriendsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
      <circle cx="9" cy="7.5" r="3.5" />
      <path d="M22 20v-1.5a4 4 0 0 0-3-3.87" />
      <path d="M16.5 4.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function ArrowUpRightIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3 4.5 6v5.5c0 4.5 3 7.5 7.5 9.5 4.5-2 7.5-5 7.5-9.5V6Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function EthereumMark({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-flex items-center justify-center rounded-full border border-[var(--color-hairline-bright)] bg-[var(--color-surface-high)] text-[0.9rem] text-[var(--color-ink)] ${className}`}
    >
      ◆
    </span>
  );
}

export function BitcoinMark({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-flex items-center justify-center rounded-full bg-[#f7931a] text-[0.9rem] font-bold text-white ${className}`}
    >
      ₿
    </span>
  );
}
