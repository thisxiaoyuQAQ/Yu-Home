'use client'

import dynamic from 'next/dynamic'
import { useIntersectionObserver } from '@/lib/hooks/useIntersectionObserver'

const ProjectsParticles = dynamic(() => import('./ProjectsParticles'), { ssr: false })

const projects = [
  {
    title: 'Yu-Blog',
    description: '由astro驱动的个人博客',
    tags: ['React', 'TypeScript', 'Tailwind'],
    link: 'https://blog.zyuo.cn',
  },
  {
    title: 'FreeWord',
    description: '一个多语种背单词的平台',
    tags: ['React', 'TypeScript', 'Tailwind'],
    link: 'https://github.com/thisxiaoyuQAQ/FreeWord',
  },
  {
    title: 'PapiWebApi',
    description: 'Minecraft服务器插件，用于将 PlaceholderAPI 变量暴露为 Web API 接口',
    tags: ['Java', 'Bukkit'],
    link: 'https://github.com/thisxiaoyuQAQ/PapiWebApi',
  },
  {
    title: 'ChineseName',
    description: '初中时写的一个Minecraft中文名插件',
    tags: ['Java', 'Bukkit'],
    link: 'https://github.com/thisxiaoyuQAQ/chinesename',
  },
  {
    title: 'MyNav',
    description: '一个现代化、优雅且功能强大的个人浏览器导航页面',
    tags: ['React', 'TypeScript', 'Tailwind'],
    link: 'https://github.com/thisxiaoyuQAQ/MyNav',
  },
    {
    title: 'Sentry',
    description: '电脑监控系统，可以记录键盘操作、屏幕截图、屏幕录制和摄像头录制',
    tags: ['Rust', 'React', 'TypeScript'],
    link: 'https://github.com/thisxiaoyuQAQ/Sentry/settings',
  },  
]

function ProjectItem({ project, index, isVisible }: { project: typeof projects[0]; index: number; isVisible: boolean }) {
  const delay = index * 100

  return (
    <a 
      href={project.link}
      target={project.link !== '#' ? '_blank' : undefined}
      rel={project.link !== '#' ? 'noopener noreferrer' : undefined}
      className={`group relative border-b border-white/10 py-6 transition-all duration-500 ease-out-expo hover:bg-white/[0.02] hover:pl-4 cursor-pointer block ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-start gap-6 flex-1">
          <span className="text-white/20 text-sm font-mono mt-1 group-hover:text-white/40 transition-colors duration-300">
            {String(index + 1).padStart(2, '0')}
          </span>
          
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-2">
              <h3 className="text-xl md:text-2xl font-semibold text-white/90 group-hover:text-white transition-colors duration-300">
                {project.title}
              </h3>
              <div className="flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <span 
                    key={tag}
                    className="text-xs px-2 py-1 bg-white/5 text-white/40 rounded group-hover:bg-white/10 group-hover:text-white/60 transition-all duration-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-white/40 text-sm leading-relaxed group-hover:text-white/60 transition-colors duration-300">
              {project.description}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300">
          <span className="text-white/40 text-sm hidden md:block">View Project</span>
          <svg className="w-5 h-5 text-white/40 group-hover:text-white/80 group-hover:translate-x-1 transition-all duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </div>
      </div>
    </a>
  )
}

export default function Projects() {
  const { ref: titleRef, isIntersecting: titleVisible } = useIntersectionObserver<HTMLDivElement>({ threshold: 0.5 })
  const { ref: gridRef, isIntersecting: gridVisible } = useIntersectionObserver<HTMLDivElement>({ threshold: 0.1 })

  return (
    <section id="projects" className="min-h-screen flex items-center justify-center px-6 py-32 bg-black relative overflow-hidden">
      <ProjectsParticles className="absolute inset-0 z-0 opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-transparent z-[1] pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black to-transparent pointer-events-none z-[2]" />
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent pointer-events-none z-[2]" />
      
      <div className="max-w-6xl w-full relative z-10">
        <div ref={titleRef} className="flex items-center gap-4 mb-16">
          <h2 
            className={`text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight transition-all duration-800 ease-out-expo ${titleVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'}`}
          >
            <span className="text-gradient">Projects</span>
          </h2>
          <div className={`h-px bg-gradient-to-r from-white/30 to-transparent flex-1 transition-all duration-1000 delay-300 ease-out-expo ${titleVisible ? 'opacity-100 scale-x-100 origin-left' : 'opacity-0 scale-x-0'}`} />
        </div>
        
        <div ref={gridRef} className="flex flex-col">
          {projects.map((project, index) => (
            <ProjectItem 
              key={project.title} 
              project={project} 
              index={index} 
              isVisible={gridVisible}
            />
          ))}
        </div>
        
        <div className={`mt-12 text-center transition-all duration-800 delay-700 ease-out-expo ${gridVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <a 
            href="https://github.com/thisxiaoyuQAQ" 
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
