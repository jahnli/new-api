import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { assert, describe, expect, test, vi } from 'vitest'

import type { UserColumnRow } from '../../types'
import { userNameColumn } from '../shared-user-columns'

vi.mock('@/lib/lobe-icon', () => ({
  getLobeIcon: () => null,
}))

const user: UserColumnRow = {
  id: 42,
  username: 'alice',
  display_name: 'Alice Example',
  avatar_url: 'https://example.com/alice.png',
  remark: 'Finance administrator',
  quota: 0,
  used_quota: 0,
  sub_quota_used: 0,
  sub_quota_total: 0,
  request_count: 0,
  group: 'default',
  status: 1,
  role: 1,
  open_id: 'ou_alice',
}

describe('shared username column visibility', () => {
  test('shows the primary user name with normal font weight', () => {
    const column = userNameColumn<UserColumnRow>((key) => key, false)
    const cell = column.cell
    assert.equal(typeof cell, 'function')
    if (typeof cell !== 'function') {
      throw new TypeError('Expected the username column to provide a cell')
    }

    const element = cell({ row: { original: user } } as never)
    const html = renderToStaticMarkup(element as ReactElement)

    expect(html).toMatch(/class="[^"]*font-normal[^"]*">Alice Example<\/div>/)
  })

  test('shows only the demo mask instead of user identity details in demo mode', () => {
    const column = userNameColumn<UserColumnRow>((key) => key, true)
    const cell = column.cell
    assert.equal(typeof cell, 'function')
    if (typeof cell !== 'function') {
      throw new TypeError('Expected the username column to provide a cell')
    }

    const element = cell({ row: { original: user } } as never)
    const html = renderToStaticMarkup(element as ReactElement)

    assert.match(html, /\*\*\*/)
    expect(html).toMatch(/font-normal/)
    expect(html).not.toMatch(/font-medium/)
    expect(html).not.toMatch(/alice/i)
    expect(html).not.toMatch(/Finance administrator/)
    expect(html).not.toMatch(/<img|<a/)
  })
})
