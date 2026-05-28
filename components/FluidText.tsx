'use client'

import { useEffect, useRef } from 'react'

interface FluidTextProps {
  text: string
  className?: string
}

// Hover transitions are hand-driven (rAF + critical-damping) because the
// thing that actually morphs the text — <feDisplacementMap scale> — isn't
// CSS-transitionable. Toggling it with React state was the source of the
// snap you saw on enter/leave.
const REST_SCALE = 12
const HOVER_SCALE = 28
const SMOOTHING = 0.12   // 0 = frozen, 1 = instant

export default function FluidText({ text, className = '' }: FluidTextProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const displaceRef = useRef<SVGFEDisplacementMapElement>(null)
  const mainTextRef = useRef<HTMLHeadingElement>(null)
  const targetScaleRef = useRef(REST_SCALE)
  const currentScaleRef = useRef(REST_SCALE)
  const rafRef = useRef<number | null>(null)

  // Single rAF loop that eases the displacement scale toward its target.
  useEffect(() => {
    const tick = () => {
      const next =
        currentScaleRef.current +
        (targetScaleRef.current - currentScaleRef.current) * SMOOTHING
      currentScaleRef.current = next
      if (displaceRef.current) {
        displaceRef.current.setAttribute('scale', next.toFixed(3))
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const handleEnter = () => {
    targetScaleRef.current = HOVER_SCALE
    if (mainTextRef.current) {
      mainTextRef.current.style.letterSpacing = '0.18em'
    }
  }
  const handleLeave = () => {
    targetScaleRef.current = REST_SCALE
    if (mainTextRef.current) {
      mainTextRef.current.style.letterSpacing = '0.15em'
    }
  }

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={{ cursor: 'default' }}
    >
      <svg className="absolute w-0 h-0">
        <defs>
          <filter id="fluid-filter">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.006"
              numOctaves="4"
              seed="2"
              result="noise"
            >
              <animate
                attributeName="baseFrequency"
                values="0.006;0.012;0.006"
                dur="8s"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap
              ref={displaceRef}
              in="SourceGraphic"
              in2="noise"
              scale={REST_SCALE}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>

          <linearGradient id="hue-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff">
              <animate attributeName="stop-color" values="#ffffff;#e0e0e0;#808080;#ffffff" dur="6s" repeatCount="indefinite" />
            </stop>
            <stop offset="25%" stopColor="#e0e0e0">
              <animate attributeName="stop-color" values="#e0e0e0;#808080;#404040;#e0e0e0" dur="6s" repeatCount="indefinite" />
            </stop>
            <stop offset="50%" stopColor="#808080">
              <animate attributeName="stop-color" values="#808080;#404040;#e0e0e0;#808080" dur="6s" repeatCount="indefinite" />
            </stop>
            <stop offset="75%" stopColor="#404040">
              <animate attributeName="stop-color" values="#404040;#e0e0e0;#ffffff;#404040" dur="6s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="#ffffff">
              <animate attributeName="stop-color" values="#ffffff;#808080;#e0e0e0;#ffffff" dur="6s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
        </defs>
      </svg>

      <div
        className="relative"
        style={{
          transform: 'skewX(-6deg)',
          transformOrigin: 'center center',
        }}
      >
        <h1
          ref={mainTextRef}
          className="fluid-main text-[9rem] md:text-[12rem] lg:text-[16rem] font-black tracking-[0.15em] select-none italic"
          style={{
            filter: 'url(#fluid-filter)',
            background: 'linear-gradient(90deg, #ffffff, #e0e0e0, #808080, #404040, #808080, #e0e0e0, #ffffff)',
            backgroundSize: '300% 100%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'hue-rotate 6s linear infinite',
            transition: 'letter-spacing 700ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {text}
        </h1>

        <h1
          className="absolute inset-0 text-[9rem] md:text-[12rem] lg:text-[16rem] font-black tracking-[0.15em] select-none italic"
          style={{
            background: 'linear-gradient(90deg, #a855f7, #6366f1, #0ea5e9, #10b981, #ec4899)',
            backgroundSize: '300% 100%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'hue-rotate 6s linear infinite, glow-pulse 3s ease-in-out infinite',
            filter: 'blur(20px)',
            opacity: 0.5,
          }}
        >
          {text}
        </h1>

        <h1
          className="absolute inset-0 text-[9rem] md:text-[12rem] lg:text-[16rem] font-black tracking-[0.15em] select-none italic"
          style={{
            background: 'linear-gradient(90deg, #404040, #808080, #c0c0c0, #ffffff, #e0e0e0)',
            backgroundSize: '300% 100%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'hue-rotate-reverse 8s linear infinite',
            filter: 'blur(40px)',
            opacity: 0.3,
          }}
        >
          {text}
        </h1>

        <div
          className="absolute -inset-4 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
            animation: 'shimmer 3s ease-in-out infinite',
            transform: 'skewX(-20deg)',
          }}
        />
      </div>

      <style jsx>{`
        @keyframes hue-rotate {
          0% {
            background-position: 0% 50%;
          }
          100% {
            background-position: 300% 50%;
          }
        }

        @keyframes hue-rotate-reverse {
          0% {
            background-position: 300% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        @keyframes glow-pulse {
          0%, 100% {
            opacity: 0.4;
          }
          50% {
            opacity: 0.7;
          }
        }

        @keyframes shimmer {
          0%, 100% {
            transform: skewX(-20deg) translateX(-200%);
            opacity: 0;
          }
          50% {
            transform: skewX(-20deg) translateX(200%);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}
