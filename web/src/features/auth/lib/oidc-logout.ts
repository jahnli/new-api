const OIDC_LOGOUT_RETURN = 'oidc_logout_return'

// A one-time navigation hint for this tab, never proof of session revocation.
// Keep UI-only query parameters out of the provider's registered return URL.
export function rememberOIDCLogoutReturn(): void {
  try {
    window.sessionStorage.setItem(OIDC_LOGOUT_RETURN, '1')
  } catch {
    // Provider logout still proceeds when browser storage is unavailable.
  }
}

export function consumeOIDCLogoutReturn(): boolean {
  try {
    const pending = window.sessionStorage.getItem(OIDC_LOGOUT_RETURN) === '1'
    window.sessionStorage.removeItem(OIDC_LOGOUT_RETURN)
    return pending
  } catch {
    return false
  }
}
