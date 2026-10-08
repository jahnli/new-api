import { Info } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { PremiumPolicySettings } from './components/premium-policy-dialog'
import { SubscriptionsDialogs } from './components/subscriptions-dialogs'
import { SubscriptionsPrimaryButtons } from './components/subscriptions-primary-buttons'
import {
  SubscriptionsProvider,
  useSubscriptions,
} from './components/subscriptions-provider'
import { SubscriptionsTable } from './components/subscriptions-table'

function SubscriptionsContent() {
  const { t } = useTranslation()
  const { complianceConfirmed, complianceStatusLoading } = useSubscriptions()
  const [activeTab, setActiveTab] = useState('plans')

  return (
    <>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>
          {t('Subscription Management')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <div
            inert={activeTab !== 'plans'}
            aria-hidden={activeTab !== 'plans'}
            className={
              activeTab === 'plans'
                ? 'flex items-center gap-2'
                : 'invisible flex items-center gap-2'
            }
          >
            <Alert variant='default' className='hidden px-3 py-2 sm:flex'>
              <Info className='h-4 w-4' />
              <AlertDescription className='text-xs'>
                {t(
                  'Stripe/Creem requires creating products on the third-party platform and entering the ID'
                )}
              </AlertDescription>
            </Alert>
            <SubscriptionsPrimaryButtons />
          </div>
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className='h-full min-h-0 gap-4'
          >
            <TabsList className='max-w-full shrink-0 flex-wrap justify-start group-data-horizontal/tabs:h-auto'>
              <TabsTrigger value='plans'>{t('Subscription plans')}</TabsTrigger>
              <TabsTrigger value='quota-policy'>
                {t('Quota policy')}
              </TabsTrigger>
            </TabsList>
            <TabsContent
              value='plans'
              keepMounted
              className='flex min-h-0 flex-col gap-4 data-hidden:hidden'
            >
              {!complianceStatusLoading && !complianceConfirmed ? (
                <Alert variant='destructive' className='shrink-0'>
                  <AlertDescription>
                    {t(
                      'Subscription plan creation and changes are locked until the administrator confirms compliance terms in Payment Gateway settings.'
                    )}
                  </AlertDescription>
                </Alert>
              ) : null}
              <div className='min-h-0 flex-1'>
                <SubscriptionsTable active={activeTab === 'plans'} />
              </div>
            </TabsContent>
            <TabsContent
              value='quota-policy'
              keepMounted
              className='min-h-0 overflow-y-auto data-hidden:hidden'
            >
              <PremiumPolicySettings />
            </TabsContent>
          </Tabs>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <SubscriptionsDialogs />
    </>
  )
}

export function Subscriptions() {
  return (
    <SubscriptionsProvider>
      <SubscriptionsContent />
    </SubscriptionsProvider>
  )
}
