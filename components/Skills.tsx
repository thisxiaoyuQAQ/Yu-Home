'use client'

import { useIntersectionObserver } from '@/lib/hooks/useIntersectionObserver'
import { useEffect, useState } from 'react'

const skills = [
  { name: 'TypeScript', level: 90 },
  { name: 'React / Next.js', level: 85 },
  { name: 'Node.js', level: 80 },
  { name: 'Three.js', level: 75 },
  { name: 'Tailwind CSS', level: 90 },
  { name: 'Python', level: 70 },
]

function SkillBar({ skill, index, isVisible }: { skill: typeof skills[0]; index: number; isVisible: boolean }) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        setWidth(skill.level)
      }, index * 100)
      return () => clearTimeout(timer)
    }
  }, [isVisible, skill.level, index])

  return (
    <div 
      className={`group transition-all duration-600 ease-out-expo ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div className="flex justify-between mb-3">
        <span className="text-white/90 font-medium tracking-wide group-hover:text-white transition-colors duration-300">
          {skill.name}
        </span>
        <span className="text-white/40 text-sm tabular-nums group-hover:text-white/60 transition-colors duration-300">
          {skill.level}%
        </span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-white/80 to-white/40 rounded-full transition-all duration-1000 ease-out-expo"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

export default function Skills() {
  const { ref: sectionRef, isIntersecting } = useIntersectionObserver<HTMLElement>({ threshold: 0.1 })
  const { ref: titleRef, isIntersecting: titleVisible } = useIntersectionObserver<HTMLDivElement>({ threshold: 0.5 })
  const { ref: skillsRef, isIntersecting: skillsVisible } = useIntersectionObserver<HTMLDivElement>({ threshold: 0.2 })

  return (
    <section 
      ref={sectionRef}
      id="skills" 
      className="min-h-screen flex items-center justify-center px-6 py-32 bg-black relative"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900/20 via-black to-black" />
      
      <div className="max-w-4xl w-full relative z-10">
        <div ref={titleRef} className="flex items-center gap-4 mb-16">
          <div className={`h-px bg-gradient-to-l from-white/30 to-transparent flex-1 transition-all duration-1000 ease-out-expo ${titleVisible ? 'opacity-100 scale-x-100 origin-right' : 'opacity-0 scale-x-0'}`} />
          <h2 
            className={`text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight transition-all duration-800 ease-out-expo ${titleVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'}`}
          >
            <span className="text-gradient">Skills</span>
          </h2>
        </div>
        
        <div ref={skillsRef} className="grid gap-8">
          {skills.map((skill, index) => (
            <SkillBar 
              key={skill.name} 
              skill={skill} 
              index={index} 
              isVisible={skillsVisible} 
            />
          ))}
        </div>
        
        <div className={`mt-16 pt-8 border-t border-white/5 transition-all duration-800 delay-700 ease-out-expo ${skillsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <p className="text-white/40 text-sm leading-relaxed">
            持续学习新技术，保持对前沿领域的探索热情。相信工具服务于创意，技术成就想象。
          </p>
        </div>
      </div>
    </section>
  )
}
