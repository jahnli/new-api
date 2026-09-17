import { Mars, Venus, type LucideIcon } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getUserAvatarFallback, getUserAvatarStyle } from '@/lib/avatar'
import { useAuthStore } from '@/stores/auth-store'

import { USER_ROLE, USER_ROLES } from '../constants'
import {
  type UserColumnRow,
  parseCustomFields,
  CUSTOM_FIELD_KEYS,
} from '../types'

interface UserProfileHoverCardProps {
  user: UserColumnRow
  children: React.ReactNode
}

interface ProfileFieldEntry {
  label: string
  value?: string | null
}

function ProfileField(props: { label: string; value?: string | null }) {
  if (!props.value) return null
  return (
    <div className='flex items-baseline gap-3 py-1.5'>
      <span className='text-muted-foreground w-12 shrink-0 text-xs'>
        {props.label}
      </span>
      <span className='min-w-0 text-sm break-all'>{props.value}</span>
    </div>
  )
}

function ProfileIconWithTooltip(props: {
  icon: LucideIcon
  label: string
  className: string
}) {
  const Icon = props.icon

  return (
    <Tooltip>
      <TooltipTrigger render={<span className='inline-flex shrink-0' />}>
        <Icon size={14} className={props.className} />
      </TooltipTrigger>
      <TooltipContent>
        <span className='text-xs'>{props.label}</span>
      </TooltipContent>
    </Tooltip>
  )
}

const DEFAULT_BANNER =
  'linear-gradient(135deg, rgb(0, 90, 210) 0%, rgb(160, 210, 255) 100%)'

const ROLE_TOOLTIP_LABELS: Partial<Record<number, string>> = {
  [USER_ROLE.USER]: '普通用户',
  [USER_ROLE.BU_BP]: 'BP',
  [USER_ROLE.ADMIN]: '管理员',
  [USER_ROLE.ROOT]: '超级管理员',
}

export function UserProfileHoverCard(props: UserProfileHoverCardProps) {
  const { t } = useTranslation()
  const { user } = props

  const primaryName = user.display_name || user.username
  const avatarFallback = getUserAvatarFallback(primaryName)
  const avatarFallbackStyle = getUserAvatarStyle(primaryName)
  const roleConfig = USER_ROLES[user.role as keyof typeof USER_ROLES]
  const hasGender = user.gender === 1 || user.gender === 2
  const GenderIcon = user.gender === 2 ? Venus : Mars
  const genderIconClassName =
    user.gender === 2 ? 'shrink-0 text-pink-500' : 'shrink-0 text-sky-500'
  const RoleIcon = roleConfig?.icon
  const genderLabel = user.gender === 2 ? '女' : '男'
  const roleLabel = ROLE_TOOLTIP_LABELS[user.role]
  const customFields = parseCustomFields(user.custom_field_values)
  const isRoot = useAuthStore((s) => s.auth.user?.role) === USER_ROLE.ROOT

  const bannerStyle: React.CSSProperties = user.background_image
    ? {
        backgroundImage: `url(${user.background_image})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : { background: DEFAULT_BANNER }

  const rootOnlyFields: ProfileFieldEntry[] = isRoot
    ? [
        { label: t('Mobile'), value: user.mobile },
        {
          label: t('Birthday'),
          value: customFields?.[CUSTOM_FIELD_KEYS.BIRTHDAY],
        },
        {
          label: t('Ethnicity'),
          value: customFields?.[CUSTOM_FIELD_KEYS.ETHNICITY],
        },
        {
          label: t('Hometown'),
          value: customFields?.[CUSTOM_FIELD_KEYS.HOMETOWN],
        },
      ]
    : []

  const visibleProfileFields: ProfileFieldEntry[] = [
    { label: t('Department'), value: user.department_name },
    {
      label: t('Job Level'),
      value: customFields?.[CUSTOM_FIELD_KEYS.JOB_LEVEL],
    },
    { label: t('Join Date'), value: user.join_date },
    { label: t('Email'), value: user.email },
    { label: t('Job Number'), value: user.job_number },
    { label: t('Job Title'), value: user.job_title },
    {
      label: t('Job Description'),
      value: customFields?.[CUSTOM_FIELD_KEYS.JOB_DESCRIPTION],
    },
    ...rootOnlyFields,
  ].filter((field) => Boolean(field.value))

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={100}
        render={<span className='cursor-pointer' />}
      >
        {props.children}
      </HoverCardTrigger>
      <HoverCardContent side='right' align='start' className='w-[20rem] p-0'>
        {/* Banner */}
        <div className='h-28 rounded-t-lg' style={bannerStyle} />

        {/* Avatar + Name */}
        <div className='relative px-5 pt-0 pb-3'>
          <div className='-mt-8'>
            <Avatar className='ring-background size-16 ring-[3px]'>
              {user.avatar_url && (
                <AvatarImage src={user.avatar_url} alt={primaryName} />
              )}
              <AvatarFallback
                className='text-base font-semibold text-white'
                style={avatarFallbackStyle}
              >
                {avatarFallback}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className='mt-2 flex items-start justify-between gap-2'>
            <div className='min-w-0 flex-1'>
              <div className='flex items-center gap-1.5'>
                <span className='truncate text-base font-semibold'>
                  {primaryName}
                </span>
                {hasGender && (
                  <ProfileIconWithTooltip
                    icon={GenderIcon}
                    label={genderLabel}
                    className={genderIconClassName}
                  />
                )}
                {RoleIcon && roleLabel && (
                  <ProfileIconWithTooltip
                    icon={RoleIcon}
                    label={roleLabel}
                    className='text-primary shrink-0'
                  />
                )}
              </div>
              {user.display_name && user.display_name !== user.username && (
                <div className='text-muted-foreground mt-0.5 truncate text-xs'>
                  @{user.username}
                </div>
              )}
              {user.description && (
                <div className='text-muted-foreground mt-1 truncate text-xs'>
                  {user.description}
                </div>
              )}
            </div>
            {user.company && (
              <div className='text-muted-foreground mt-0.5 shrink-0 text-right text-xs'>
                {user.company}
              </div>
            )}
          </div>
        </div>

        {/* Divider and Fields */}
        {visibleProfileFields.length > 0 && (
          <>
            <div className='bg-border mx-5 h-px' />
            <div className='px-5 py-2.5'>
              {visibleProfileFields.map((field) => (
                <ProfileField
                  key={field.label}
                  label={field.label}
                  value={field.value}
                />
              ))}
            </div>
          </>
        )}
      </HoverCardContent>
    </HoverCard>
  )
}
