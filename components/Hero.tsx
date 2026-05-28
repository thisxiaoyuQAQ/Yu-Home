'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import FluidText from './FluidText'

const HeroParticles = dynamic(() => import('./HeroParticles'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-black" />
})

export default function Hero() {
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    setIsLoaded(true)
  }, [])

  return (
    <section className="relative h-screen w-full flex items-center justify-center overflow-hidden bg-black">
      <div className="absolute inset-0">
        <HeroParticles className="w-full h-full" />
      </div>
      
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent pointer-events-none z-[2]" />
      
      <div className="relative z-10 text-center px-6 pointer-events-none">
        <div className={`transition-all duration-1000 ease-out-expo ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <FluidText text="Zhi Yu" className="pointer-events-auto" />
        </div>
        
        <div className={`mt-6 transition-all duration-1000 delay-300 ease-out-expo ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <p
            className="text-lg md:text-xl tracking-widest uppercase font-light"
            style={{
              background: 'linear-gradient(90deg, #ffaa3c 0%, #ffd089 50%, #b89cff 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              textShadow: '0 0 30px rgba(255, 170, 60, 0.25)',
              filter: 'drop-shadow(0 0 12px rgba(184, 156, 255, 0.35))',
            }}
          >
            Developer &amp; Creator
          </p>
        </div>

        <div className={`mt-10 transition-all duration-1000 delay-500 ease-out-expo ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <p
            className="text-base md:text-lg tracking-[0.25em] font-light"
            style={{
              fontFamily: '"Noto Serif SC", "STSong", "KaiTi", serif',
              background: 'linear-gradient(90deg, rgba(255, 208, 137, 0.85) 0%, rgba(255, 235, 200, 0.95) 50%, rgba(200, 180, 255, 0.85) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 16px rgba(255, 180, 100, 0.3)) drop-shadow(0 0 24px rgba(160, 130, 255, 0.25))',
            }}
          >
            为天地立心，为生民立命，为往圣继绝学，为万世开太平
          </p>
        </div>

      </div>
      

      
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/[0.02] rounded-full blur-3xl animate-float pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-white/[0.02] rounded-full blur-3xl animate-float pointer-events-none" style={{ animationDelay: '-3s' }} />
    </section>
  )
}
