import { useSearch } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

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
    <AuthLayout>
      <div className='w-full space-y-8'>
        <div>
          <h2 className='text-2xl font-semibold tracking-tight'>
            {t(loginTitleKey)}
          </h2>
        </div>

        <UserAuthForm
          redirectTo={redirect}
          onLoginTitleChange={setLoginTitleKey}
        />

        <TermsFooter
          variant='sign-in'
          status={status}
          className='text-center'
        />
      </div>
    </AuthLayout>
  )
}
