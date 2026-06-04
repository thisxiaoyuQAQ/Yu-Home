'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

const titleLetters = ['Z', 'h', 'i', ' ', 'Y', 'u']

export default function Hero() {
  const rootRef = useRef<HTMLElement>(null)
  const topRailRef = useRef<HTMLDivElement>(null)
  const subtitleRef = useRef<HTMLParagraphElement>(null)
  const titleWrapRef = useRef<HTMLHeadingElement>(null)
  const mottoLineRef = useRef<HTMLDivElement>(null)
  const mottoLabelRef = useRef<HTMLParagraphElement>(null)
  const mottoTextRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const root = rootRef.current

    if (!root || reduceMotion) {
      gsap.set(root?.querySelectorAll('[data-hero-reveal]') ?? [], { clearProps: 'all', autoAlpha: 1 })
      return
    }

    const ctx = gsap.context(() => {
      const letters = gsap.utils.toArray<HTMLElement>('[data-title-letter]')

      gsap.set([topRailRef.current, subtitleRef.current, mottoLabelRef.current, mottoTextRef.current], {
        autoAlpha: 0,
        y: 18,
      })
      gsap.set(letters, {
        autoAlpha: 0,
        yPercent: 115,
        rotateX: -18,
        transformOrigin: '50% 100%',
      })
      gsap.set(titleWrapRef.current, { autoAlpha: 1 })
      gsap.set(mottoLineRef.current, { scaleX: 0, transformOrigin: '0% 50%' })

      const timeline = gsap.timeline({ defaults: { ease: 'power4.out' } })

      timeline
        .to(topRailRef.current, { autoAlpha: 1, y: 0, duration: 0.8 })
        .to(subtitleRef.current, { autoAlpha: 1, y: 0, duration: 0.75 }, '-=0.42')
        .to(
          letters,
          {
            autoAlpha: 1,
            yPercent: 0,
            rotateX: 0,
            duration: 1.05,
            stagger: 0.055,
          },
          '-=0.28',
        )
        .to(mottoLineRef.current, { scaleX: 1, duration: 0.85 }, '-=0.38')
        .to(
          [mottoLabelRef.current, mottoTextRef.current],
          { autoAlpha: 1, y: 0, duration: 0.85, stagger: 0.08 },
          '-=0.58',
        )
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={rootRef} className="relative min-h-screen w-full overflow-hidden bg-black px-6 text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center">
        <div
          ref={topRailRef}
          data-hero-reveal
          className="mb-16 flex items-center justify-between border-b border-white/10 pb-5 font-mono text-[0.65rem] uppercase tracking-[0.45em] text-white/40"
        >
          <span>Yu Home</span>
          <span>Portfolio / 2026</span>
        </div>

        <div>
          <p
            ref={subtitleRef}
            data-hero-reveal
            className="mb-5 font-mono text-xs uppercase tracking-[0.5em] text-white/40 md:text-sm"
          >
            Developer &amp; Creator
          </p>

          <h1
            ref={titleWrapRef}
            data-hero-reveal
            className="flex overflow-hidden text-[clamp(4.5rem,17vw,13rem)] font-semibold leading-[0.86] tracking-[-0.08em] text-white opacity-0"
            aria-label="Zhi Yu"
          >
            {titleLetters.map((letter, index) => (
              <span
                key={`${letter}-${index}`}
                data-title-letter
                aria-hidden="true"
                className={letter === ' ' ? 'inline-block w-[0.22em]' : 'inline-block will-change-transform'}
              >
                {letter === ' ' ? ' ' : letter}
              </span>
            ))}
          </h1>
        </div>

        <div className="mt-12 grid gap-8 border-t border-white/10 pt-10 md:grid-cols-[auto_1fr]">
          <div ref={mottoLineRef} className="col-span-full -mt-10 h-px bg-white/25" />
          <p ref={mottoLabelRef} data-hero-reveal className="font-mono text-xs uppercase tracking-[0.45em] text-white/40">
            Motto
          </p>
          <p
            ref={mottoTextRef}
            data-hero-reveal
            className="whitespace-nowrap text-[clamp(0.86rem,2vw,1.5rem)] font-light leading-loose tracking-[0.08em] text-white/80 md:tracking-[0.12em]"
          >
            为天地立心，为生民立命，为往圣继绝学，为万世开太平
          </p>
        </div>
      </div>
    </section>
  )
}
