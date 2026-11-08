import { useSearch } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { useStatus } from '@/hooks/use-status'

import { AuthLayout } from '../auth-layout'
import { TermsFooter } from '../components/terms-footer'
import { UserAuthForm } from './components/user-auth-form'

export function SignIn() {
  const { t } = useTranslation()
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })
  const { status } = useStatus()
  const [loginTitleKey, setLoginTitleKey] = useState('Account sign in')

  return (
    <AuthLayout animatedBackground>
      <div className='relative isolate w-full space-y-8'>
        <div
          aria-hidden='true'
          className='pointer-events-none absolute -top-16 right-0 -z-10 size-48 rounded-full bg-blue-100/40 blur-3xl dark:bg-blue-500/10'
        />
        <Card
          data-card-hover='false'
          className='gap-6 overflow-visible rounded-none bg-transparent py-0 ring-0'
        >
          <CardHeader className='gap-3 px-0'>
            <h2 className='text-foreground text-[34px] leading-tight font-normal tracking-tight sm:text-[38px]'>
              {t('Welcome back')}
            </h2>
            <p className='text-muted-foreground text-lg leading-relaxed'>
              {t(loginTitleKey)}
            </p>
          </CardHeader>

          <CardContent className='px-0 py-0 sm:px-0 sm:py-0'>
            <UserAuthForm
              redirectTo={redirect}
              onLoginTitleChange={setLoginTitleKey}
            />
          </CardContent>
        </Card>

        <TermsFooter
          variant='sign-in'
          status={status}
          className='text-center'
        />
      </div>
    </AuthLayout>
  )
}
