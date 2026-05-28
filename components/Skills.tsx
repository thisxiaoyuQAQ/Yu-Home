'use client'

import { useIntersectionObserver } from '@/lib/hooks/useIntersectionObserver'
import { useEffect, useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import { skillsMouseState } from './SkillsParticles'

const SkillsParticles = dynamic(() => import('./SkillsParticles'), { ssr: false })

const skills = [
  { name: 'Java', level: 90 },
  { name: 'Python', level: 85 },
  { name: 'C++', level: 60 },
  { name: 'TypeScript', level: 50 },
  { name: 'JavaScript', level: 45 },
  { name: 'React', level: 35 },
]

function SkillBar({ skill, index, isVisible }: { skill: typeof skills[0]; index: number; isVisible: boolean }) {
  const [width, setWidth] = useState(0)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        setWidth(skill.level)
      }, index * 100)
      return () => clearTimeout(timer)
    }
  }, [isVisible, skill.level, index])

  const handleEnter = () => {
    if (!barRef.current) return
    const rect = barRef.current.getBoundingClientRect()
    skillsMouseState.hoverBarY = rect.top + rect.height / 2
    skillsMouseState.burstRequest += 1
  }

  return (
    <div
      ref={barRef}
      onMouseEnter={handleEnter}
      className={`group transition-all duration-600 ease-out-expo pointer-events-auto ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}
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
  const containerRef = useRef<HTMLElement>(null)

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    skillsMouseState.x = e.clientX - rect.left
    skillsMouseState.y = e.clientY - rect.top
  }

  const handleMouseEnter = () => {
    skillsMouseState.active = true
  }

  const handleMouseLeave = () => {
    skillsMouseState.active = false
  }

  return (
    <section 
      ref={(el) => {
        (sectionRef as React.MutableRefObject<HTMLElement | null>).current = el
        containerRef.current = el
      }}
      id="skills" 
      className="min-h-screen flex items-center justify-center px-6 py-32 bg-[#0a0010] relative overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <SkillsParticles className="absolute inset-0 w-full h-full opacity-70 z-0" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900/20 via-transparent to-[#0a0010]/30 pointer-events-none z-[1]" />
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#0a0010] to-transparent pointer-events-none z-[2]" />
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0010] to-transparent pointer-events-none z-[2]" />
      
      <div className="max-w-4xl w-full relative z-10 pointer-events-none">
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
