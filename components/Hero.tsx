'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import FluidText from './FluidText'

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
      
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent pointer-events-none z-[2]" />
      
      <div className="relative z-10 text-center px-6 pointer-events-none">
        <div className={`transition-all duration-1000 ease-out-expo ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <FluidText text="Zhi Yu" className="pointer-events-auto" />
        </div>
        
        <div className={`mt-6 transition-all duration-1000 delay-300 ease-out-expo ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <p className="text-lg md:text-xl text-white/60 tracking-widest uppercase">Developer & Creator</p>
        </div>

      </div>
      

      
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/[0.02] rounded-full blur-3xl animate-float pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-white/[0.02] rounded-full blur-3xl animate-float pointer-events-none" style={{ animationDelay: '-3s' }} />
    </section>
  )
}
