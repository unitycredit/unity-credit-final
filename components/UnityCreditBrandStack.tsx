import Link from 'next/link'

import UnityCreditLogoMark from '@/components/UnityCreditLogoMark'
import { cn } from '@/lib/utils'

type Props = {
  href?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
  textClassName?: string
  label?: string
  'aria-label'?: string
}

const TEXT_SIZE: Record<NonNullable<Props['size']>, string> = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-3xl',
}

export default function UnityCreditBrandStack({
  href,
  size = 'md',
  className,
  textClassName,
  label = 'UnityCredit',
  'aria-label': ariaLabel,
}: Props) {
  const inner = (
    <div className={cn('inline-flex flex-col items-center gap-2', className)} aria-label={ariaLabel || label}>
      <UnityCreditLogoMark size={size} aria-label={ariaLabel || label} />
      <div className={cn('font-semibold tracking-tight leading-none', TEXT_SIZE[size], textClassName)}>{label}</div>
    </div>
  )

  if (href) return <Link href={href}>{inner}</Link>
  return inner
}


