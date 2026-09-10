import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { TFunction } from 'i18next'
import { useState } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { NotificationImagePicker } from '../components/notification-image-picker'
import {
  COMPANY_NOTIFICATION_DEFAULTS,
  getCompanyNotificationSchema,
  splitNotificationRecipients,
} from '../lib/notification-form'

const translate = ((key: string) => key) as TFunction

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('company notification validation', () => {
  test('requires a target for every selected channel in test mode', () => {
    const schema = getCompanyNotificationSchema(translate)
    const result = schema.safeParse({
      ...COMPANY_NOTIFICATION_DEFAULTS,
      company_id: '1',
      send_platform: true,
      test_mode: true,
      title: 'Test',
      content: 'Message',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['test_platform_ids'] }),
        ])
      )
    }
  })

  test('allows email-only delivery without selecting a company', () => {
    const schema = getCompanyNotificationSchema(translate)
    const result = schema.safeParse({
      ...COMPANY_NOTIFICATION_DEFAULTS,
      send_email: true,
      title: 'Email notice',
      content: 'Message',
    })

    expect(result.success).toBe(true)
  })

  test('requires a company only when platform delivery is enabled', () => {
    const schema = getCompanyNotificationSchema(translate)
    const result = schema.safeParse({
      ...COMPANY_NOTIFICATION_DEFAULTS,
      send_platform: true,
      title: 'Platform notice',
      content: 'Message',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['company_id'] }),
        ])
      )
    }
  })

  test('normalizes comma, semicolon, and line separated recipients', () => {
    expect(splitNotificationRecipients('first, second\nfirst; third ')).toEqual(
      ['first', 'second', 'third']
    )
  })
})

function ImagePickerHarness() {
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  return (
    <>
      <NotificationImagePicker
        files={files}
        onChange={setFiles}
        onError={setError}
      />
      {error ? <p>{error}</p> : null}
    </>
  )
}

describe('NotificationImagePicker', () => {
  test('previews an accepted image and lets the user remove it', async () => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:preview'),
      revokeObjectURL: vi.fn(),
    })
    const user = userEvent.setup()
    render(<ImagePickerHarness />)
    const file = new File(['png-data'], 'notice.png', { type: 'image/png' })

    await user.upload(screen.getByLabelText('Notification images'), file)
    expect(screen.getByRole('img', { name: 'notice.png' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove image' }))
    expect(
      screen.queryByRole('img', { name: 'notice.png' })
    ).not.toBeInTheDocument()
  })
})
