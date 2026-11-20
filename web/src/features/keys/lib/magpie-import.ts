export const magpieApps = ['Codex', 'Claude', 'Gemini'] as const
export type MagpieApp = (typeof magpieApps)[number]

const endpoints = {
  Codex: { parameter: 'responses', path: '/v1' },
  Claude: { parameter: 'anthropic', path: '' },
  Gemini: { parameter: 'gemini', path: '/v1beta' },
} satisfies Record<MagpieApp, { parameter: string; path: string }>

export function buildMagpieImportUrl(options: {
  serverAddress: string
  tokenId: number
  fullKey: string
  name: string
  app: MagpieApp
  model: string
}): string | null {
  let address: URL
  try {
    address = new URL(options.serverAddress)
  } catch {
    return null
  }
  if (
    !['https:', 'http:'].includes(address.protocol) ||
    address.username ||
    address.password ||
    address.search ||
    address.hash
  ) {
    return null
  }

  const path = address.pathname
    .replace(/\/+$/, '')
    .replace(/\/(?:v1|v1beta)$/, '')
  const root = address.origin + path
  // Include the gateway path so installations sharing a host get distinct IDs.
  let siteHash = 0
  for (let i = 0; i < root.length; i++) {
    siteHash = (Math.imul(siteHash, 31) + root.charCodeAt(i)) >>> 0
  }
  const endpoint = endpoints[options.app]
  const params = new URLSearchParams({
    id: `gateway-${siteHash.toString(36)}-${options.tokenId}`,
    name: options.name.trim(),
    [endpoint.parameter]: root + endpoint.path,
    models: options.model,
    key: options.fullKey,
  })
  return `magpie://import?${params.toString()}`
}
