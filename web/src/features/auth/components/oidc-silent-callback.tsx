import { useEffect } from 'react'

import { postSilentOIDCCallback } from '../lib/oidc-silent-transport'

// The frame carries only an authorization response. The parent retains the PKCE
// verifier and performs the exchange, so no session is created in this frame.
export function OIDCSilentCallback() {
  useEffect(() => {
    postSilentOIDCCallback()
  }, [])
  return null
}
