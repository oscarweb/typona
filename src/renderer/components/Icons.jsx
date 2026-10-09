import React from 'react'

const base = {
  width: 14,
  height: 14,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
}

export function FileIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 2.5h8l4 4V21a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" />
      <path d="M14 2.5V7a1 1 0 0 0 1 1h4.5" />
    </svg>
  )
}

export function FolderIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h4.086a1.5 1.5 0 0 1 1.06.44L11 5.79a1.5 1.5 0 0 0 1.06.44H19.5A1.5 1.5 0 0 1 21 7.73V18.5A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 3 18.5Z" />
    </svg>
  )
}

export function ChevronIcon(props) {
  return (
    <svg {...base} width={10} height={10} {...props}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

export function SearchIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  )
}

export function ClockIcon(props) {
  return (
    <svg {...base} width={12} height={12} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

export function EyeIcon(props) {
  return (
    <svg {...base} width={12} height={12} {...props}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function PencilIcon(props) {
  return (
    <svg {...base} width={12} height={12} {...props}>
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </svg>
  )
}

export function CopyIcon(props) {
  return (
    <svg {...base} width={13} height={13} {...props}>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </svg>
  )
}

export function CheckIcon(props) {
  return (
    <svg {...base} width={13} height={13} {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}
