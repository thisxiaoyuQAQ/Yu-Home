'use client'

import dynamic from 'next/dynamic'
import { useIntersectionObserver } from '@/lib/hooks/useIntersectionObserver'

const AboutParticles = dynamic(() => import('./AboutParticles'), { ssr: false })

export default function About() {
  const { ref: sectionRef, isIntersecting } = useIntersectionObserver<HTMLElement>({ threshold: 0.2 })
  const { ref: titleRef, isIntersecting: titleVisible } = useIntersectionObserver<HTMLHeadingElement>({ threshold: 0.5 })
  const { ref: contentRef, isIntersecting: contentVisible } = useIntersectionObserver<HTMLDivElement>({ threshold: 0.3 })

  return (
    <section 
      ref={sectionRef}
      id="about" 
      className="min-h-screen flex items-center justify-center px-6 py-32 bg-[#0a0010] relative overflow-hidden"
    >
      <AboutParticles className="absolute inset-0 z-0" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0010] via-transparent to-[#0a0010] pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#0a0010] to-transparent pointer-events-none z-[2]" />
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0010] to-transparent pointer-events-none z-[2]" />
      <div
        className="absolute inset-0 pointer-events-none z-[3]"
        style={{
          background:
            'radial-gradient(ellipse 55% 55% at 38% 50%, rgba(10,0,16,0.78) 0%, rgba(10,0,16,0.55) 40%, rgba(10,0,16,0) 75%)',
        }}
      />

      <div className="max-w-4xl relative z-10">
        <div className="flex items-center gap-4 mb-12">
          <h2
            ref={titleRef}
            className={`text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight transition-all duration-800 ease-out-expo ${titleVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'}`}
            style={{ textShadow: '0 2px 24px rgba(0,0,0,0.85), 0 0 40px rgba(10,0,16,0.6)' }}
          >
            <span className="text-gradient">About</span>
          </h2>
          <div className={`h-px bg-gradient-to-r from-white/30 to-transparent flex-1 transition-all duration-1000 delay-300 ease-out-expo ${titleVisible ? 'opacity-100 scale-x-100 origin-left' : 'opacity-0 scale-x-0'}`} />
        </div>

        <div
          ref={contentRef}
          className={`space-y-8 transition-all duration-800 delay-200 ease-out-expo ${contentVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
          style={{ textShadow: '0 1px 12px rgba(0,0,0,0.9), 0 0 24px rgba(10,0,16,0.7)' }}
        >
          <p className="text-xl md:text-2xl text-white/95 leading-relaxed font-light">
            你好，我是 <span className="text-white font-medium">Zhi Yu</span>，一名热爱技术与创意的开发者。
          </p>
          <p className="text-lg md:text-xl text-white/80 leading-relaxed">
            专注于构建优雅、高性能的数字产品，将复杂的技术转化为简洁直观的用户体验。
          </p>
          <p className="text-lg md:text-xl text-white/80 leading-relaxed">
            启蒙于Minecraft, 开发过10+趣味性插件, 整合包。
          </p>
          <p className="text-lg md:text-xl text-white/80 leading-relaxed">
            兴趣使然, 自学软件开发, 网络安全。
          </p>
          
          <div className={`pt-8 flex gap-6 transition-all duration-800 delay-500 ease-out-expo ${contentVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="group">
              <div className="text-4xl font-bold text-white mb-1 transition-transform duration-300 group-hover:scale-110">5+</div>
              <div className="text-sm text-white/40 uppercase tracking-wider">年经验</div>
            </div>
            <div className="w-px bg-white/10" />
            <div className="group">
              <div className="text-4xl font-bold text-white mb-1 transition-transform duration-300 group-hover:scale-110">10+</div>
              <div className="text-sm text-white/40 uppercase tracking-wider">项目完成</div>
            </div>
            <div className="w-px bg-white/10" />
            <div className="group">
              <div className="text-4xl font-bold text-white mb-1 transition-transform duration-300 group-hover:scale-110">∞</div>
              <div className="text-sm text-white/40 uppercase tracking-wider">学习热情</div>
            </div>
          </div>
        </div>
      </div>
      
    </section>
  )
}
