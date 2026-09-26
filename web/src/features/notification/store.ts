import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface NotificationLayout {
  layout: Record<string, number>
  preview: boolean
  setLayout: (layout: Record<string, number>) => void
  setPreview: (preview: boolean) => void
}

export const useNotificationLayout = create<NotificationLayout>()(
  persist(
    (set) => ({
      layout: { editor: 60, preview: 40 },
      preview: true,
      setLayout: (layout) => {
        if (Number.isFinite(layout.editor) && Number.isFinite(layout.preview)) {
          set({ layout })
        }
      },
      setPreview: (preview) => set({ preview }),
    }),
    {
      name: 'notification-layout-v1',
      version: 1,
      migrate: (persistedState) => ({
        layout: { editor: 60, preview: 40 },
        preview: !(
          typeof persistedState === 'object' &&
          persistedState !== null &&
          'preview' in persistedState &&
          persistedState.preview === false
        ),
      }),
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          try {
            return localStorage.getItem(name)
          } catch {
            return null
          }
        },
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, value)
          } catch {
            /* Layout preferences are optional. */
          }
        },
        removeItem: (name) => {
          try {
            localStorage.removeItem(name)
          } catch {
            /* Layout preferences are optional. */
          }
        },
      })),
      partialize: (state) => ({ layout: state.layout, preview: state.preview }),
    }
  )
)
