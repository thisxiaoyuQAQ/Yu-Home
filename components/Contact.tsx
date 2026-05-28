'use client'

import dynamic from 'next/dynamic'
import { useIntersectionObserver } from '@/lib/hooks/useIntersectionObserver'

const ContactParticles = dynamic(() => import('./ContactParticles'), { ssr: false })

const contacts = [
  { label: 'Email', value: 'starleapxy@gmail.com', href: 'mailto:starleapxy@gmail.com', icon: '✉' },
  { label: 'GitHub', value: 'thisxiaoyuQAQ', href: 'https://github.com/thisxiaoyuQAQ', icon: '⌘' },
  { label: 'WeChat', value: 'starleap_xiaoyu', href: '#', icon: '💬' },
]

export default function Contact() {
  const { ref: titleRef, isIntersecting: titleVisible } = useIntersectionObserver<HTMLDivElement>({ threshold: 0.5 })
  const { ref: contentRef, isIntersecting: contentVisible } = useIntersectionObserver<HTMLDivElement>({ threshold: 0.3 })
  const { ref: linksRef, isIntersecting: linksVisible } = useIntersectionObserver<HTMLDivElement>({ threshold: 0.2 })

  return (
    <section id="contact" className="min-h-screen flex items-center justify-center px-6 py-32 bg-[#0a0010] relative overflow-hidden">
      <ContactParticles />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-gray-900/30 via-[#0a0010] to-[#0a0010] pointer-events-none" />
      
      <div className="max-w-4xl w-full text-center relative z-10">
        <div ref={titleRef}>
          <h2 
            className={`text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 transition-all duration-800 ease-out-expo ${titleVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
          >
            <span className="text-gradient">Contact Me</span>
          </h2>
        </div>
        
        <div ref={contentRef}>
          <p className={`text-white/50 text-lg md:text-xl mb-16 max-w-xl mx-auto leading-relaxed transition-all duration-800 delay-200 ease-out-expo ${contentVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            想和我聊聊? 欢迎随时联系。
          </p>
        </div>
        
        <div ref={linksRef} className="space-y-4 max-w-md mx-auto">
          {contacts.map((contact, index) => (
            <a
              key={contact.label}
              href={contact.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`group flex items-center justify-between py-5 px-6 bg-card border border-white/5 hover:border-white/20 transition-all duration-500 ease-out-expo hover-lift ${linksVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="flex items-center gap-4">
                <span className="text-xl opacity-40 group-hover:opacity-80 transition-opacity duration-300">
                  {contact.icon}
                </span>
                <div className="text-left">
                  <span className="block text-white/30 text-xs uppercase tracking-wider mb-1">
                    {contact.label}
                  </span>
                  <span className="block text-white/80 group-hover:text-white transition-colors duration-300">
                    {contact.value}
                  </span>
                </div>
              </div>
              
              <div className="w-8 h-8 flex items-center justify-center rounded-full border border-white/10 group-hover:border-white/30 group-hover:bg-white/5 transition-all duration-300">
                <svg 
                  className="w-4 h-4 text-white/40 group-hover:text-white/80 -rotate-45 group-hover:rotate-0 transition-all duration-300" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </a>
          ))}
        </div>
        
        <div className={`mt-24 transition-all duration-800 delay-500 ease-out-expo ${linksVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="h-px w-24 bg-gradient-to-r from-transparent via-white/20 to-transparent mx-auto mb-8" />
          <p className="text-white/20 text-sm tracking-wider">
            © 2025 Zhi Yu. Crafted with passion.
          </p>
        </div>
      </div>
      
      <div className="absolute -left-32 bottom-1/4 w-64 h-64 border border-white/5 rounded-full" />
      <div className="absolute -left-16 bottom-1/4 w-48 h-48 border border-white/5 rounded-full" />
      <div className="absolute -right-32 top-1/4 w-96 h-96 border border-white/5 rounded-full" />
    </section>
  )
}
