import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { getSubscribeAllCompanyOptions, subscribeAllUsers } from '../../api'
import { useSubscriptions } from '../subscriptions-provider'

export function SubscribeAllDialog() {
  const { t } = useTranslation()
  const { open, setOpen, currentRow, triggerRefresh } = useSubscriptions()
  const [loading, setLoading] = useState(false)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
    null
  )
  const isOpen = open === 'subscribe-all' && currentRow !== null
  const companiesQuery = useQuery({
    queryKey: ['subscription-admin-company-options'],
    queryFn: getSubscribeAllCompanyOptions,
    enabled: isOpen,
  })
  const companyOptions = companiesQuery.data?.data ?? []
  const selectItems = companyOptions.map((company) => ({
    label: company.alias || company.name,
    value: String(company.id),
  }))
  const selectedCompany = companyOptions.find(
    (company) => String(company.id) === selectedCompanyId
  )

  if (!isOpen || !currentRow) return null

  const handleConfirm = async () => {
    const companyId = Number(selectedCompanyId)
    if (!Number.isInteger(companyId) || companyId <= 0) {
      toast.error(t('Please select a company'))
      return
    }

    setLoading(true)
    try {
      const response = await subscribeAllUsers(currentRow.plan.id, companyId)
      if (response.success) {
        const result = response.data ?? { created: 0, skipped: 0, failed: 0 }
        toast.success(
          t(
            'Subscribe all users completed: created {{created}}, skipped {{skipped}}, failed {{failed}}',
            {
              created: result.created,
              skipped: result.skipped,
              failed: result.failed,
            }
          )
        )
        triggerRefresh()
        setSelectedCompanyId(null)
        setOpen(null)
      }
    } catch {
      toast.error(t('Operation failed'))
    } finally {
      setLoading(false)
    }
  }

  const companyLabel = selectedCompany?.alias || selectedCompany?.name
  const description = companyLabel
    ? t(
        'Only users in {{company}} with a currently effective subscription to {{plan}} will have it replaced with the latest total quota, preserving used quota. All other users will be skipped. Disabled and deleted users are included if eligible. Continue?',
        { company: companyLabel, plan: currentRow.plan.title }
      )
    : t(
        'Select a company to update only currently effective subscriptions to {{plan}}. Users without one will be skipped, and used quota will be preserved.',
        { plan: currentRow.plan.title }
      )

  return (
    <ConfirmDialog
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setSelectedCompanyId(null)
          setOpen(null)
        }
      }}
      className='min-h-80 sm:max-w-2xl [&_[data-slot=alert-dialog-footer]]:mt-auto'
      title={t('Subscribe all users')}
      desc={description}
      handleConfirm={handleConfirm}
      isLoading={loading}
      disabled={
        companiesQuery.isPending ||
        companiesQuery.isError ||
        companyOptions.length === 0 ||
        selectedCompanyId === null
      }
      confirmText={t('Confirm subscribe all users')}
    >
      <div className='grid gap-2'>
        <Label htmlFor='subscribe-all-company'>{t('Company')}</Label>
        <Select
          items={selectItems}
          value={selectedCompanyId}
          onValueChange={setSelectedCompanyId}
          disabled={companiesQuery.isPending || companiesQuery.isError}
        >
          <SelectTrigger id='subscribe-all-company' className='w-full'>
            <SelectValue placeholder={t('Select company')} />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {selectItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {companiesQuery.isError && (
          <p className='text-destructive text-sm' role='alert'>
            {t('Failed to load company options')}
          </p>
        )}
        {!companiesQuery.isPending &&
          !companiesQuery.isError &&
          companyOptions.length === 0 && (
            <p className='text-muted-foreground text-sm'>
              {t('No enabled companies available')}
            </p>
          )}
      </div>
    </ConfirmDialog>
  )
}
