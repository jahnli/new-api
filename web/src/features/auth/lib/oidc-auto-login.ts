const OIDC_AUTO_LOGIN_SUSPENDED = 'oidc_auto_login_suspended'
const OIDC_AUTO_LOGIN_COOLDOWN_MS = 60_000

// This is a per-tab navigation guard, never proof of authentication. Failed
// callbacks and logout also use auto_login=false on the sign-in page. The
// cooldown prevents rapid redirect loops without blocking later SSO visits.
export function isOIDCAutoLoginSuspended(): boolean {
  try {
    const expiresAt = Number(
      window.sessionStorage.getItem(OIDC_AUTO_LOGIN_SUSPENDED)
    )
    // The old permanent value "1" is expired too, so existing tabs recover.
    return Number.isFinite(expiresAt) && expiresAt > Date.now()
  } catch {
    return true
  }
}

export function beginOIDCAutoLogin(): boolean {
  if (isOIDCAutoLoginSuspended()) return false
  try {
    window.sessionStorage.setItem(
      OIDC_AUTO_LOGIN_SUSPENDED,
      String(Date.now() + OIDC_AUTO_LOGIN_COOLDOWN_MS)
    )
    return true
  } catch {
    // Without durable loop protection, require an explicit login instead.
    return false
  }
}

export function suspendOIDCAutoLogin(): void {
  try {
    window.sessionStorage.setItem(
      OIDC_AUTO_LOGIN_SUSPENDED,
      String(Date.now() + OIDC_AUTO_LOGIN_COOLDOWN_MS)
    )
  } catch {
    // Automatic login already stays disabled when storage is unavailable.
  }
}

export function resetOIDCAutoLogin(): void {
  try {
    window.sessionStorage.removeItem(OIDC_AUTO_LOGIN_SUSPENDED)
  } catch {
    // Manual login remains available without storage.
  }
}
