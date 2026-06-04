'use client'

import { useEffect, useState, useRef } from 'react'
import { useIntersectionObserver } from '@/lib/hooks/useIntersectionObserver'

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

  return (
    <div
      ref={barRef}
      className={`group transition-all duration-600 ease-out-expo ${isVisible ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0'}`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div className="mb-3 flex justify-between">
        <span className="font-medium tracking-wide text-white/90 transition-colors duration-300 group-hover:text-white">
          {skill.name}
        </span>
        <span className="font-mono text-sm tabular-nums text-white/40 transition-colors duration-300 group-hover:text-white/60">
          {skill.level}%
        </span>
      </div>
      <div className="h-px overflow-hidden bg-white/10">
        <div
          className="h-full bg-white transition-all duration-1000 ease-out-expo"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

export default function Skills() {
  const { ref: sectionRef } = useIntersectionObserver<HTMLElement>({ threshold: 0.1 })
  const { ref: titleRef, isIntersecting: titleVisible } = useIntersectionObserver<HTMLDivElement>({ threshold: 0.5 })
  const { ref: skillsRef, isIntersecting: skillsVisible } = useIntersectionObserver<HTMLDivElement>({ threshold: 0.2 })

  return (
    <section
      ref={sectionRef}
      id="skills"
      className="min-h-screen bg-black px-6 py-32 text-white"
    >
      <div className="mx-auto grid min-h-[70vh] max-w-6xl items-center gap-16 lg:grid-cols-[1.1fr_0.9fr]">
        <div ref={skillsRef} className="order-2 grid gap-9 lg:order-1">
          {skills.map((skill, index) => (
            <SkillBar
              key={skill.name}
              skill={skill}
              index={index}
              isVisible={skillsVisible}
            />
          ))}

          <div className={`mt-8 border-t border-white/10 pt-8 transition-all delay-700 duration-800 ease-out-expo ${skillsVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
            <p className="max-w-xl text-sm leading-relaxed text-white/40">
              持续学习新技术，保持对前沿领域的探索热情。相信工具服务于创意，技术成就想象。
            </p>
          </div>
        </div>

        <div ref={titleRef} className="order-1 text-right lg:order-2">
          <p className="mb-6 font-mono text-xs uppercase tracking-[0.45em] text-white/40">02 / Skills</p>
          <h2 className={`text-5xl font-semibold tracking-[-0.06em] transition-all duration-800 ease-out-expo md:text-7xl lg:text-8xl ${titleVisible ? 'translate-x-0 opacity-100' : 'translate-x-12 opacity-0'}`}>
            Skills
          </h2>
        </div>
      </div>
    </section>
  )
}
