'use client'

import { useIntersectionObserver } from '@/lib/hooks/useIntersectionObserver'

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
    <section id="contact" className="min-h-screen bg-black px-6 py-32 text-white">
      <div className="mx-auto flex min-h-[70vh] max-w-4xl flex-col justify-center text-center">
        <div ref={titleRef}>
          <p className="mb-6 font-mono text-xs uppercase tracking-[0.45em] text-white/40">04 / Contact</p>
          <h2 className={`mb-8 text-5xl font-semibold tracking-[-0.06em] transition-all duration-800 ease-out-expo md:text-7xl lg:text-8xl ${titleVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}>
            Contact Me
          </h2>
        </div>

        <div ref={contentRef}>
          <p className={`mx-auto mb-16 max-w-xl text-lg leading-relaxed text-white/50 transition-all delay-200 duration-800 ease-out-expo md:text-xl ${contentVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
            想和我聊聊？欢迎随时联系。
          </p>
        </div>

        <div ref={linksRef} className="mx-auto w-full max-w-md space-y-3">
          {contacts.map((contact, index) => (
            <a
              key={contact.label}
              href={contact.href}
              target={contact.href !== '#' ? '_blank' : undefined}
              rel={contact.href !== '#' ? 'noopener noreferrer' : undefined}
              className={`group flex items-center justify-between border border-white/10 px-6 py-5 text-left transition-all duration-500 ease-out-expo hover:border-white/30 hover:bg-white/[0.035] ${linksVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="flex items-center gap-4">
                <span className="text-xl opacity-40 transition-opacity duration-300 group-hover:opacity-75">
                  {contact.icon}
                </span>
                <div>
                  <span className="mb-1 block font-mono text-xs uppercase tracking-[0.28em] text-white/30">
                    {contact.label}
                  </span>
                  <span className="block text-white/78 transition-colors duration-300 group-hover:text-white">
                    {contact.value}
                  </span>
                </div>
              </div>

              <div className="flex h-8 w-8 items-center justify-center border border-white/10 transition-all duration-300 group-hover:border-white/30 group-hover:bg-white/5">
                <svg
                  className="h-4 w-4 -rotate-45 text-white/40 transition-all duration-300 group-hover:rotate-0 group-hover:text-white/80"
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

        <div className={`mt-24 transition-all delay-500 duration-800 ease-out-expo ${linksVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
          <div className="mx-auto mb-8 h-px w-24 bg-white/20" />
          <p className="text-sm tracking-[0.25em] text-white/20">
            © 2026 Zhi Yu. Crafted with restraint.
          </p>
        </div>
      </div>
    </section>
  )
}
