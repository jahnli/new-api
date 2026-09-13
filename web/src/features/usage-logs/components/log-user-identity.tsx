import { useCallback, useRef, useState, type ReactNode } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { UserProfileHoverCard } from '@/features/users/components/user-profile-hover-card'
import type { UserColumnRow } from '@/features/users/types'
import { getUserAvatarFallback, getUserAvatarStyle } from '@/lib/avatar'
import { cn } from '@/lib/utils'

import { getUserInfo } from '../api'

interface LogUserIdentityProps {
  userId: number
  username?: string
  displayName?: string
  avatarUrl?: string
  openId?: string
  gender?: number
  /**
   * Type scale of the block: `sm` for a compact chip beside a dialog title,
   * `default` for an inline row in a dialog header, `lg` for a standalone
   * identity bar at the top of a dialog body.
   */
  size?: 'sm' | 'default' | 'lg'
  /** Whether hovering the avatar loads the extended user profile. */
  canFetchDetails?: boolean
  className?: string
  /** Extra log facts rendered beside the name. */
  children?: ReactNode
}

/** Type scale per `size`, kept together so the variants stay comparable. */
const SIZE_TEXT_CLASSES = {
  sm: { name: 'text-xs', username: 'text-[11px]' },
  default: { name: 'text-sm', username: 'text-xs' },
  lg: { name: 'text-base', username: 'text-sm' },
} as const

/**
 * Log user identity: avatar, display name and username, with the full profile
 * loading lazily on hover. Shared by the log dialogs so every log view
 * identifies its user the same way.
 */
export function LogUserIdentity(props: LogUserIdentityProps) {
  const [userData, setUserData] = useState<UserColumnRow | null>(null)
  const fetchedUserIdRef = useRef<number | null>(null)

  const handleFetchUser = useCallback(() => {
    if (
      props.canFetchDetails === false ||
      props.userId <= 0 ||
      fetchedUserIdRef.current === props.userId
    ) {
      return
    }

    fetchedUserIdRef.current = props.userId
    void getUserInfo(props.userId).then((response) => {
      if (!response.success || !response.data) return

      const userInfo = response.data
      setUserData({
        id: userInfo.id,
        username: userInfo.username,
        display_name: userInfo.display_name || userInfo.username,
        email: userInfo.email,
        avatar_url: userInfo.avatar_url,
        remark: userInfo.remark,
        quota: userInfo.quota,
        used_quota: userInfo.used_quota,
        sub_quota_used: 0,
        sub_quota_total: 0,
        request_count: userInfo.request_count,
        group: userInfo.group || '',
        status: userInfo.status ?? 1,
        role: userInfo.role ?? 1,
        department_name: userInfo.department_name,
        custom_field_values: userInfo.custom_field_values,
        join_date: userInfo.join_date,
        job_number: userInfo.job_number,
        job_title: userInfo.job_title,
        description: userInfo.description,
        background_image: userInfo.background_image,
        mobile: userInfo.mobile,
        open_id: userInfo.open_id,
        gender: userInfo.gender,
      })
    })
  }, [props.canFetchDetails, props.userId])

  // The log row already carries the author; the fetched profile only augments it.
  const fallbackUser: UserColumnRow = {
    id: props.userId,
    username: props.username ?? '',
    display_name: props.displayName || props.username || `#${props.userId}`,
    avatar_url: props.avatarUrl,
    quota: 0,
    used_quota: 0,
    sub_quota_used: 0,
    sub_quota_total: 0,
    request_count: 0,
    group: '',
    status: 1,
    role: 1,
    open_id: props.openId,
    gender: props.gender,
  }
  const user = userData?.id === props.userId ? userData : fallbackUser
  const primaryName = user.display_name || user.username
  const shouldShowUsername =
    Boolean(user.username) && user.username !== primaryName
  const size = props.size ?? 'default'
  const textClasses = SIZE_TEXT_CLASSES[size]

  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 items-center gap-3',
        size === 'sm' && 'gap-2',
        props.className
      )}
    >
      <UserProfileHoverCard user={user}>
        <Avatar
          size={size === 'sm' ? 'sm' : 'default'}
          className={cn('shrink-0', size !== 'sm' && 'size-8.5')}
          onMouseEnter={handleFetchUser}
        >
          {user.avatar_url && (
            <AvatarImage src={user.avatar_url} alt={primaryName} />
          )}
          <AvatarFallback
            className='font-semibold text-white'
            style={getUserAvatarStyle(primaryName)}
          >
            {getUserAvatarFallback(primaryName)}
          </AvatarFallback>
        </Avatar>
      </UserProfileHoverCard>
      <div className='flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1'>
        <div className='flex min-w-24 shrink-0 flex-col'>
          <span className={cn('truncate font-medium', textClasses.name)}>
            {primaryName}
          </span>
          {shouldShowUsername && (
            <span
              className={cn(
                'text-muted-foreground/70 truncate',
                textClasses.username
              )}
            >
              {user.username}
            </span>
          )}
        </div>
        {props.children && (
          <div className='min-w-0 flex-1 space-y-1'>{props.children}</div>
        )}
      </div>
    </div>
  )
}
