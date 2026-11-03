import { Activity, AtSign, BarChart3, Mail, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { Card, CardContent } from '@/components/ui/card'
import { IconBadge, type IconBadgeTone } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatQuota, formatRequestCount } from '@/lib/format'
import { getRoleLabel } from '@/lib/roles'

import { getDisplayName } from '../lib'
import type { UserProfile } from '../types'
import { ProfileLanyard } from './profile-lanyard'

// ============================================================================
// Profile Header Component
// ============================================================================

interface ProfileHeaderProps {
  profile: UserProfile | null
  loading: boolean
}

export function ProfileHeader({ profile, loading }: ProfileHeaderProps) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <Card data-card-hover='false' className='gap-0 overflow-hidden py-0'>
        <div className='grid md:grid-cols-[280px_minmax(0,1fr)] lg:grid-cols-[320px_minmax(0,1fr)]'>
          <div className='h-[340px]' aria-hidden='true' />
          <CardContent className='flex min-w-0 flex-col justify-center gap-7 p-5 md:p-8'>
            <div className='space-y-3'>
              <Skeleton className='h-9 w-40' />
              <Skeleton className='h-5 w-48' />
              <Skeleton className='h-5 w-full max-w-64' />
            </div>
            <div className='grid grid-cols-3 gap-3 border-t pt-5'>
              {['balance', 'usage', 'requests'].map((key) => (
                <div key={key} className='min-w-0 space-y-2'>
                  <Skeleton className='h-4 w-16 max-w-full' />
                  <Skeleton className='h-7 w-24 max-w-full' />
                </div>
              ))}
            </div>
          </CardContent>
        </div>
      </Card>
    )
  }

  if (!profile) return null

  const displayName = getDisplayName(profile)
  const roleLabel = getRoleLabel(profile.role)
  const stats: {
    label: string
    value: string
    description: string
    icon: typeof WalletCards
    tone: IconBadgeTone
  }[] = [
    {
      label: t('Current Balance'),
      value: formatQuota(profile.quota),
      description: t('Remaining quota'),
      icon: WalletCards,
      tone: 'success',
    },
    {
      label: t('Total Usage'),
      value: formatQuota(profile.used_quota),
      description: t('Total consumed quota'),
      icon: BarChart3,
      tone: 'info',
    },
    {
      label: t('API Requests'),
      value: formatRequestCount(profile.request_count ?? 0),
      description: t('Total requests made'),
      icon: Activity,
      tone: 'chart-4',
    },
  ]

  return (
    <Card
      data-card-hover='false'
      className='from-card via-card gap-0 overflow-hidden bg-linear-to-bl to-blue-50/60 py-0 dark:to-blue-950/20'
    >
      <div className='grid md:grid-cols-[280px_minmax(0,1fr)] lg:grid-cols-[320px_minmax(0,1fr)]'>
        <div className='mx-auto w-full max-w-80'>
          <ProfileLanyard profile={profile} />
        </div>
        <CardContent className='flex min-w-0 flex-col justify-center gap-7 p-5 md:p-8'>
          <div className='min-w-0 space-y-3'>
            <h1 className='text-2xl font-semibold tracking-tight wrap-anywhere sm:text-3xl'>
              {displayName}
            </h1>
            <div className='flex flex-wrap items-center gap-2'>
              <StatusBadge label={roleLabel} variant='info' copyable={false} />
              <StatusBadge
                label={`#${profile.id}`}
                variant='neutral'
                copyText={String(profile.id)}
              />
            </div>

            <div className='text-muted-foreground flex flex-col gap-2 text-sm xl:flex-row xl:flex-wrap xl:gap-x-5'>
              <span className='flex min-w-0 items-start gap-2'>
                <AtSign aria-hidden='true' className='mt-0.5 size-4 shrink-0' />
                <span className='wrap-anywhere'>{profile.username}</span>
              </span>
              {profile.email && (
                <span className='flex min-w-0 items-start gap-2'>
                  <Mail aria-hidden='true' className='mt-0.5 size-4 shrink-0' />
                  <span className='wrap-anywhere'>{profile.email}</span>
                </span>
              )}
            </div>
          </div>
          <div className='border-border/60 grid grid-cols-3 gap-3 border-t pt-5 sm:gap-5'>
            {stats.map((item) => (
              <div key={item.label} className='min-w-0'>
                <div className='flex flex-wrap items-center gap-1.5'>
                  <IconBadge tone={item.tone} size='stat'>
                    <item.icon />
                  </IconBadge>
                  <div className='text-muted-foreground text-xs font-medium'>
                    {item.label}
                  </div>
                </div>

                <div className='text-foreground mt-2 font-mono text-lg font-semibold tracking-tight wrap-anywhere tabular-nums sm:text-xl xl:text-2xl'>
                  {item.value}
                </div>
                <div className='text-muted-foreground mt-1 hidden text-xs sm:block'>
                  {item.description}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </div>
    </Card>
  )
}
