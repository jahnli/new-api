import { assert, describe, test } from 'vitest'

import { getLoginViewTitleKey } from '../../lib/login-view'

describe('sign-in view title', () => {
  test('uses the account title for username or email sign-in', () => {
    assert.equal(getLoginViewTitleKey('password'), 'Account sign in')
  })

  test('uses the alternative sign-in title for OAuth options', () => {
    assert.equal(getLoginViewTitleKey('oauth'), 'Other sign in options')
  })
})
