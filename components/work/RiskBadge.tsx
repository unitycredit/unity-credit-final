'use client'

import { Shield, AlertTriangle, AlertCircle } from 'lucide-react'

type RiskLevel = 'green' | 'yellow' | 'red'

interface RiskBadgeProps {
  level: RiskLevel
  label?: string
  size?: 'sm' | 'md' | 'lg'
}

const config: Record<RiskLevel, { icon: typeof Shield; bg: string; text: string; border: string; label: string }> = {
  green: {
    icon: Shield,
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    label: 'All Clear',
  },
  yellow: {
    icon: AlertTriangle,
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    label: 'Needs Attention',
  },
  red: {
    icon: AlertCircle,
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/30',
    label: 'Action Required',
  },
}

export default function RiskBadge({ level, label, size = 'md' }: RiskBadgeProps) {
  const c = config[level]
  const Icon = c.icon
  const sizeClasses = {
    sm: 'px-2 py-1 text-[10px]',
    md: 'px-3 py-1.5 text-xs',
    lg: 'px-4 py-2 text-sm',
  }

  return (
    <span className={`
      inline-flex items-center gap-1.5 rounded-full font-medium border
      ${c.bg} ${c.text} ${c.border} ${sizeClasses[size]}
    `}>
      <Icon className={size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-4.5 h-4.5' : 'w-3.5 h-3.5'} />
      {label || c.label}
    </span>
  )
}
