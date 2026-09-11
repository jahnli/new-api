import { useMutation } from '@tanstack/react-query'
import {
  Check,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  Copy,
  ShieldAlert,
} from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Dialog } from '@/components/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { UserProfileHoverCard } from '@/features/users/components/user-profile-hover-card'
import type { UserColumnRow } from '@/features/users/types'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { getUserAvatarFallback, getUserAvatarStyle } from '@/lib/avatar'
import { formatTimestampToDate } from '@/lib/format'

import { getUserInfo, notifyRequestMessageViolation } from '../../api'
import type { RequestMessage } from '../../types'
import { parseUserMessages } from '../request-messages-provider'

interface RequestContentDialogProps {
  requestMessage: RequestMessage
  user: UserColumnRow
  client?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatParameters(parameters: string): string {
  try {
    return JSON.stringify(JSON.parse(parameters), null, 2)
  } catch {
    return parameters
  }
}

export function RequestContentDialog(props: RequestContentDialogProps) {
  const { t } = useTranslation()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [copiedTarget, setCopiedTarget] = useState<string | null>(null)
  const [messageOpenState, setMessageOpenState] = useState<
    Record<string, boolean>
  >({})
  const [userData, setUserData] = useState<UserColumnRow>(props.user)
  const fetchedUserRef = useRef(false)
  const { copiedText, copyToClipboard } = useCopyToClipboard({ notify: false })
  const messages = parseUserMessages(props.requestMessage.user_content)
  const canNotifyViolation = props.requestMessage.user_id > 0
  const primaryName = userData.display_name || userData.username
  const shouldShowUsername =
    Boolean(userData.username) && userData.username !== primaryName
  const avatarFallback = getUserAvatarFallback(primaryName)
  const avatarFallbackStyle = getUserAvatarStyle(primaryName)
  const handleFetchUser = useCallback(() => {
    if (fetchedUserRef.current || props.user.id <= 0) return

    fetchedUserRef.current = true
    void getUserInfo(props.user.id).then((response) => {
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
  }, [props.user.id])
  const notifyViolationMutation = useMutation({
    mutationFn: async () => {
      const res = await notifyRequestMessageViolation({
        request_id: props.requestMessage.request_id,
        user_id: props.requestMessage.user_id,
        model_name: props.requestMessage.model_name || '',
        created_at: props.requestMessage.created_at || 0,
      })
      if (!res.success) {
        throw new Error(res.message || t('Failed to send violation notice'))
      }
      return res
    },
    onSuccess: () => {
      toast.success(t('Violation notice sent'))
      setConfirmOpen(false)
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : t('Failed to send violation notice')
      )
    },
  })

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setConfirmOpen(false)
    }
    props.onOpenChange(nextOpen)
  }

  const handleCopy = async (text: string, target: string): Promise<void> => {
    if (await copyToClipboard(text)) {
      setCopiedTarget(target)
    }
  }

  // 消息内容可能重复，用 内容前缀+出现次序 组成稳定 key；最新的消息排在最上面
  const seenCount = new Map<string, number>()
  const entries = messages
    .map((message, index) => {
      const occurrence = seenCount.get(message) ?? 0
      seenCount.set(message, occurrence + 1)
      return {
        key: `${occurrence}:${message.slice(0, 40)}`,
        message,
        label: index + 1,
        isLatest: index === messages.length - 1,
      }
    })
    .reverse()
  const allMessagesExpanded = entries.every(
    (entry) => messageOpenState[entry.key] !== false
  )

  return (
    <>
      <Dialog
        open={props.open}
        onOpenChange={handleOpenChange}
        title={t('Request Content')}
        contentClassName='h-[85vh] sm:max-w-[78rem]'
        contentHeight='100%'
        bodyContainerClassName='flex-1 max-h-none overflow-hidden'
        bodyClassName='h-full min-h-0'
      >
        <div className='flex h-full min-h-0 flex-col space-y-3'>
          <div className='shrink-0 border-b pb-3'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div className='flex min-w-0 flex-1 items-start gap-3'>
                <UserProfileHoverCard user={userData}>
                  <Avatar
                    className='size-9 shrink-0'
                    onMouseEnter={handleFetchUser}
                  >
                    {userData.avatar_url && (
                      <AvatarImage
                        src={userData.avatar_url}
                        alt={primaryName}
                      />
                    )}
                    <AvatarFallback
                      className='text-sm font-semibold text-white'
                      style={avatarFallbackStyle}
                    >
                      {avatarFallback}
                    </AvatarFallback>
                  </Avatar>
                </UserProfileHoverCard>
                <div className='flex min-w-0 flex-1 flex-wrap items-start gap-x-4 gap-y-1'>
                  <div className='flex min-w-24 shrink-0 flex-col'>
                    <span className='truncate text-sm font-medium'>
                      {primaryName || `#${props.requestMessage.user_id}`}
                    </span>
                    {shouldShowUsername && (
                      <span className='text-muted-foreground truncate text-xs'>
                        {userData.username}
                      </span>
                    )}
                  </div>
                  <div className='min-w-0 flex-1 space-y-1'>
                    <div className='text-muted-foreground flex min-w-0 flex-wrap items-center gap-1 text-sm'>
                      <span>
                        {props.requestMessage.model_name} ·{' '}
                        {props.requestMessage.relay_format} ·{' '}
                        {formatTimestampToDate(props.requestMessage.created_at)}
                      </span>
                      <span className='text-muted-foreground/60'>·</span>
                      <span className='shrink-0'>{t('Request ID')}:</span>
                      <span className='max-w-[28rem] truncate font-mono'>
                        {props.requestMessage.request_id}
                      </span>
                      <Button
                        variant='ghost'
                        size='sm'
                        className='h-6 w-6 shrink-0 p-0'
                        onClick={() =>
                          void handleCopy(
                            props.requestMessage.request_id,
                            'request-id'
                          )
                        }
                        title={t('Copy to clipboard')}
                      >
                        {copiedTarget === 'request-id' &&
                        copiedText === props.requestMessage.request_id ? (
                          <Check className='size-3 text-green-600' />
                        ) : (
                          <Copy className='size-3' />
                        )}
                      </Button>
                    </div>
                    {props.client && (
                      <div className='text-muted-foreground flex min-w-0 items-start gap-1 text-sm'>
                        <span className='shrink-0'>{t('Client')}:</span>
                        <span className='min-w-0 break-all'>
                          {props.client}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {canNotifyViolation && (
                <Button
                  variant='destructive'
                  size='sm'
                  className='h-8 shrink-0 gap-1.5'
                  onClick={() => setConfirmOpen(true)}
                  disabled={notifyViolationMutation.isPending}
                >
                  <ShieldAlert className='size-3.5' />
                  {t('Violation Notice')}
                </Button>
              )}
            </div>
          </div>

          <div className='grid min-h-0 flex-1 grid-cols-1 grid-rows-2 gap-4 overflow-hidden md:grid-cols-[minmax(0,1fr)_minmax(12rem,0.42fr)] md:grid-rows-[minmax(0,1fr)]'>
            <div className='h-full min-h-0 [scrollbar-gutter:stable] overflow-y-scroll overscroll-contain pr-3'>
              <div className='space-y-3'>
                {entries.length > 1 && (
                  <div className='bg-background/95 sticky top-0 z-10 flex justify-end pb-1 backdrop-blur-sm'>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      className='text-muted-foreground hover:text-foreground h-8 rounded-full px-3 shadow-sm'
                      onClick={() => {
                        if (allMessagesExpanded) {
                          setMessageOpenState(
                            Object.fromEntries(
                              entries.map((entry) => [entry.key, false])
                            )
                          )
                          return
                        }
                        setMessageOpenState({})
                      }}
                    >
                      {allMessagesExpanded ? (
                        <ChevronsUp data-icon='inline-start' />
                      ) : (
                        <ChevronsDown data-icon='inline-start' />
                      )}
                      {t(allMessagesExpanded ? 'Collapse All' : 'Expand All')}
                    </Button>
                  </div>
                )}
                {entries.map((entry) => (
                  <Collapsible
                    key={entry.key}
                    open={messageOpenState[entry.key] ?? true}
                    onOpenChange={(open) =>
                      setMessageOpenState((current) => ({
                        ...current,
                        [entry.key]: open,
                      }))
                    }
                    className='group/message rounded-lg border'
                  >
                    <div className='flex items-center gap-1 px-3 py-2'>
                      <CollapsibleTrigger className='flex flex-1 cursor-pointer items-center gap-2 text-left text-sm font-medium'>
                        <ChevronDown className='text-muted-foreground size-4 shrink-0 transition-transform group-data-[closed]/message:-rotate-90' />
                        <span>
                          {t('User message {{index}}', { index: entry.label })}
                        </span>
                        {entry.isLatest && (
                          <span className='text-muted-foreground/60 text-xs font-normal'>
                            {t('Latest')}
                          </span>
                        )}
                      </CollapsibleTrigger>
                      <Button
                        variant='ghost'
                        size='sm'
                        className='h-7 w-7 shrink-0 p-0'
                        onClick={() =>
                          void handleCopy(entry.message, entry.key)
                        }
                        title={t('Copy to clipboard')}
                      >
                        {copiedTarget === entry.key &&
                        copiedText === entry.message ? (
                          <Check className='size-3.5 text-green-600' />
                        ) : (
                          <Copy className='size-3.5' />
                        )}
                      </Button>
                    </div>
                    <CollapsibleContent className='CollapsibleContent'>
                      <p className='bg-muted/40 border-t py-2.5 pr-3 pl-9 text-sm leading-relaxed break-words whitespace-pre-wrap'>
                        {entry.message}
                      </p>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </div>

            <div className='h-full min-h-0 min-w-0 [scrollbar-gutter:stable] overflow-y-scroll overscroll-contain'>
              {props.requestMessage.parameters && (
                <Collapsible
                  defaultOpen
                  className='group/parameters rounded-lg border px-3 py-2'
                >
                  <CollapsibleTrigger className='flex w-full shrink-0 cursor-pointer items-center gap-2 text-left text-sm font-medium'>
                    <ChevronDown className='text-muted-foreground size-4 shrink-0 transition-transform group-data-[closed]/parameters:-rotate-90' />
                    <span>{t('Request Parameters')}</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className='CollapsibleContent mt-2'>
                    <pre className='bg-muted overflow-x-auto rounded-md p-3 text-xs whitespace-pre'>
                      {formatParameters(props.requestMessage.parameters)}
                    </pre>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          </div>
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('Confirm Violation Notice')}
        desc={t('Send a violation notice to this user via Feishu?')}
        confirmText={t('Send')}
        destructive
        isLoading={notifyViolationMutation.isPending}
        handleConfirm={() => notifyViolationMutation.mutate()}
      />
    </>
  )
}
