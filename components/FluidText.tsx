'use client'

import { useEffect, useRef, useState } from 'react'

interface FluidTextProps {
  text: string
  className?: string
}

export default function FluidText({ text, className = '' }: FluidTextProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 })
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    setMousePos({ x, y })
  }

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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
              in="SourceGraphic"
              in2="noise"
              scale={isHovered ? 25 : 12}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>

          <linearGradient id="hue-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#a855f7">
              <animate attributeName="stop-color" values="#a855f7;#6366f1;#0ea5e9;#a855f7" dur="6s" repeatCount="indefinite" />
            </stop>
            <stop offset="25%" stopColor="#6366f1">
              <animate attributeName="stop-color" values="#6366f1;#0ea5e9;#10b981;#6366f1" dur="6s" repeatCount="indefinite" />
            </stop>
            <stop offset="50%" stopColor="#0ea5e9">
              <animate attributeName="stop-color" values="#0ea5e9;#10b981;#eab308;#0ea5e9" dur="6s" repeatCount="indefinite" />
            </stop>
            <stop offset="75%" stopColor="#10b981">
              <animate attributeName="stop-color" values="#10b981;#eab308;#ec4899;#10b981" dur="6s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="#ec4899">
              <animate attributeName="stop-color" values="#ec4899;#a855f7;#6366f1;#ec4899" dur="6s" repeatCount="indefinite" />
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
          className="fluid-main text-7xl md:text-8xl lg:text-9xl font-black tracking-wide select-none italic"
          style={{
            filter: 'url(#fluid-filter)',
            background: 'linear-gradient(90deg, #a855f7, #6366f1, #0ea5e9, #10b981, #eab308, #ec4899, #a855f7)',
            backgroundSize: '300% 100%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'hue-rotate 6s linear infinite',
            transition: 'transform 0.4s ease, filter 0.3s ease',
            transform: isHovered ? 'scale(1.02)' : 'scale(1)',
          }}
        >
          {text}
        </h1>

        <h1
          className="absolute inset-0 text-7xl md:text-8xl lg:text-9xl font-black tracking-wide select-none italic"
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
          className="absolute inset-0 text-7xl md:text-8xl lg:text-9xl font-black tracking-wide select-none italic"
          style={{
            background: 'linear-gradient(90deg, #ec4899, #a855f7, #6366f1, #0ea5e9, #10b981)',
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
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at ${mousePos.x * 100}% ${mousePos.y * 100}%, rgba(255,255,255,0.3) 0%, transparent 40%)`,
            mixBlendMode: 'overlay',
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}
        />

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
