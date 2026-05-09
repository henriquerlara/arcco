import { onMounted, onBeforeUnmount } from 'vue'

/**
 * Observa elementos com [data-reveal] e adiciona a classe "is-visible"
 * quando entram na viewport. Permite stagger via [data-reveal-delay].
 */
export function useScrollReveal(options = {}) {
  let observer = null

  onMounted(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      document
        .querySelectorAll('[data-reveal]')
        .forEach((el) => el.classList.add('is-visible'))
      return
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      document
        .querySelectorAll('[data-reveal]')
        .forEach((el) => el.classList.add('is-visible'))
      return
    }

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target
            const delay = Number(el.dataset.revealDelay || 0)
            if (delay > 0) {
              el.style.transitionDelay = `${delay}ms`
              el.style.animationDelay = `${delay}ms`
            }
            el.classList.add('is-visible')
            observer.unobserve(el)
          }
        })
      },
      {
        threshold: options.threshold ?? 0.15,
        rootMargin: options.rootMargin ?? '0px 0px -10% 0px',
      },
    )

    document.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el))
  })

  onBeforeUnmount(() => {
    if (observer) observer.disconnect()
  })
}
