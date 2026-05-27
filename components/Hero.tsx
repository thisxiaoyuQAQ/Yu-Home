'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const ParticleCanvas = dynamic(() => import('./ParticleCanvas'), {
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
        <ParticleCanvas className="w-full h-full" />
      </div>
      
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/50 pointer-events-none" />
      
      <div className="relative z-10 text-center px-6 pointer-events-none">
        <div className={`transition-all duration-1000 ease-out-expo ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h1 className="text-7xl md:text-display-xl lg:text-display-2xl font-bold tracking-tighter text-gradient">
            Zhi Yu
          </h1>
        </div>
        
        <div className={`transition-all duration-1000 delay-200 ease-out-expo ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <p className="mt-6 text-lg md:text-xl lg:text-2xl text-white/60 font-light tracking-wide">
            Developer & Creator
          </p>
        </div>
        
        <div className={`mt-12 flex gap-4 justify-center transition-all duration-1000 delay-500 ease-out-expo ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <a 
            href="#about" 
            className="pointer-events-auto group relative px-8 py-3 border border-white/20 text-white/80 text-sm tracking-wider uppercase overflow-hidden transition-all duration-400 hover:border-white/40 hover:text-white"
          >
            <span className="relative z-10">探索更多</span>
            <div className="absolute inset-0 bg-white/5 translate-y-full group-hover:translate-y-0 transition-transform duration-400 ease-out-expo" />
          </a>
          <a 
            href="#contact" 
            className="pointer-events-auto group relative px-8 py-3 bg-white text-black text-sm tracking-wider uppercase overflow-hidden transition-all duration-400 hover:bg-white/90"
          >
            <span className="relative z-10">联系我</span>
          </a>
        </div>
      </div>
      
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 pointer-events-none">
        <div className={`transition-all duration-1000 delay-700 ease-out-expo ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div className="pointer-events-auto w-6 h-10 border-2 border-white/20 rounded-full flex justify-center hover:border-white/40 transition-colors duration-300 cursor-pointer">
            <div className="w-1 h-3 bg-white/50 rounded-full mt-2 animate-pulse-subtle" />
          </div>
        </div>
      </div>
      
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/[0.02] rounded-full blur-3xl animate-float pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-white/[0.02] rounded-full blur-3xl animate-float pointer-events-none" style={{ animationDelay: '-3s' }} />
    </section>
  )
}
