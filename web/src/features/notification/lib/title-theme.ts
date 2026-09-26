export const NOTIFICATION_TITLE_THEMES = [
  'blue',
  'wathet',
  'turquoise',
  'green',
  'yellow',
  'orange',
  'red',
  'carmine',
  'violet',
  'purple',
  'indigo',
  'grey',
  'default',
] as const

export type NotificationTitleTheme = (typeof NOTIFICATION_TITLE_THEMES)[number]

// Approximate the provider's header colors in both local preview surfaces.
export const NOTIFICATION_TITLE_THEME_CLASSES: Record<
  NotificationTitleTheme,
  string
> = {
  blue: 'bg-linear-to-r from-[#e1e9ff] via-[#f0f4ff] to-[#e1e9ff] text-[#245bdb] dark:from-blue-950 dark:via-slate-900 dark:to-blue-950 dark:text-blue-100',
  wathet:
    'bg-linear-to-r from-sky-100 via-sky-50 to-sky-100 text-sky-900 dark:from-sky-950 dark:via-slate-900 dark:to-sky-950 dark:text-sky-100',
  turquoise:
    'bg-linear-to-r from-teal-100 via-teal-50 to-teal-100 text-teal-900 dark:from-teal-950 dark:via-slate-900 dark:to-teal-950 dark:text-teal-100',
  green:
    'bg-linear-to-r from-green-100 via-green-50 to-green-100 text-green-900 dark:from-green-950 dark:via-slate-900 dark:to-green-950 dark:text-green-100',
  yellow:
    'bg-linear-to-r from-yellow-100 via-yellow-50 to-yellow-100 text-yellow-900 dark:from-yellow-950 dark:via-slate-900 dark:to-yellow-950 dark:text-yellow-100',
  orange:
    'bg-linear-to-r from-orange-100 via-orange-50 to-orange-100 text-orange-900 dark:from-orange-950 dark:via-slate-900 dark:to-orange-950 dark:text-orange-100',
  red: 'bg-linear-to-r from-red-100 via-red-50 to-red-100 text-red-900 dark:from-red-950 dark:via-slate-900 dark:to-red-950 dark:text-red-100',
  carmine:
    'bg-linear-to-r from-rose-100 via-rose-50 to-rose-100 text-rose-900 dark:from-rose-950 dark:via-slate-900 dark:to-rose-950 dark:text-rose-100',
  violet:
    'bg-linear-to-r from-fuchsia-100 via-fuchsia-50 to-fuchsia-100 text-fuchsia-900 dark:from-fuchsia-950 dark:via-slate-900 dark:to-fuchsia-950 dark:text-fuchsia-100',
  purple:
    'bg-linear-to-r from-purple-100 via-purple-50 to-purple-100 text-purple-900 dark:from-purple-950 dark:via-slate-900 dark:to-purple-950 dark:text-purple-100',
  indigo:
    'bg-linear-to-r from-indigo-100 via-indigo-50 to-indigo-100 text-indigo-900 dark:from-indigo-950 dark:via-slate-900 dark:to-indigo-950 dark:text-indigo-100',
  grey: 'bg-linear-to-r from-gray-100 via-gray-50 to-gray-100 text-gray-900 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 dark:text-gray-100',
  default: 'bg-background text-foreground',
}
