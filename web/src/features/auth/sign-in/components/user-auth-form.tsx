import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import axios from 'axios'
import { Building2, KeyRound, Loader2, LogIn, UserRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { z } from 'zod'

import { Dialog } from '@/components/dialog'
import { PasswordInput } from '@/components/password-input'
import { Turnstile } from '@/components/turnstile'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { login, ldapLogin, wechatLoginByCode } from '@/features/auth/api'
import { LegalConsent } from '@/features/auth/components/legal-consent'
import { OAuthProviders } from '@/features/auth/components/oauth-providers'
import { loginFormSchema } from '@/features/auth/constants'
import { useAuthRedirect } from '@/features/auth/hooks/use-auth-redirect'
import { useTurnstile } from '@/features/auth/hooks/use-turnstile'
import { beginPasskeyLogin, finishPasskeyLogin } from '@/features/auth/passkey'
import type { AuthFormProps } from '@/features/auth/types'
import { useStatus } from '@/hooks/use-status'
import {
  buildAssertionResult,
  prepareCredentialRequestOptions,
  isPasskeySupported as detectPasskeySupport,
} from '@/lib/passkey'
import { getServerErrorMessageKey } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import { getLoginViewTitleKey, type LoginView } from '../lib/login-view'

type UserAuthFormProps = AuthFormProps & {
  onLoginTitleChange?: (loginTitleKey: string) => void
}

export function UserAuthForm({
  className,
  redirectTo,
  onLoginTitleChange,
  ...props
}: UserAuthFormProps) {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [wechatCode, setWeChatCode] = useState('')
  const [agreedToLegal, setAgreedToLegal] = useState(false)
  const [passkeySupported, setPasskeySupported] = useState(false)
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false)
  const [isWeChatDialogOpen, setIsWeChatDialogOpen] = useState(false)
  const [isWeChatSubmitting, setIsWeChatSubmitting] = useState(false)
  const [ldapUsername, setLdapUsername] = useState('')
  const [ldapPassword, setLdapPassword] = useState('')
  const [isLdapSubmitting, setIsLdapSubmitting] = useState(false)
  const [activeView, setActiveView] = useState<LoginView | null>(null)
  const [turnstileWidgetKey, setTurnstileWidgetKey] = useState(0)
  const legalConsentErrorMessage = t('Please agree to the legal terms first')
  const loginFailedMessage = t('Login failed')

  const { status } = useStatus()
  const passkeyLoginEnabled = Boolean(
    status?.passkey_login ?? status?.data?.passkey_login
  )
  const passwordLoginEnabled =
    (status?.password_login_enabled ??
      status?.data?.password_login_enabled ??
      true) !== false
  const passwordLoginEncryptionEnabled =
    (status?.password_login_encryption_enabled ??
      status?.data?.password_login_encryption_enabled ??
      false) === true
  const {
    isTurnstileEnabled,
    turnstileSiteKey,
    turnstileToken,
    setTurnstileToken,
    validateTurnstile,
  } = useTurnstile()
  const { handleLoginResult } = useAuthRedirect()

  const hasUserAgreement = Boolean(status?.user_agreement_enabled)
  const hasPrivacyPolicy = Boolean(status?.privacy_policy_enabled)
  const requiresLegalConsent = hasUserAgreement || hasPrivacyPolicy
  const passkeyButtonDisabled =
    isPasskeyLoading ||
    !passkeySupported ||
    (requiresLegalConsent && !agreedToLegal)
  const hasWeChatLogin = Boolean(status?.wechat_login)
  const hasLDAPLogin = Boolean(status?.ldap_enabled)
  const hasOAuthLogin = Boolean(
    status?.oidc_enabled || (status?.custom_oauth_providers?.length ?? 0) > 0
  )
  const hasAlternativeLogin =
    passkeyLoginEnabled || hasWeChatLogin || hasOAuthLogin

  useEffect(() => {
    if (status && activeView === null) {
      if (hasLDAPLogin) {
        setActiveView('ldap')
      } else if (hasAlternativeLogin && !passwordLoginEnabled) {
        setActiveView('oauth')
      } else {
        setActiveView('password')
      }
    }
  }, [
    status,
    activeView,
    hasLDAPLogin,
    hasAlternativeLogin,
    passwordLoginEnabled,
  ])

  useEffect(() => {
    if (activeView !== null) {
      onLoginTitleChange?.(getLoginViewTitleKey(activeView))
    }
  }, [activeView, onLoginTitleChange])

  useEffect(() => {
    if (requiresLegalConsent) {
      setAgreedToLegal(false)
    } else {
      setAgreedToLegal(true)
    }
  }, [requiresLegalConsent])

  useEffect(() => {
    detectPasskeySupport()
      .then(setPasskeySupported)
      .catch(() => setPasskeySupported(false))
  }, [])

  const form = useForm<z.infer<typeof loginFormSchema>>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  })

  const wechatQrCodeUrl = useMemo(() => {
    return (
      status?.wechat_qrcode ||
      status?.wechat_qr_code ||
      status?.wechat_qrcode_image_url ||
      status?.wechat_qr_code_image_url ||
      status?.wechat_account_qrcode_image_url ||
      status?.WeChatAccountQRCodeImageURL ||
      status?.data?.wechat_qrcode ||
      status?.data?.WeChatAccountQRCodeImageURL ||
      ''
    )
  }, [status])

  async function onSubmit(data: z.infer<typeof loginFormSchema>) {
    if (requiresLegalConsent && !agreedToLegal) {
      toast.error(legalConsentErrorMessage)
      return
    }

    if (!validateTurnstile()) return

    const submittedTurnstileToken = turnstileToken
    if (isTurnstileEnabled) {
      setTurnstileToken('')
      setTurnstileWidgetKey((current) => current + 1)
    }

    setIsLoading(true)
    try {
      const res = await login({
        username: data.username,
        password: data.password,
        turnstile: submittedTurnstileToken,
        passwordEncryptionEnabled: passwordLoginEncryptionEnabled,
      })

      if (res.success) {
        form.setValue('password', '')
        if (await handleLoginResult(res.data, redirectTo)) {
          toast.success(t('Welcome back!'))
        }
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) return
      toast.error(error instanceof Error ? error.message : loginFailedMessage)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleLdapSubmit() {
    if (requiresLegalConsent && !agreedToLegal) {
      toast.error(legalConsentErrorMessage)
      return
    }
    if (!ldapUsername.trim() || !ldapPassword) {
      toast.error(t('Username or password is empty'))
      return
    }
    if (!validateTurnstile()) return

    const submittedTurnstileToken = turnstileToken
    if (isTurnstileEnabled) {
      setTurnstileToken('')
      setTurnstileWidgetKey((current) => current + 1)
    }

    setIsLdapSubmitting(true)
    try {
      const res = await ldapLogin({
        username: ldapUsername.trim(),
        password: ldapPassword,
        turnstile: submittedTurnstileToken,
      })
      if (!res.success) {
        throw new Error(res.message || loginFailedMessage)
      }

      setLdapPassword('')
      if (await handleLoginResult(res.data, redirectTo)) {
        toast.success(t('Welcome back!'))
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) return
      toast.error(error instanceof Error ? error.message : loginFailedMessage)
    } finally {
      setIsLdapSubmitting(false)
    }
  }

  const handleOpenWeChatDialog = () => {
    if (requiresLegalConsent && !agreedToLegal) {
      toast.error(legalConsentErrorMessage)
      return
    }
    setIsWeChatDialogOpen(true)
  }

  const handleWeChatDialogChange = (open: boolean) => {
    setIsWeChatDialogOpen(open)
    if (!open) {
      setWeChatCode('')
      setIsWeChatSubmitting(false)
    }
  }

  async function handleWeChatLogin() {
    if (!wechatCode.trim()) {
      toast.error(t('Please enter the verification code'))
      return
    }

    setIsWeChatSubmitting(true)
    try {
      const res = await wechatLoginByCode(wechatCode)
      if (res?.success) {
        handleWeChatDialogChange(false)
        if (await handleLoginResult(res.data, redirectTo)) {
          toast.success(t('Signed in via WeChat'))
        }
      } else {
        if (getServerErrorMessageKey(res)) return
        toast.error(res?.message || loginFailedMessage)
      }
    } catch (error: unknown) {
      if (getServerErrorMessageKey(error)) return
      toast.error(loginFailedMessage)
    } finally {
      setIsWeChatSubmitting(false)
    }
  }

  async function handlePasskeyLogin() {
    if (requiresLegalConsent && !agreedToLegal) {
      toast.error(legalConsentErrorMessage)
      return
    }

    if (!passkeySupported) {
      toast.error(t('Passkey is not supported on this device'))
      return
    }

    if (!navigator?.credentials) {
      toast.error(t('Passkey is not available in this browser'))
      return
    }

    setIsPasskeyLoading(true)
    try {
      const begin = await beginPasskeyLogin()
      if (!begin.success) {
        if (getServerErrorMessageKey(begin)) return
        throw new Error(begin.message || t('Failed to start Passkey login'))
      }

      const publicKey = prepareCredentialRequestOptions(
        begin.data?.options ?? begin.data
      )
      const flowToken = begin.data?.flow_token
      if (!flowToken) {
        throw new Error(t('Login flow expired. Please sign in again.'))
      }

      const credential = (await navigator.credentials.get({
        publicKey,
      })) as PublicKeyCredential | null

      if (!credential) {
        toast.info(t('Passkey login was cancelled'))
        return
      }

      const assertion = buildAssertionResult(credential)
      if (!assertion) {
        throw new Error(t('Invalid Passkey response'))
      }

      const finish = await finishPasskeyLogin(flowToken, assertion)
      if (!finish.success) {
        if (getServerErrorMessageKey(finish)) return
        throw new Error(finish.message || t('Failed to complete Passkey login'))
      }

      if (await handleLoginResult(finish.data, redirectTo)) {
        toast.success(t('Signed in with Passkey'))
      }
    } catch (error: unknown) {
      if (getServerErrorMessageKey(error)) return
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        toast.info(t('Passkey login was cancelled or timed out'))
      } else if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error(t('Passkey login failed'))
      }
    } finally {
      setIsPasskeyLoading(false)
    }
  }

  const switchLinks = useMemo(() => {
    const links: { label: string; view: LoginView; icon?: React.ReactNode }[] =
      []
    if (activeView !== 'ldap' && hasLDAPLogin) {
      links.push({
        label: t('Enterprise account sign in'),
        view: 'ldap',
        icon: <Building2 className='h-4 w-4' />,
      })
    }
    if (activeView !== 'password' && passwordLoginEnabled) {
      links.push({
        label: t('Sign in with username or email'),
        view: 'password',
        icon: <UserRound className='h-4 w-4' />,
      })
    }
    if (activeView !== 'oauth' && hasAlternativeLogin) {
      links.push({
        label: t('Other sign in options'),
        view: 'oauth',
      })
    }
    return links
  }, [activeView, hasLDAPLogin, passwordLoginEnabled, hasAlternativeLogin, t])

  const renderSwitchLinks = () => {
    if (switchLinks.length === 0) return null
    return (
      <div className='space-y-3'>
        <div className='relative'>
          <div className='absolute inset-0 flex items-center'>
            <span className='w-full border-t' />
          </div>
          <div className='relative flex justify-center text-xs uppercase'>
            <span className='bg-background text-muted-foreground px-2'>
              {t('Or')}
            </span>
          </div>
        </div>
        <div className='flex flex-col gap-2'>
          {switchLinks.map((link) => (
            <Button
              key={link.view}
              type='button'
              variant='outline'
              className='w-full justify-center gap-2'
              onClick={() => setActiveView(link.view)}
            >
              {link.icon}
              {link.label}
            </Button>
          ))}
        </div>
      </div>
    )
  }

  const renderLdapForm = () => (
    <div className='grid gap-4'>
      <div className='grid gap-2'>
        <div className='flex items-baseline gap-2'>
          <Label htmlFor='ldap-username'>{t('Username')}</Label>
          <span className='text-muted-foreground text-xs'>
            {t('Example: {{example}}', { example: 'lijiaheng' })}
          </span>
        </div>
        <Input
          id='ldap-username'
          placeholder={t('Enter your username')}
          value={ldapUsername}
          onChange={(e) => setLdapUsername(e.target.value)}
          autoComplete='username'
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleLdapSubmit()
            }
          }}
        />
      </div>
      <div className='grid gap-2'>
        <Label htmlFor='ldap-password'>{t('Password')}</Label>
        <PasswordInput
          id='ldap-password'
          placeholder={t('Enter password')}
          value={ldapPassword}
          onChange={(e) => setLdapPassword(e.target.value)}
          autoComplete='current-password'
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleLdapSubmit()
            }
          }}
        />
      </div>

      <Button
        type='button'
        className='mt-2 w-full justify-center gap-2'
        disabled={isLdapSubmitting || (requiresLegalConsent && !agreedToLegal)}
        onClick={handleLdapSubmit}
      >
        {isLdapSubmitting ? <Loader2 className='animate-spin' /> : <LogIn />}
        {t('Sign in')}
      </Button>

      {isTurnstileEnabled && (
        <div className='mt-2'>
          <Turnstile
            key={turnstileWidgetKey}
            siteKey={turnstileSiteKey}
            onVerify={setTurnstileToken}
            onExpire={() => setTurnstileToken('')}
          />
        </div>
      )}
    </div>
  )

  const renderPasswordForm = () => (
    <>
      <FormField
        control={form.control}
        name='username'
        render={({ field }) => (
          <FormItem>
            <FormLabel className='h-4'>{t('Username or Email')}</FormLabel>
            <FormControl>
              <Input
                placeholder={t('Enter your username or email')}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name='password'
        render={({ field }) => (
          <FormItem className='relative'>
            <FormLabel>{t('Password')}</FormLabel>
            <FormControl>
              <PasswordInput placeholder={t('Enter password')} {...field} />
            </FormControl>
            <FormMessage />
            <Link
              to='/forgot-password'
              className='text-muted-foreground absolute end-0 -top-0.5 z-10 text-sm font-medium hover:opacity-75'
            >
              {t('Forgot password?')}
            </Link>
          </FormItem>
        )}
      />

      <Button
        type='submit'
        className='mt-2 w-full justify-center gap-2'
        disabled={isLoading || (requiresLegalConsent && !agreedToLegal)}
      >
        {isLoading ? <Loader2 className='animate-spin' /> : <LogIn />}
        {t('Sign in')}
      </Button>

      {isTurnstileEnabled && (
        <div className='mt-2'>
          <Turnstile
            key={turnstileWidgetKey}
            siteKey={turnstileSiteKey}
            onVerify={setTurnstileToken}
            onExpire={() => setTurnstileToken('')}
          />
        </div>
      )}
    </>
  )

  const renderOAuthView = () => (
    <div className='grid gap-4'>
      {passkeyLoginEnabled && (
        <div className='space-y-1'>
          <Button
            type='button'
            variant='outline'
            disabled={passkeyButtonDisabled}
            onClick={handlePasskeyLogin}
            className='h-11 w-full justify-center gap-2 rounded-lg'
          >
            {isPasskeyLoading ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <KeyRound className='h-4 w-4' />
            )}
            {t('Sign in with Passkey')}
          </Button>
          {!passkeySupported && (
            <p className='text-muted-foreground text-xs'>
              {t('Passkey is not supported on this device.')}
            </p>
          )}
        </div>
      )}

      <OAuthProviders
        status={status}
        redirectTo={redirectTo}
        disabled={isLoading || (requiresLegalConsent && !agreedToLegal)}
        onWeChatLogin={hasWeChatLogin ? handleOpenWeChatDialog : undefined}
        isWeChatLoading={isWeChatSubmitting}
      />
    </div>
  )

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-4', className)}
        {...props}
      >
        {activeView === 'ldap' && renderLdapForm()}
        {activeView === 'password' && renderPasswordForm()}
        {activeView === 'oauth' && renderOAuthView()}

        <LegalConsent
          status={status}
          checked={agreedToLegal}
          onCheckedChange={setAgreedToLegal}
          className='mt-1'
        />

        {renderSwitchLinks()}
      </form>

      {hasWeChatLogin && (
        <Dialog
          open={isWeChatDialogOpen}
          onOpenChange={handleWeChatDialogChange}
          title={t('WeChat sign in')}
          description={t(
            'Scan the QR code to follow the official account and reply with "验证码" to receive your verification code.'
          )}
          contentClassName='max-w-sm'
          headerClassName='text-left'
          contentHeight='auto'
          bodyClassName='space-y-4'
          footer={
            <>
              <Button
                type='button'
                variant='outline'
                onClick={() => handleWeChatDialogChange(false)}
                disabled={isWeChatSubmitting}
              >
                {t('Cancel')}
              </Button>
              <Button
                type='button'
                onClick={handleWeChatLogin}
                disabled={
                  isWeChatSubmitting ||
                  !wechatCode.trim() ||
                  (requiresLegalConsent && !agreedToLegal)
                }
                className='gap-2'
              >
                {isWeChatSubmitting ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : null}
                {t('Confirm')}
              </Button>
            </>
          }
        >
          {wechatQrCodeUrl ? (
            <div className='flex justify-center'>
              <img
                src={wechatQrCodeUrl}
                alt={t('WeChat login QR code')}
                className='h-40 w-40 rounded-md border object-contain'
              />
            </div>
          ) : (
            <p className='text-muted-foreground text-sm'>
              {t('QR code is not configured. Please contact support.')}
            </p>
          )}
          <div className='grid gap-2'>
            <Label htmlFor='wechat-code'>{t('Verification code')}</Label>
            <Input
              id='wechat-code'
              placeholder={t('Enter the verification code')}
              value={wechatCode}
              onChange={(event) => setWeChatCode(event.target.value)}
              autoComplete='one-time-code'
            />
          </div>
        </Dialog>
      )}
    </Form>
  )
}
