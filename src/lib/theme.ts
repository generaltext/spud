// Resolve light/dark by toggling a `dark` class on <html>, which the CSS keys
// off. Inside General Text the shell already drives this class AND exposes
// `gt.theme` (runtime 1.8+); we mirror it and follow live toggles, so the SHELL
// wins over the OS setting — the whole point of "defer to the shell". Standalone
// or on an older runtime (no `gt.theme`), we fall back to the OS preference so a
// dev/demo session still isn't a light flashbang in a dark environment.

function setDark(on: boolean) {
  document.documentElement.classList.toggle('dark', on)
}

export function initTheme(): void {
  const gt = typeof window !== 'undefined' ? window.gt : undefined
  const shellMode = gt?.theme?.mode

  if (shellMode === 'light' || shellMode === 'dark') {
    setDark(shellMode === 'dark')
    // Keep in sync with every shell toggle.
    gt?.on?.('theme-changed', (t) => {
      const mode = (t as { mode?: string } | undefined)?.mode
      if (mode === 'light' || mode === 'dark') setDark(mode === 'dark')
    })
    return
  }

  // No shell theme → follow the OS, and react if it changes.
  const mql = window.matchMedia('(prefers-color-scheme: dark)')
  setDark(mql.matches)
  mql.addEventListener?.('change', (e) => setDark(e.matches))
}
