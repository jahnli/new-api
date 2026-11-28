/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { HTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

type LoaderIconProps = {
  size?: number
}

const LoaderIcon = ({ size = 16 }: LoaderIconProps) => {
  const { t } = useTranslation()
  return (
    <svg
      height={size}
      strokeLinejoin='round'
      style={{ color: 'currentcolor' }}
      viewBox='0 0 16 16'
      width={size}
    >
      <title>{t('Loader')}</title>
      <g clipPath='url(#clip0_2393_1490)'>
        <path d='M8 0V4' stroke='currentColor' strokeWidth='1.5' />
        <path
          d='M8 16V12'
          opacity='0.5'
          stroke='currentColor'
          strokeWidth='1.5'
        />
        <path
          d='M3.29773 1.52783L5.64887 4.7639'
          opacity='0.9'
          stroke='currentColor'
          strokeWidth='1.5'
        />
        <path
          d='M12.7023 1.52783L10.3511 4.7639'
          opacity='0.1'
          stroke='currentColor'
          strokeWidth='1.5'
        />
        <path
          d='M12.7023 14.472L10.3511 11.236'
          opacity='0.4'
          stroke='currentColor'
          strokeWidth='1.5'
        />
        <path
          d='M3.29773 14.472L5.64887 11.236'
          opacity='0.6'
          stroke='currentColor'
          strokeWidth='1.5'
        />
        <path
          d='M15.6085 5.52783L11.8043 6.7639'
          opacity='0.2'
          stroke='currentColor'
          strokeWidth='1.5'
        />
        <path
          d='M0.391602 10.472L4.19583 9.23598'
          opacity='0.7'
          stroke='currentColor'
          strokeWidth='1.5'
        />
        <path
          d='M15.6085 10.4722L11.8043 9.2361'
          opacity='0.3'
          stroke='currentColor'
          strokeWidth='1.5'
        />
        <path
          d='M0.391602 5.52783L4.19583 6.7639'
          opacity='0.8'
          stroke='currentColor'
          strokeWidth='1.5'
        />
      </g>
      <defs>
        <clipPath id='clip0_2393_1490'>
          <rect fill='white' height='16' width='16' />
        </clipPath>
      </defs>
    </svg>
  )
}

export type LoaderProps = HTMLAttributes<HTMLDivElement> & {
  size?: number
  variant?: 'spin' | 'dots'
}

export const Loader = ({
  className,
  size = 16,
  variant = 'spin',
  ...props
}: LoaderProps) => (
  <div
    className={cn(
      'inline-flex items-center justify-center',
      variant === 'spin' && 'animate-spin',
      variant === 'dots' && 'gap-1.5',
      className
    )}
    {...props}
  >
    {variant === 'dots' ? (
      <span
        className='flex items-center justify-center gap-[15%]'
        style={{ width: size, height: size }}
        aria-hidden='true'
      >
        <span className='size-[20%] shrink-0 rounded-full bg-current motion-safe:animate-bounce motion-safe:[animation-duration:1.2s]' />
        <span className='size-[20%] shrink-0 rounded-full bg-current motion-safe:animate-bounce motion-safe:[animation-delay:150ms] motion-safe:[animation-duration:1.2s]' />
        <span className='size-[20%] shrink-0 rounded-full bg-current motion-safe:animate-bounce motion-safe:[animation-delay:300ms] motion-safe:[animation-duration:1.2s]' />
      </span>
    ) : (
      <LoaderIcon size={size} />
    )}
  </div>
)
