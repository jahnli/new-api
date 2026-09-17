import { Link } from '@tanstack/react-router'
import { BarChart3, Settings, Zap } from 'lucide-react'
import { Fragment } from 'react'
import { Trans, useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'

import { StepConnectionLine } from '../step-connection-line'

export function HowItWorks() {
  const { t } = useTranslation()

  const steps = [
    {
      num: '1',
      title: t('Configure'),
      desc: (
        <Trans i18nKey='Add your <1>API Keys</1>, set up channels and configure access permissions'>
          {'Add your '}
          <Link to='/keys' className='text-primary font-medium hover:underline'>
            API Keys
          </Link>
          , set up channels and configure access permissions
        </Trans>
      ),
      icon: <Settings className='size-6' strokeWidth={1.5} />,
    },
    {
      num: '2',
      title: t('Connect'),
      desc: (
        <>
          {t(
            'Connect through OpenAI, Claude, Gemini, and other compatible API routes'
          )}
          <span className='mt-1.5 flex items-center justify-center gap-1.5'>
            <span className='text-muted-foreground/50 text-xs'>
              {t('API Base URL')}:
            </span>
            <code className='text-primary/80 bg-primary/5 rounded px-1.5 py-0.5 text-xs font-medium'>
              {window.location.origin}
            </code>
          </span>
        </>
      ),
      icon: <Zap className='size-6' strokeWidth={1.5} />,
    },
    {
      num: '3',
      title: t('Monitor'),
      desc: t('Track usage, costs and performance with real-time analytics'),
      icon: <BarChart3 className='size-6' strokeWidth={1.5} />,
    },
  ]

  return (
    <section className='border-border/40 relative z-10 border-t px-6 py-12 md:py-16'>
      <div className='mx-auto max-w-7xl'>
        <AnimateInView className='mb-10 text-center md:mb-12'>
          <p className='text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase'>
            {t('How It Works')}
          </p>
          <h2 className='text-2xl font-bold tracking-tight md:text-3xl'>
            {t('Three steps to get started')}
          </h2>
        </AnimateInView>

        <div className='grid grid-cols-1 gap-8 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center md:gap-0'>
          {steps.map((step, i) => (
            <Fragment key={step.num}>
              <AnimateInView
                delay={i * 150}
                animation='fade-up'
                className='relative flex flex-col items-center text-center'
              >
                <div className='relative mb-6'>
                  <div className='text-muted-foreground border-border/50 bg-muted/30 flex size-16 items-center justify-center rounded-2xl border transition-colors'>
                    {step.icon}
                  </div>
                  <div className='bg-foreground text-background absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full text-xs font-bold'>
                    {step.num}
                  </div>
                </div>
                <h3 className='mb-2 text-base font-semibold'>{step.title}</h3>
                <p className='text-muted-foreground max-w-[280px] text-sm leading-relaxed'>
                  {step.desc}
                </p>
              </AnimateInView>
              {i < steps.length - 1 && (
                <div className='relative mx-2 hidden h-16 w-20 md:block lg:w-28'>
                  <StepConnectionLine index={i} />
                </div>
              )}
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  )
}
