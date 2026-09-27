import { createSectionRegistry } from '@/features/system-settings/utils/section-registry'

/**
 * Security audit page section definitions.
 * Add new audit capabilities here as additional tabs.
 */
const SECURITY_AUDIT_SECTIONS = [
  {
    id: 'off-hours',
    titleKey: 'Unusual-hours auditing',
    build: () => null, // Content is rendered directly in the page component
  },
  {
    id: 'image-studio',
    titleKey: 'Image Audit',
    build: () => null, // Content is rendered directly in the page component
  },
] as const

export type SecurityAuditSectionId =
  (typeof SECURITY_AUDIT_SECTIONS)[number]['id']

const securityAuditRegistry = createSectionRegistry<
  SecurityAuditSectionId,
  Record<string, never>,
  []
>({
  sections: SECURITY_AUDIT_SECTIONS,
  defaultSection: 'off-hours',
  basePath: '/security-audit',
  urlStyle: 'path',
})

export const SECURITY_AUDIT_SECTION_IDS = securityAuditRegistry.sectionIds
export const SECURITY_AUDIT_DEFAULT_SECTION =
  securityAuditRegistry.defaultSection

/** Type guard for validating section IDs without casting. */
export function isSecurityAuditSectionId(
  s: string
): s is SecurityAuditSectionId {
  return (SECURITY_AUDIT_SECTION_IDS as readonly string[]).includes(s)
}
