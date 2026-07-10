import {
  Archive,
  ArrowLeft,
  AtSign,
  Check,
  ChevronDown,
  Clock,
  CornerDownLeft,
  History,
  Lightbulb,
  MessageSquare,
  Plus,
  RotateCcw,
  Search,
  Share2,
  Table2,
  Tag,
  Trash2,
  Wifi,
  WifiOff,
  X,
  type LucideProps,
} from 'lucide-react'

const REGISTRY = {
  Archive,
  ArrowLeft,
  AtSign,
  Check,
  ChevronDown,
  Clock,
  CornerDownLeft,
  History,
  Lightbulb,
  MessageSquare,
  Plus,
  RotateCcw,
  Search,
  Share2,
  Table2,
  Tag,
  Trash2,
  Wifi,
  WifiOff,
  X,
}

export type IconName = keyof typeof REGISTRY

export function Icon({ name, ...props }: { name: IconName } & LucideProps) {
  const Cmp = REGISTRY[name]
  return <Cmp {...props} />
}

// The potato mark. Single-path with evenodd so the eyes read as holes on any tint.
export function PotatoMark({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M4.1 11.3C4.4 8 7 5.6 10.3 5c3-.5 6.4-.3 8.8 1.6 2 1.6 2.6 4.3 1.8 6.9-.8 2.6-2.9 5-5.9 5.6-3.5.7-7.7.2-9.8-2.2-1.2-1.4-1.4-3.4-1.1-5.6Zm5.2-1.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm4.7 2.1a.95.95 0 1 0 0 1.9.95.95 0 0 0 0-1.9Zm-3.5 2.3a.85.85 0 1 0 0 1.7.85.85 0 0 0 0-1.7Z"
      />
    </svg>
  )
}
