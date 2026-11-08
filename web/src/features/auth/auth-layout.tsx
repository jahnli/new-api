import { Link } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'
import { useSystemConfig } from '@/hooks/use-system-config'
import { cn } from '@/lib/utils'

import { LoginAurora } from './components/login-aurora'

import './components/login-aurora.css'
import '@/styles/login-brand-background.css'

type AuthLayoutProps = {
  children: React.ReactNode
  animatedBackground?: boolean
}

export function AuthLayout({
  children,
  animatedBackground = false,
}: AuthLayoutProps) {
  const { t } = useTranslation()
  const { systemName, logo, loading } = useSystemConfig()
  const artworkRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const artwork = artworkRef.current
    if (!animatedBackground || !artwork) return
    const media = window.matchMedia(
      '(max-width: 1023px), (prefers-reduced-motion: reduce)'
    )
    let timer: ReturnType<typeof setTimeout> | undefined

    const drift = () => {
      clearTimeout(timer)
      if (media.matches || document.hidden) return
      const x = Math.random() * 40 - 20
      const y = Math.random() * 36 - 24
      const duration = 2000 + Math.random() * 2000
      artwork.style.setProperty('--orb-x', `${x}px`)
      artwork.style.setProperty('--orb-y', `${y}px`)
      artwork.style.setProperty('--orb-duration', `${duration}ms`)
      artwork.style.setProperty('--orb-shadow-scale', `${0.85 + y / 120}`)
      artwork.style.setProperty('--orb-shadow-opacity', `${0.7 + y / 120}`)
      timer = setTimeout(drift, duration)
    }

    timer = setTimeout(drift, 100)
    media.addEventListener('change', drift)
    document.addEventListener('visibilitychange', drift)
    return () => {
      clearTimeout(timer)
      media.removeEventListener('change', drift)
      document.removeEventListener('visibilitychange', drift)
    }
  }, [animatedBackground])

  return (
    <div
      className={cn(
        'relative isolate grid min-h-svh max-w-none bg-background',
        animatedBackground && 'login-workspace lg:grid-cols-[1.08fr_1fr]'
      )}
    >
      {animatedBackground && (
        <aside className='login-workspace-brand relative isolate flex min-h-64 flex-col justify-end overflow-hidden bg-[#f0f6ff] px-7 pt-28 pb-8 text-[#071548] sm:px-12 lg:px-14 lg:pb-14'>
          <div
            className='login-brand-background pointer-events-none absolute inset-0 -z-10 overflow-hidden'
            aria-hidden='true'
          >
            <LoginAurora isDark={false} />
          </div>
          <div
            ref={artworkRef}
            className='login-workspace-art'
            aria-hidden='true'
          >
            <div className='login-workspace-orb-shadow' />
            <div className='login-workspace-orb' />
          </div>
          <div className='relative max-w-md -translate-x-[20px] translate-y-[10px]'>
            <p className='translate-y-3 text-[13px] font-semibold tracking-[0.28em] text-blue-800/70'>
              AI WORKSPACE
            </p>
            <div
              className='mt-3 h-px w-16 translate-y-2 bg-blue-600/25'
              aria-hidden='true'
            />
          </div>
        </aside>
      )}
      <Link
        to='/'
        className={cn(
          'focus-visible:outline-ring absolute top-6 left-6 z-10 flex max-w-[calc(100%-3rem)] items-center gap-3 rounded-lg transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 sm:top-8 sm:left-10',
          animatedBackground && 'login-workspace-logo text-[#071548]'
        )}
      >
        <div className='relative h-8 w-8'>
          {loading ? (
            <Skeleton className='absolute inset-0 rounded-full' />
          ) : (
            <img
              src={logo}
              alt={t('Logo')}
              className='h-8 w-8 rounded-full object-cover'
            />
          )}
        </div>
        {loading ? (
          <Skeleton className='h-6 w-24' />
        ) : (
          <h1 className='text-base font-semibold tracking-tight sm:text-lg'>
            {systemName}
          </h1>
        )}
      </Link>
      <main
        className={cn(
          'flex min-w-0 items-center justify-center px-6 pt-28 pb-12 sm:px-12 sm:pb-20',
          animatedBackground &&
            'login-workspace-main py-12 sm:py-16 lg:px-10 lg:py-20 xl:px-16'
        )}
      >
        <div
          className={cn(
            'mx-auto flex w-full max-w-[380px] flex-col justify-center space-y-2',
            animatedBackground ? 'max-w-[400px]' : 'px-4 py-8 sm:p-8'
          )}
        >
          {children}
        </div>
      </main>
    </div>
  )
}
