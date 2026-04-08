'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ICONS: Record<string, string> = {
  grid: '\u25A6',
  chart: '\u2261',
  mail: '\u2709',
  repeat: '\u21BB',
  download: '\u2913',
}

interface NavLinkProps {
  href: string
  icon?: string
  children: React.ReactNode
}

export function NavLink({ href, icon, children }: NavLinkProps) {
  const pathname = usePathname()
  const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all duration-150 ${
        isActive
          ? 'bg-white/10 text-white font-medium'
          : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
      }`}
    >
      {icon && (
        <span className={`w-5 text-center text-sm ${isActive ? 'text-white' : 'text-gray-500'}`}>
          {ICONS[icon] ?? ''}
        </span>
      )}
      {children}
    </Link>
  )
}
