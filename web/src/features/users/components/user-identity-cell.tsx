/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { LongText } from '@/components/long-text'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getUserAvatarFallback, getUserAvatarStyle } from '@/lib/avatar'
import { getDemoModeUsername } from '@/lib/demo-mode'
import { buildFeishuUserChatUrl, cn } from '@/lib/utils'

import type { UserProfile } from '../types'
import { UserProfileHoverCard } from './user-profile-hover-card'

export function UserIdentityCell(props: {
  user: UserProfile
  demoMode: boolean
  usernameClassName?: string
}) {
  const user = props.user
  const username = user.username
  const displayName = user.display_name
  const remark = user.remark
  const avatarUrl = user.avatar_url
  const primaryName = getDemoModeUsername(
    displayName || username,
    props.demoMode
  )

  if (props.demoMode) {
    return <LongText className='w-[130px] font-normal'>{primaryName}</LongText>
  }

  const avatarFallback = getUserAvatarFallback(primaryName)
  const avatarFallbackStyle = getUserAvatarStyle(primaryName)
  const feishuChatUrl = buildFeishuUserChatUrl(user.open_id)
  const avatarElement = (
    <Avatar size='sm' className='shrink-0'>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={primaryName} />}
      <AvatarFallback
        className='text-xs font-medium text-white'
        style={avatarFallbackStyle}
      >
        {avatarFallback}
      </AvatarFallback>
    </Avatar>
  )

  return (
    <div className='flex w-[130px] min-w-0 items-center gap-2'>
      <UserProfileHoverCard user={user}>
        {feishuChatUrl ? (
          <a
            href={feishuChatUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='focus-visible:ring-ring rounded-full focus-visible:ring-2 focus-visible:outline-none'
            onClick={(event) => event.stopPropagation()}
          >
            {avatarElement}
          </a>
        ) : (
          avatarElement
        )}
      </UserProfileHoverCard>
      <div className='flex min-w-0 flex-1 flex-col gap-1'>
        <LongText className='max-w-full font-normal'>{primaryName}</LongText>
        {(displayName && displayName !== username) || remark ? (
          <div className='text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs'>
            {displayName && displayName !== username ? (
              <LongText
                className={cn(
                  'text-muted-foreground/70 min-w-0 flex-1',
                  props.usernameClassName
                )}
              >
                {username}
              </LongText>
            ) : null}
            {remark ? (
              <LongText className='max-w-[60px] shrink-0'>{remark}</LongText>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
