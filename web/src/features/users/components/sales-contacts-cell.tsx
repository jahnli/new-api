import { useDemoMode } from '@/hooks/use-demo-mode'

import type { UserProfile } from '../types'
import { UserIdentityCell } from './user-identity-cell'

export function SalesContactsCell(props: {
  salesUsers?: UserProfile[]
  salesUser?: UserProfile
}) {
  const demoMode = useDemoMode()
  const contacts =
    props.salesUsers ?? (props.salesUser ? [props.salesUser] : [])
  if (contacts.length === 0) {
    return <span className='text-muted-foreground text-sm'>-</span>
  }
  return (
    <div className='flex flex-col gap-2'>
      {contacts.map((contact) => (
        <UserIdentityCell key={contact.id} user={contact} demoMode={demoMode} />
      ))}
    </div>
  )
}
