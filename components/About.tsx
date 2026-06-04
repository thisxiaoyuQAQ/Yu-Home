'use client'

import { useIntersectionObserver } from '@/lib/hooks/useIntersectionObserver'

export default function About() {
  const { ref: sectionRef } = useIntersectionObserver<HTMLElement>({ threshold: 0.2 })
  const { ref: titleRef, isIntersecting: titleVisible } = useIntersectionObserver<HTMLHeadingElement>({ threshold: 0.5 })
  const { ref: contentRef, isIntersecting: contentVisible } = useIntersectionObserver<HTMLDivElement>({ threshold: 0.3 })

  return (
    <section
      ref={sectionRef}
      id="about"
      className="min-h-screen bg-black px-6 py-32 text-white"
    >
      <div className="mx-auto grid min-h-[70vh] max-w-6xl items-center gap-16 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="mb-6 font-mono text-xs uppercase tracking-[0.45em] text-white/40">01 / About</p>
          <h2
            ref={titleRef}
            className={`text-5xl font-semibold tracking-[-0.06em] transition-all duration-800 ease-out-expo md:text-7xl lg:text-8xl ${titleVisible ? 'translate-x-0 opacity-100' : '-translate-x-12 opacity-0'}`}
          >
            About
          </h2>
        </div>

        <div
          ref={contentRef}
          className={`border-l border-white/10 pl-8 transition-all delay-200 duration-800 ease-out-expo md:pl-12 ${contentVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}
        >
          <div className="space-y-7">
            <p className="text-2xl font-light leading-relaxed text-white/95 md:text-3xl">
              你好，我是 <span className="font-medium text-white">Zhi Yu</span>
            </p>
            <p className="text-2xl font-light leading-relaxed text-white/95 md:text-3xl">
              一名热爱技术与创意的开发者。
            </p>
            <p className="text-lg leading-relaxed text-white/60 md:text-xl">
              专注于构建优雅、高性能的数字产品，将复杂的技术转化为简洁直观的用户体验。
            </p>
            <p className="text-lg leading-relaxed text-white/60 md:text-xl">
              启蒙于 Minecraft，开发过 10+ 趣味性插件、整合包。
            </p>
            <p className="text-lg leading-relaxed text-white/60 md:text-xl">
              兴趣使然，自学软件开发、网络安全。
            </p>
          </div>

          <div className={`mt-14 grid grid-cols-3 border-y border-white/10 transition-all delay-500 duration-800 ease-out-expo ${contentVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
            <div className="py-7 pr-5">
              <div className="mb-2 text-4xl font-semibold text-white">5+</div>
              <div className="font-mono text-xs uppercase tracking-[0.28em] text-white/40">年经验</div>
            </div>
            <div className="border-x border-white/10 px-5 py-7">
              <div className="mb-2 text-4xl font-semibold text-white">10+</div>
              <div className="font-mono text-xs uppercase tracking-[0.28em] text-white/40">项目完成</div>
            </div>
            <div className="py-7 pl-5">
              <div className="mb-2 text-4xl font-semibold text-white">∞</div>
              <div className="font-mono text-xs uppercase tracking-[0.28em] text-white/40">学习热情</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
