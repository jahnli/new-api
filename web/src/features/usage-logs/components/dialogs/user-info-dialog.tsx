import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Label } from '@/components/ui/label'
import { formatQuota, formatCompactNumber } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'

import { getUserInfo } from '../../api'
import type { UserInfo } from '../../types'

interface UserInfoDialogProps {
  userId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function InfoItem(props: { label: string; value: string | number }) {
  return (
    <div className='space-y-1.5'>
      <Label className='text-muted-foreground text-xs'>{props.label}</Label>
      <div className='text-sm font-semibold'>{props.value}</div>
    </div>
  )
}

export function UserInfoDialog({
  userId,
  open,
  onOpenChange,
}: UserInfoDialogProps) {
  const { t } = useTranslation()
  const requestId = open && userId ? userId : null
  const [requestState, setRequestState] = useState<{
    requestId: number | null
    userInfo: UserInfo | null
    isLoading: boolean
  }>(() => ({ requestId, userInfo: null, isLoading: Boolean(requestId) }))

  if (requestState.requestId !== requestId) {
    setRequestState({
      requestId,
      userInfo: null,
      isLoading: Boolean(requestId),
    })
  }

  useEffect(() => {
    if (!requestId) return

    let cancelled = false

    const loadUserInfo = async () => {
      try {
        const result = await getUserInfo(requestId)
        if (cancelled) return
        if (result.success) {
          setRequestState({
            requestId,
            userInfo: result.data || null,
            isLoading: false,
          })
        } else {
          handleServerError(result, t('Failed to fetch user information'))
        }
      } catch (error) {
        if (cancelled) return
        handleServerError(error, t('Failed to fetch user information'))
      } finally {
        if (!cancelled) {
          setRequestState((current) => ({ ...current, isLoading: false }))
        }
      }
    }

    void loadUserInfo()

    return () => {
      cancelled = true
    }
  }, [requestId, t])

  const userInfo = requestState.userInfo
  let content = (
    <div className='text-muted-foreground py-8 text-center text-sm'>
      {t('No user information available')}
    </div>
  )
  if (requestState.isLoading) {
    content = (
      <div className='flex items-center justify-center py-8'>
        <Loader2 className='text-muted-foreground size-6 animate-spin' />
      </div>
    )
  } else if (userInfo) {
    content = (
      <div className='space-y-4 py-4'>
        {/* Basic Info */}
        <div className='grid grid-cols-2 gap-4'>
          <InfoItem label={t('Username')} value={userInfo.username} />
          {userInfo.display_name && (
            <InfoItem label={t('Display Name')} value={userInfo.display_name} />
          )}
        </div>

        {/* Balance Info */}
        <div className='grid grid-cols-2 gap-4'>
          <InfoItem label={t('Balance')} value={formatQuota(userInfo.quota)} />
          <InfoItem
            label={t('Used Quota')}
            value={formatQuota(userInfo.used_quota)}
          />
        </div>

        {/* Statistics */}
        <div className='grid grid-cols-2 gap-4'>
          <InfoItem
            label={t('Request Count')}
            value={formatCompactNumber(userInfo.request_count)}
          />
          {userInfo.group && (
            <InfoItem label={t('User Group')} value={userInfo.group} />
          )}
        </div>

        {/* Invitation Info */}
        {(userInfo.aff_code ||
          userInfo.aff_count !== undefined ||
          (userInfo.aff_quota !== undefined && userInfo.aff_quota > 0)) && (
          <>
            <div className='grid grid-cols-2 gap-4'>
              {userInfo.aff_code && (
                <InfoItem
                  label={t('Invitation Code')}
                  value={userInfo.aff_code}
                />
              )}
              {userInfo.aff_count !== undefined && (
                <InfoItem
                  label={t('Invited Users')}
                  value={formatCompactNumber(userInfo.aff_count)}
                />
              )}
            </div>

            {userInfo.aff_quota !== undefined && userInfo.aff_quota > 0 && (
              <InfoItem
                label={t('Invitation Quota')}
                value={formatQuota(userInfo.aff_quota)}
              />
            )}
          </>
        )}

        {/* Remark */}
        {userInfo.remark && (
          <div className='space-y-1.5'>
            <Label className='text-muted-foreground text-xs'>
              {t('Remark')}
            </Label>
            <div className='text-sm leading-relaxed font-semibold break-words'>
              {userInfo.remark}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('User Information')}
      description={t(
        'View detailed information about this user including balance, usage statistics, and invitation details.'
      )}
      contentClassName='sm:max-w-lg'
      contentHeight='auto'
      bodyClassName='space-y-4'
    >
      {content}
    </Dialog>
  )
}
