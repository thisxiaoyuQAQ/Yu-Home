'use client'

import dynamic from 'next/dynamic'
import { useIntersectionObserver } from '@/lib/hooks/useIntersectionObserver'

const ProjectsParticles = dynamic(() => import('./ProjectsParticles'), { ssr: false })

const projects = [
  {
    title: 'Yu-Blog',
    description: '由astro驱动的个人博客',
    tags: ['React', 'TypeScript', 'Tailwind'],
    image: '/projects/01.jpg',
  },/*
  {
    title: 'Project Two',
    description: '3D 可视化项目，探索 WebGL 技术的无限可能',
    tags: ['Three.js', 'WebGL', 'GLSL'],
    image: '/projects/02.jpg',
  },
  {
    title: 'Project Three',
    description: '全栈开发平台，打造端到端的解决方案',
    tags: ['Next.js', 'Node.js', 'PostgreSQL'],
    image: '/projects/03.jpg',
  },
  {
    title: 'Project Four',
    description: '移动端应用，提供流畅的跨平台体验',
    tags: ['React Native', 'TypeScript'],
    image: '/projects/04.jpg',
  },*/
]

function ProjectCard({ project, index, isVisible }: { project: typeof projects[0]; index: number; isVisible: boolean }) {
  const delay = index * 150

  return (
    <div 
      className={`group relative bg-card border border-white/5 overflow-hidden transition-all duration-600 ease-out-expo hover:border-white/20 hover-lift hover-glow ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="aspect-video bg-gray-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent z-10" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-6xl font-bold text-white/5 group-hover:text-white/10 transition-colors duration-500">
            0{index + 1}
          </span>
        </div>
      </div>
      
      <div className="p-6 relative">
        <h3 className="text-xl font-semibold mb-3 text-white/90 group-hover:text-white transition-colors duration-300">
          {project.title}
        </h3>
        <p className="text-white/50 text-sm leading-relaxed mb-5 group-hover:text-white/60 transition-colors duration-300">
          {project.description}
        </p>
        <div className="flex flex-wrap gap-2">
          {project.tags.map((tag) => (
            <span 
              key={tag}
              className="text-xs px-3 py-1.5 bg-white/5 text-white/50 rounded-full group-hover:bg-white/10 group-hover:text-white/70 transition-all duration-300"
            >
              {tag}
            </span>
          ))}
        </div>
        
        <div className="absolute right-6 top-6 w-8 h-8 flex items-center justify-center rounded-full border border-white/10 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:border-white/30">
          <svg className="w-4 h-4 text-white/60 -rotate-45 group-hover:rotate-0 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </div>
      </div>
    </div>
  )
}

export default function Projects() {
  const { ref: titleRef, isIntersecting: titleVisible } = useIntersectionObserver<HTMLDivElement>({ threshold: 0.5 })
  const { ref: gridRef, isIntersecting: gridVisible } = useIntersectionObserver<HTMLDivElement>({ threshold: 0.1 })

  return (
    <section id="projects" className="min-h-screen flex items-center justify-center px-6 py-32 bg-black relative overflow-hidden">
      <ProjectsParticles className="absolute inset-0 opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-t from-gray-950/30 via-black/50 to-black/50" />
      
      <div className="max-w-6xl w-full relative z-10">
        <div ref={titleRef} className="flex items-center gap-4 mb-16">
          <h2 
            className={`text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight transition-all duration-800 ease-out-expo ${titleVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'}`}
          >
            <span className="text-gradient">Projects</span>
          </h2>
          <div className={`h-px bg-gradient-to-r from-white/30 to-transparent flex-1 transition-all duration-1000 delay-300 ease-out-expo ${titleVisible ? 'opacity-100 scale-x-100 origin-left' : 'opacity-0 scale-x-0'}`} />
        </div>
        
        <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {projects.map((project, index) => (
            <ProjectCard 
              key={project.title} 
              project={project} 
              index={index} 
              isVisible={gridVisible}
            />
          ))}
        </div>
        
        <div className={`mt-12 text-center transition-all duration-800 delay-700 ease-out-expo ${gridVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <a 
            href="https://github.com" 
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-white/40 hover:text-white/80 transition-colors duration-300 group"
          >
            <span className="text-sm tracking-wider uppercase">查看更多项目</span>
            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  )
}
