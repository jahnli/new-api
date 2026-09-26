import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  BookOpen,
  Clock3,
  FlaskConical,
  PenLine,
  Plus,
  Send,
} from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Dialog } from '@/components/dialog'
import { ErrorState } from '@/components/error-state'
import { SectionPageLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { hasPermission } from '@/lib/admin-permissions'
import { useAuthStore } from '@/stores/auth-store'

import { getNotificationConfig, notificationKeys, saveLibrary } from './api'
import { DeliverySettings } from './components/delivery-settings'
import { NotificationHistory } from './components/history'
import { NotificationLibrary } from './components/library'
import { MessageEditor } from './components/message-editor'
import { SendDialog } from './components/send-dialog'
import { messageSchema, normalizeNotificationMessage } from './lib/message'
import {
  EMPTY_MESSAGE,
  type LibraryKind,
  type NotificationMessage,
  type SavedNotification,
} from './types'

export function Notifications() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const user = useAuthStore((state) => state.auth.user)
  const canTest = hasPermission(user, 'notification', 'view')
  const [tab, setTab] = useState('compose')
  const [revision, setRevision] = useState(0)
  const [processingImages, setProcessingImages] = useState(false)
  const [pendingSend, setPendingSend] = useState<{
    message: NotificationMessage
    test: boolean
  } | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const [pendingLoad, setPendingLoad] = useState<{
    entry: SavedNotification | null
    kind?: LibraryKind
  } | null>(null)
  const [saveName, setSaveName] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [sourceTemplate, setSourceTemplate] =
    useState<SavedNotification | null>(null)
  const form = useForm<NotificationMessage>({
    resolver: zodResolver(messageSchema(t)),
    defaultValues: structuredClone(EMPTY_MESSAGE),
  })
  const message = form.watch()
  const config = useQuery({
    queryKey: notificationKeys.config,
    queryFn: getNotificationConfig,
  })
  const templateMutation = useMutation({
    mutationFn: (value: {
      id?: number
      name: string
      message: NotificationMessage
      is_public: boolean
    }) => saveLibrary('templates', value),
    onSuccess: (entry) => {
      setSourceTemplate(entry)
      setSaveOpen(false)
      void client.invalidateQueries({
        queryKey: notificationKeys.library('templates'),
      })
      toast.success(t('Saved successfully'))
    },
  })

  const loadMessage = (
    entry: SavedNotification | null,
    kind?: LibraryKind,
    discard = false
  ) => {
    if (processingImages) return
    if (form.formState.isDirty && !discard) {
      setPendingLoad({ entry, kind })
      return
    }
    const next = normalizeNotificationMessage(entry?.message ?? EMPTY_MESSAGE)
    if (next.channel !== 'email') next.recipients = []
    form.reset(structuredClone(next))
    setSourceTemplate(kind === 'templates' ? entry : null)
    setRevision((value) => value + 1)
    setTab('compose')
    setPendingLoad(null)
  }

  const beginSend = (test: boolean) => {
    if (processingImages || !canTest || (!test && !config.data?.can_send)) {
      return
    }
    void form.handleSubmit((value) => {
      if (!test && value.channel === 'email') {
        if (value.recipients.length === 0) {
          form.setError('recipients', {
            message: t('Please enter at least one recipient'),
          })
          return
        }
        if (
          value.recipients.some(
            (recipient) => !z.email().safeParse(recipient).success
          )
        ) {
          form.setError('recipients', {
            message: t('Please enter valid email addresses'),
          })
          return
        }
      }
      if (
        value.channel !== 'email' &&
        !config.data?.companies.some(
          (company) =>
            company.id === value.company_id &&
            company.platform === value.channel
        )
      ) {
        form.setError('company_id', { message: t('Select a company') })
        return
      }
      const snapshot = structuredClone(value)
      setPendingSend({ message: snapshot, test })
    })()
  }

  const openSave = () => {
    setSaveOpen(true)
    setSaveName((sourceTemplate?.name || message.title || '').slice(0, 128))
    setIsPublic(Boolean(config.data?.can_send && sourceTemplate?.is_public))
  }

  const save = () => {
    const value = structuredClone(form.getValues())
    const canUpdate =
      sourceTemplate &&
      (sourceTemplate.is_public
        ? config.data?.can_send
        : sourceTemplate.user_id === user?.id)
    templateMutation.mutate({
      id: canUpdate ? sourceTemplate.id : undefined,
      name: saveName.trim(),
      message: value,
      is_public: Boolean(config.data?.can_send && isPublic),
    })
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Notifications')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='w-full min-w-0 space-y-6 pb-8'>
          <header className='from-primary/7 via-card to-card relative overflow-hidden rounded-2xl border bg-gradient-to-br px-5 py-4 sm:px-7'>
            <div className='bg-primary/5 pointer-events-none absolute -top-20 -right-12 size-64 rounded-full' />
            <div className='relative flex flex-wrap items-center justify-between gap-4'>
              <div className='flex items-center gap-3'>
                <div className='bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl'>
                  <Bell className='size-5' />
                </div>
                <div>
                  <div className='flex flex-wrap items-center gap-2'>
                    <h1 className='text-xl font-semibold tracking-tight sm:text-2xl'>
                      {t('Notifications')}
                    </h1>
                    <Badge variant='outline'>
                      {t('Feishu · DingTalk · Email')}
                    </Badge>
                  </div>
                </div>
              </div>
              <Button
                variant='outline'
                disabled={processingImages}
                onClick={() => loadMessage(null)}
              >
                <Plus className='size-4' />
                {t('New message')}
              </Button>
            </div>
          </header>
          <nav
            className='flex gap-1 overflow-x-auto border-b pb-2'
            aria-label={t('Notifications')}
          >
            {[
              { value: 'compose', label: t('Compose'), icon: PenLine },
              { value: 'templates', label: t('Templates'), icon: BookOpen },
              { value: 'history', label: t('History'), icon: Clock3 },
            ].map((item) => (
              <Button
                key={item.value}
                variant={tab === item.value ? 'secondary' : 'ghost'}
                className='shrink-0'
                aria-current={tab === item.value ? 'page' : undefined}
                disabled={processingImages}
                onClick={() => setTab(item.value)}
              >
                <item.icon className='size-4' />
                {item.label}
              </Button>
            ))}
          </nav>
          {config.isPending && (
            <div className='flex justify-center p-16'>
              <Spinner />
            </div>
          )}
          {config.isError && (
            <ErrorState onRetry={() => void config.refetch()} />
          )}
          {config.data && (
            <>
              <div hidden={tab !== 'compose'}>
                <Form {...form}>
                  <form
                    className='space-y-5'
                    onSubmit={(event) => {
                      event.preventDefault()
                      beginSend(true)
                    }}
                  >
                    <fieldset
                      disabled={pendingSend !== null}
                      className='min-w-0 space-y-5'
                    >
                      <DeliverySettings
                        key={`delivery-settings-${revision}`}
                        form={form}
                        config={config.data}
                      />
                      <div className='flex flex-wrap items-center justify-between gap-3'>
                        <Label
                          htmlFor='notification-content'
                          className='text-base font-semibold'
                        >
                          {t('Message')}
                        </Label>
                        <div className='flex flex-wrap items-center gap-2'>
                          <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            disabled={processingImages}
                            onClick={openSave}
                          >
                            <BookOpen className='size-4' aria-hidden='true' />
                            {t('Save as template')}
                          </Button>
                        </div>
                      </div>
                      <MessageEditor
                        key={`message-editor-${revision}`}
                        message={message}
                        onChange={(value, images) => {
                          // Keep the attachment set and its references in one synchronous update.
                          if (images) {
                            form.setValue('images', images, {
                              shouldDirty: true,
                            })
                          }
                          form.setValue('content', value, {
                            shouldDirty: true,
                            shouldValidate: form.formState.isSubmitted,
                          })
                        }}
                        onProcessingChange={setProcessingImages}
                        onImagesChange={(value) => {
                          form.setValue('images', value, { shouldDirty: true })
                          if (form.formState.isSubmitted) {
                            void form.trigger(['content', 'images'])
                          }
                        }}
                        onSend={() => beginSend(!config.data.can_send)}
                        disabled={!canTest || pendingSend !== null}
                      />
                      {form.formState.errors.content && (
                        <p className='text-destructive text-sm' role='alert'>
                          {form.formState.errors.content.message}
                        </p>
                      )}
                      <div className='flex flex-wrap items-center justify-end gap-4 pt-1'>
                        <div className='flex flex-wrap gap-2'>
                          <Button
                            type='button'
                            variant='outline'
                            className='border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 min-w-32 rounded-lg px-5'
                            disabled={
                              !canTest ||
                              pendingSend !== null ||
                              processingImages
                            }
                            onClick={() => beginSend(true)}
                          >
                            <FlaskConical
                              className='size-4'
                              aria-hidden='true'
                            />
                            {t('Test notification')}
                          </Button>
                          {config.data.can_send && (
                            <Button
                              type='button'
                              className='min-w-32 rounded-lg px-5 shadow-sm'
                              disabled={
                                !config.data.can_send ||
                                !canTest ||
                                processingImages ||
                                pendingSend !== null
                              }
                              onClick={() => beginSend(false)}
                            >
                              <Send className='size-4' />
                              {t('Send notification')}
                            </Button>
                          )}
                        </div>
                        {!config.data.can_send && (
                          <p className='text-muted-foreground w-full text-xs'>
                            {t(
                              'You can send tests. Official notifications require an administrator.'
                            )}
                          </p>
                        )}
                      </div>
                    </fieldset>
                  </form>
                </Form>
              </div>
              {tab === 'templates' && (
                <NotificationLibrary
                  key={tab}
                  kind={tab}
                  onLoad={(entry, kind) => loadMessage(entry, kind)}
                  onCreate={() => loadMessage(null)}
                />
              )}
              {tab === 'history' && (
                <NotificationHistory
                  canSend={config.data.can_send}
                  canTest={canTest}
                  onClone={(value) =>
                    void loadMessage({
                      id: 0,
                      name: value.title,
                      message: value,
                      updated_at: Date.now(),
                    })
                  }
                />
              )}
            </>
          )}
        </div>
        {pendingSend && (
          <SendDialog
            {...pendingSend}
            onClose={() => setPendingSend(null)}
            onSent={() => {
              form.reset(structuredClone(EMPTY_MESSAGE))
              setSourceTemplate(null)
              setSaveName('')
              setIsPublic(false)
              setRevision((value) => value + 1)
              setPendingSend(null)
            }}
          />
        )}
        <ConfirmDialog
          open={pendingLoad !== null}
          onOpenChange={(open) => {
            if (!open) setPendingLoad(null)
          }}
          title={t('Discard changes')}
          desc={t(
            'Your current message will be replaced. Unsaved changes will be lost.'
          )}
          confirmText={t('Continue')}
          handleConfirm={() => {
            if (pendingLoad) {
              loadMessage(pendingLoad.entry, pendingLoad.kind, true)
            }
          }}
        />
        <Dialog
          open={saveOpen}
          onOpenChange={(open) => {
            if (!templateMutation.isPending) setSaveOpen(open)
          }}
          title={t('Save as template')}
          footer={
            <Button
              disabled={!saveName.trim() || templateMutation.isPending}
              onClick={() => void save()}
            >
              {t('Save')}
            </Button>
          }
        >
          <div className='space-y-5'>
            <div className='space-y-2'>
              <Label htmlFor='notification-save-name'>{t('Name')}</Label>
              <Input
                id='notification-save-name'
                value={saveName}
                maxLength={128}
                onChange={(event) => setSaveName(event.target.value)}
              />
            </div>
            {config.data?.can_send && (
              <div className='flex items-center justify-between'>
                <Label htmlFor='notification-public'>
                  {t('Public template')}
                </Label>
                <Switch
                  id='notification-public'
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                />
              </div>
            )}
          </div>
        </Dialog>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
