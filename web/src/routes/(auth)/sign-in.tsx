import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

import { sanitizeAuthRedirect } from '@/features/auth/lib/auth-redirect'
import { consumeOIDCLogoutReturn } from '@/features/auth/lib/oidc-logout'
import { SignIn } from '@/features/auth/sign-in'
import { resolveAuthentication } from '@/lib/auth-session'
import { useAuthStore } from '@/stores/auth-store'

const searchSchema = z.object({
  redirect: z.string().optional(),
  // Failed OAuth callbacks stay interactive instead of restarting authorization.
  auto_login: z.literal(false).optional().catch(undefined),
})

export const Route = createFileRoute('/(auth)/sign-in')({
  component: SignIn,
  validateSearch: searchSchema,
  beforeLoad: async ({ search, preload }) => {
    if (!preload && consumeOIDCLogoutReturn()) {
      throw redirect({
        to: '/',
        search: { signed_out: true },
        replace: true,
      })
    }

    // 根 guard 可能因为没有会话提示而跳过了 refresh。此处必须回源确认，
    // 否则持有有效 Refresh Cookie 的用户会被要求重新输入密码。
    await resolveAuthentication()

    const { auth } = useAuthStore.getState()

    // 如果已经有用户信息，说明已登录
    if (auth.user) {
      const target =
        sanitizeAuthRedirect(search?.redirect, window.location.origin) ??
        '/dashboard'
      throw redirect({ href: target, replace: true })
    }
  },
})
