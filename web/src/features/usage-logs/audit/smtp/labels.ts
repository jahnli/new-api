import { useTranslation } from 'react-i18next'

export function useSMTPLabels() {
  const { t } = useTranslation()
  const statuses: Record<string, string> = {
    sending: t('Sending'),
    accepted: t('Accepted by SMTP server'),
    failed: t('Failed'),
    unknown: t('Unknown'),
  }
  const purposes: Record<string, string> = {
    registration: t('Registration'),
    password_reset: t('Password reset'),
    email_binding: t('Email binding'),
    email_binding_old: t('Previous email verification'),
    account_security: t('Account security'),
    quota_exceed: t('Low balance reminder'),
    subscription_premium_quota_insufficient: t(
      'Premium subscription quota reminder'
    ),
    channel_test: t('Channel test'),
    channel_update: t('Channel update'),
    notification: t('Notification'),
    unclassified: t('Unclassified'),
  }
  const stages: Record<string, string> = {
    build: t('Build message'),
    connect: t('Connect to SMTP server'),
    deadline: t('Set sending deadline'),
    tls: t('TLS handshake'),
    greeting: t('SMTP greeting'),
    starttls: t('Upgrade to TLS'),
    auth: t('Authentication'),
    mail_from: t('Submit sender'),
    rcpt_to: t('Submit recipient'),
    data: t('Begin message transfer'),
    write: t('Write message'),
    accept: t('Await server acceptance'),
    quit: t('Close SMTP session'),
  }
  const diagnostics: Record<string, string> = {
    smtp_rejected: t('SMTP server rejected the request'),
    timeout: t('SMTP operation timed out'),
    canceled: t('SMTP operation canceled'),
    dns_error: t('SMTP hostname lookup failed'),
    tls_certificate_error: t('TLS certificate verification failed'),
    connection_closed: t('SMTP connection closed unexpectedly'),
    network_error: t('SMTP network error'),
    delivery_unknown: t('Message acceptance is unknown'),
    operation_failed: t('SMTP operation failed'),
    smtp_not_configured: t('SMTP is not configured'),
    invalid_sender: t('Invalid sender address'),
    invalid_header: t('Invalid message header'),
    invalid_attachment: t('Invalid attachment'),
    starttls_not_supported: t('SMTP server does not support STARTTLS'),
    authentication_requires_tls: t('SMTP authentication requires TLS'),
    unsupported_auth_challenge: t('Unsupported SMTP authentication challenge'),
    invalid_recipient: t('Invalid recipient address'),
    invalid_message: t('Invalid message'),
    sender_interrupted: t('Sending process interrupted'),
    quit_failed_after_acceptance: t(
      'Session close failed after message acceptance'
    ),
    sender_interrupted_after_acceptance: t(
      'Sending process interrupted after message acceptance'
    ),
  }
  return {
    statuses,
    purposes,
    stageLabel: (code: string) => {
      const stage = /^rcpt_to_\d+$/.test(code) ? 'rcpt_to' : code
      return stages[stage] ? `${stages[stage]} (${code})` : code || '-'
    },
    diagnosticLabel: (code: string) =>
      diagnostics[code] ? `${diagnostics[code]} (${code})` : code || '-',
  }
}
