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
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors ${
        isActive
          ? 'bg-gray-900 text-white font-medium'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      {icon && (
        <span className={`w-5 text-center text-sm ${isActive ? 'opacity-100' : 'opacity-50'}`}>
          {ICONS[icon] ?? ''}
        </span>
      )}
      {children}
    </Link>
  )
}
