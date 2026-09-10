import { useCallback, useRef, useState } from 'react'

import { LongText } from '@/components/long-text'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { UserProfileHoverCard } from '@/features/users/components/user-profile-hover-card'
import type { UserColumnRow } from '@/features/users/types'
import { useDemoMode } from '@/hooks/use-demo-mode'
import { getUserAvatarFallback, getUserAvatarStyle } from '@/lib/avatar'
import { getDemoModeUsername } from '@/lib/demo-mode'
import { buildFeishuUserChatUrl } from '@/lib/utils'

import { getUserInfo } from '../api'

interface LogUserCellProps {
  userId: number
  username: string
  displayName?: string
  avatarUrl?: string
  openId?: string
  gender?: number
  canFetchUserDetails?: boolean
  sensitiveVisible?: boolean
}

export function LogUserCell(props: LogUserCellProps) {
  const demoMode = useDemoMode()
  const [userData, setUserData] = useState<UserColumnRow | null>(null)
  const fetchedRef = useRef(false)

  const handleFetchUser = useCallback(() => {
    if (
      demoMode ||
      !props.canFetchUserDetails ||
      fetchedRef.current ||
      !props.sensitiveVisible
    ) {
      return
    }
    fetchedRef.current = true
    void getUserInfo(props.userId).then((response) => {
      if (!response.success || !response.data) return

      const info = response.data
      setUserData({
        id: info.id,
        username: info.username,
        display_name: info.display_name || info.username,
        email: info.email,
        avatar_url: info.avatar_url,
        remark: info.remark,
        quota: info.quota,
        used_quota: info.used_quota,
        sub_quota_used: 0,
        sub_quota_total: 0,
        request_count: info.request_count,
        group: info.group || '',
        status: info.status ?? 1,
        role: info.role ?? 1,
        department_name: info.department_name,
        custom_field_values: info.custom_field_values,
        join_date: info.join_date,
        job_number: info.job_number,
        job_title: info.job_title,
        description: info.description,
        background_image: info.background_image,
        mobile: info.mobile,
        open_id: info.open_id,
        gender: info.gender,
      })
    })
  }, [
    demoMode,
    props.canFetchUserDetails,
    props.sensitiveVisible,
    props.userId,
  ])

  if (!props.username) return null

  const resolvedUsername = userData?.username || props.username
  const primaryName = getDemoModeUsername(
    userData?.display_name || props.displayName || resolvedUsername,
    demoMode
  )

  if (demoMode) {
    return <LongText className='w-[120px] font-normal'>{primaryName}</LongText>
  }

  if (!props.sensitiveVisible) {
    return (
      <div className='flex min-w-0 items-center gap-2'>
        <Avatar size='sm' className='shrink-0'>
          <AvatarFallback className='bg-muted text-muted-foreground text-xs font-normal'>
            •
          </AvatarFallback>
        </Avatar>
        <div className='flex min-w-0 flex-1 flex-col gap-1'>
          <LongText className='max-w-full font-normal'>••••</LongText>
        </div>
      </div>
    )
  }

  const avatarFallback = getUserAvatarFallback(primaryName)
  const avatarFallbackStyle = getUserAvatarStyle(primaryName)
  const feishuChatUrl = buildFeishuUserChatUrl(
    userData?.open_id ?? props.openId
  )
  const avatarUrl = userData?.avatar_url || props.avatarUrl
  const baseUser: UserColumnRow = userData ?? {
    id: props.userId,
    username: resolvedUsername,
    display_name: props.displayName || resolvedUsername,
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
  const avatar = (
    <Avatar size='sm' className='shrink-0'>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={primaryName} />}
      <AvatarFallback
        className='text-xs font-normal text-white'
        style={avatarFallbackStyle}
      >
        {avatarFallback}
      </AvatarFallback>
    </Avatar>
  )
  const avatarLink = feishuChatUrl ? (
    <a
      href={feishuChatUrl}
      target='_blank'
      rel='noopener noreferrer'
      className='focus-visible:ring-ring rounded-full focus-visible:ring-2 focus-visible:outline-none'
      onClick={(event) => event.stopPropagation()}
    >
      {avatar}
    </a>
  ) : (
    avatar
  )

  return (
    <div
      className='flex w-[120px] min-w-0 items-center gap-2'
      onMouseEnter={handleFetchUser}
    >
      {props.canFetchUserDetails ? (
        <UserProfileHoverCard user={baseUser}>
          {avatarLink}
        </UserProfileHoverCard>
      ) : (
        avatarLink
      )}
      <div className='flex min-w-0 flex-1 flex-col gap-1'>
        <LongText className='max-w-full font-normal'>{primaryName}</LongText>
        {primaryName !== resolvedUsername ? (
          <div className='text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs'>
            <LongText className='min-w-0 flex-1'>{resolvedUsername}</LongText>
          </div>
        ) : null}
      </div>
    </div>
  )
}
