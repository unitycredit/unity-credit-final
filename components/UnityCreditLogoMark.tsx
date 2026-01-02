import * as React from 'react'

import { cn } from '@/lib/utils'

type Props = {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  'aria-label'?: string
}

const SIZE: Record<NonNullable<Props['size']>, string> = {
  sm: 'h-10 w-10',
  md: 'h-12 w-12',
  lg: 'h-20 w-20',
}

export default function UnityCreditLogoMark({ size = 'md', className, 'aria-label': ariaLabel }: Props) {
  return (
    <div
      aria-label={ariaLabel || 'Unity Credit'}
      className={cn(
        'rounded-2xl bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center border border-gold/30 text-primary shadow-lg',
        SIZE[size],
        className
      )}
    >
      <svg className="h-1/2 w-1/2" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 2l7 4v6c0 5-3 9-7 10-4-1-7-5-7-10V6l7-4z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M9.5 12l1.8 1.8L15 10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}


