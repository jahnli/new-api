import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'

import { useMediaQuery } from '@/hooks/use-media-query'
import { getUserAvatarFallback } from '@/lib/avatar'
import { getRoleLabel } from '@/lib/roles'

import { getDisplayName } from '../lib'
import { createProfileCardTexture } from '../lib/lanyard-texture'
import type { UserProfile } from '../types'

const loadLanyard = () => import('@/components/Lanyard')
const Lanyard = lazy(loadLanyard)

// A failed optional 3D chunk must not take down the account settings page.
class LanyardBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export function ProfileLanyard(props: { profile: UserProfile }) {
  const { t } = useTranslation()
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [unavailable, setUnavailable] = useState(false)
  const [ready, setReady] = useState(false)
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string>()
  const avatarUrl = props.profile.avatar_url
  const [loadedAvatar, setLoadedAvatar] = useState<{
    url: string
    image: HTMLImageElement
  } | null>(null)
  useEffect(() => {
    if (reducedMotion) return
    // Download the 3D chunk alongside the avatar instead of waiting for it.
    void loadLanyard().catch(() => setUnavailable(true))
  }, [reducedMotion])
  useEffect(() => {
    if (!avatarUrl) return
    const image = new Image()
    // Canvas textures require CORS even when a normal <img> can show the URL.
    image.crossOrigin = 'anonymous'
    const onLoad = () => {
      if (image.naturalWidth && image.naturalHeight) {
        setLoadedAvatar({ url: avatarUrl, image })
      }
    }
    const onError = () => setFailedAvatarUrl(avatarUrl)
    image.addEventListener('load', onLoad)
    image.addEventListener('error', onError)
    image.src = avatarUrl
    return () => {
      image.removeEventListener('load', onLoad)
      image.removeEventListener('error', onError)
      image.removeAttribute('src')
    }
  }, [avatarUrl])
  const avatar =
    loadedAvatar?.url === avatarUrl ? loadedAvatar?.image : undefined
  const name = getDisplayName(props.profile)
  const username = props.profile.username
  const initials = getUserAvatarFallback(username || name)
  const role = getRoleLabel(props.profile.role)
  const userId = `${t('User ID')} ${props.profile.id}`
  const placeholderTexture = useMemo(() => {
    if (avatarUrl && failedAvatarUrl !== avatarUrl) return undefined
    return createProfileCardTexture({ name, username, initials, role, userId })
  }, [name, username, initials, role, userId, avatarUrl, failedAvatarUrl])
  // Reuse the loaded image in WebGL without another image load/decode cycle.
  const texture = avatar?.src || placeholderTexture
  const imageSource = avatar || placeholderTexture
  const fallback = (
    <div className='flex h-full flex-col items-center' aria-hidden='true'>
      <div className='h-12 w-5 shrink-0 bg-[#2979ff]' />
      {texture && (
        <img
          src={texture}
          alt=''
          width={192}
          height={270}
          className='h-[270px] w-48 rounded-xl object-cover shadow-xl ring-1 ring-black/10'
        />
      )}
    </div>
  )

  return (
    <div className='relative isolate h-[340px] overflow-hidden'>
      {(ready || (texture && (reducedMotion || unavailable))) && (
        <div className='pointer-events-none absolute inset-x-12 bottom-8 h-7 rounded-[50%] bg-blue-950/10 blur-xl dark:bg-black/30' />
      )}
      <LanyardBoundary fallback={fallback}>
        {texture &&
          (reducedMotion || unavailable ? (
            fallback
          ) : (
            <div className='relative h-full' aria-hidden='true'>
              <Suspense fallback={null}>
                <Lanyard
                  frontImage={imageSource}
                  backImage={imageSource}
                  cardColor='#f8fafc'
                  strapColor='#2979ff'
                  size={0.72}
                  strapLength={0.12}
                  damping={0.7}
                  breeze={0}
                  finish='matte'
                  className={ready ? 'visible' : 'invisible'}
                  onReady={() => setReady(true)}
                  onUnavailable={() => setUnavailable(true)}
                />
              </Suspense>
            </div>
          ))}
      </LanyardBoundary>
    </div>
  )
}
