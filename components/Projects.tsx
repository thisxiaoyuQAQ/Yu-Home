'use client'

import { useIntersectionObserver } from '@/lib/hooks/useIntersectionObserver'

const projects = [
  {
    title: 'Yu-Blog',
    description: '由 astro 驱动的个人博客',
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
    description: 'Minecraft 服务器插件，用于将 PlaceholderAPI 变量暴露为 Web API 接口',
    tags: ['Java', 'Bukkit'],
    link: 'https://github.com/thisxiaoyuQAQ/PapiWebApi',
  },
  {
    title: 'ChineseName',
    description: '初中时写的一个 Minecraft 中文名插件',
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
    link: 'https://github.com/thisxiaoyuQAQ/Sentry',
  },
]

function ProjectItem({ project, index, isVisible }: { project: typeof projects[0]; index: number; isVisible: boolean }) {
  const delay = index * 100

  return (
    <a
      href={project.link}
      target={project.link !== '#' ? '_blank' : undefined}
      rel={project.link !== '#' ? 'noopener noreferrer' : undefined}
      className={`group block border-b border-white/10 py-7 transition-all duration-500 ease-out-expo hover:border-white/25 hover:bg-white/[0.025] md:hover:pl-4 ${isVisible ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="grid gap-5 md:grid-cols-[4rem_1fr_auto] md:items-start">
        <span className="font-mono text-sm text-white/20 transition-colors duration-300 group-hover:text-white/40">
          {String(index + 1).padStart(2, '0')}
        </span>

        <div>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h3 className="text-2xl font-medium tracking-[-0.03em] text-white/90 transition-colors duration-300 group-hover:text-white md:text-3xl">
              {project.title}
            </h3>
            <div className="flex flex-wrap gap-2">
              {project.tags.map((tag) => (
                <span
                  key={tag}
                  className="border border-white/10 px-2 py-1 text-[0.65rem] uppercase tracking-[0.18em] text-white/40 transition-all duration-300 group-hover:border-white/20 group-hover:text-white/55"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-white/55 transition-colors duration-300 group-hover:text-white/70">
            {project.description}
          </p>
        </div>

        <div className="flex items-center gap-3 text-sm uppercase tracking-[0.25em] text-white/30 transition-all duration-300 group-hover:text-white/70 md:opacity-0 md:group-hover:opacity-100">
          <span className="hidden md:block">View</span>
          <svg className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
    <section id="projects" className="min-h-screen bg-black px-6 py-32 text-white">
      <div className="mx-auto max-w-6xl">
        <div ref={titleRef} className="mb-16 flex items-end gap-6 border-b border-white/10 pb-8">
          <div>
            <p className="mb-6 font-mono text-xs uppercase tracking-[0.45em] text-white/40">03 / Projects</p>
            <h2 className={`text-5xl font-semibold tracking-[-0.06em] transition-all duration-800 ease-out-expo md:text-7xl lg:text-8xl ${titleVisible ? 'translate-x-0 opacity-100' : '-translate-x-12 opacity-0'}`}>
              Projects
            </h2>
          </div>
          <div className={`mb-4 h-px flex-1 bg-white/10 transition-all delay-300 duration-1000 ease-out-expo ${titleVisible ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0'} origin-left`} />
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

        <div className={`mt-12 text-center transition-all delay-700 duration-800 ease-out-expo ${gridVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
          <a
            href="https://github.com/thisxiaoyuQAQ"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm uppercase tracking-[0.28em] text-white/40 transition-colors duration-300 hover:text-white/80"
          >
            <span>查看更多项目</span>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  )
}
