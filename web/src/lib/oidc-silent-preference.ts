const STORAGE_KEY = 'new-api:oidc-silent-suppressed'
const LOGOUT_RETURN_KEY = 'new-api:oidc-logout-return'
let suppressed = false
let initialized = false

// Local-only logout stays suppressed until an explicit sign-in. Federated logout
// suppresses the return document only: a later reload may discover a new IdP
// session. Neither marker is authentication evidence.
export function suppressSilentOIDCLogin(): void {
  suppressed = true
  try {
    window.localStorage.setItem(STORAGE_KEY, 'local')
  } catch {
    // Keep the in-memory preference when browser storage is unavailable.
  }
}

// Called only when the user is actually navigating to the validated provider
// logout URL. Keep this document suppressed and skip the first return document.
export function prepareSilentOIDCLogoutReturn(): void {
  try {
    window.sessionStorage.setItem(LOGOUT_RETURN_KEY, '1')
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // If storage is unavailable, retain the safer local-logout suppression.
  }
}

export function resumeSilentOIDCLogin(): void {
  suppressed = false
  try {
    window.localStorage.removeItem(STORAGE_KEY)
    window.sessionStorage.removeItem(LOGOUT_RETURN_KEY)
  } catch {
    // The authenticated session still works without persistent storage.
  }
}

export function isSilentOIDCLoginSuppressed(): boolean {
  try {
    if (!initialized && window.parent === window) {
      initialized = true
      if (window.sessionStorage.getItem(LOGOUT_RETURN_KEY) === '1') {
        suppressed = true
        window.sessionStorage.removeItem(LOGOUT_RETURN_KEY)
      }
      // Older versions stored an indefinite flag even after successful single
      // sign-out. It contains no logout kind or expiry and must not block SSO
      // forever. New local-only logouts use the explicit "local" marker.
      if (window.localStorage.getItem(STORAGE_KEY) === '1') {
        window.localStorage.removeItem(STORAGE_KEY)
      }
    }
    return suppressed || window.localStorage.getItem(STORAGE_KEY) === 'local'
  } catch {
    return suppressed
  }
}
