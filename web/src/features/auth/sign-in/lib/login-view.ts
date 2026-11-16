export type LoginView = 'password' | 'oauth'

type LoginViewTitleKey = 'Account sign in' | 'Other sign in options'

export function getLoginViewTitleKey(activeView: LoginView): LoginViewTitleKey {
  if (activeView === 'oauth') {
    return 'Other sign in options'
  }
  return 'Account sign in'
}
