export const OIDC_SILENT_CALLBACK_MESSAGE = 'new-api:oidc-silent-callback'

export function isOIDCSilentCallbackFrame(): boolean {
  return window.parent !== window && window.location.pathname === '/oauth/oidc'
}

export interface SilentOIDCCallback {
  type: typeof OIDC_SILENT_CALLBACK_MESSAGE
  state: string
  code: string
  error: string
}

export function postSilentOIDCCallback(): void {
  if (!isOIDCSilentCallbackFrame()) return
  const query = new URLSearchParams(window.location.search)
  const message: SilentOIDCCallback = {
    type: OIDC_SILENT_CALLBACK_MESSAGE,
    state: query.get('state') ?? '',
    code: query.get('code') ?? '',
    error: query.get('error') ?? '',
  }
  window.history.replaceState(null, '', window.location.pathname)
  window.parent.postMessage(message, window.location.origin)
}

// Hidden frames have no visible UI equivalent in the shared popup components.
// Only the exact frame and our own callback origin may deliver an OAuth result.
export function receiveSilentOIDCCallback(
  authorizationURL: string,
  state: string,
  signal: AbortSignal
): Promise<SilentOIDCCallback> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason)
      return
    }
    const frame = document.createElement('iframe')
    frame.hidden = true
    frame.tabIndex = -1
    frame.setAttribute('aria-hidden', 'true')
    frame.referrerPolicy = 'no-referrer'
    // An unsupported provider must not navigate the top-level page or open UI.
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms')
    const cleanup = () => {
      window.removeEventListener('message', onMessage)
      signal.removeEventListener('abort', onAbort)
      frame.remove()
    }
    const onAbort = () => {
      cleanup()
      reject(signal.reason)
    }
    const onMessage = (event: MessageEvent<unknown>) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== frame.contentWindow ||
        !event.data ||
        typeof event.data !== 'object'
      ) {
        return
      }
      const callback = event.data as Partial<SilentOIDCCallback>
      if (
        callback.type !== OIDC_SILENT_CALLBACK_MESSAGE ||
        callback.state !== state ||
        typeof callback.code !== 'string' ||
        typeof callback.error !== 'string' ||
        (!callback.code && !callback.error)
      ) {
        return
      }
      cleanup()
      resolve(callback as SilentOIDCCallback)
    }
    window.addEventListener('message', onMessage)
    signal.addEventListener('abort', onAbort, { once: true })
    frame.src = authorizationURL
    document.body.appendChild(frame)
  })
}
