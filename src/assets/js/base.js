// Path prefix for hosting under a sub-path (e.g. a GitHub Pages project preview at
// /thepeoplesaction/). The build writes it to <html data-base>; empty on the real domain.
export const BASE = document.documentElement.dataset.base || '';
export const url = (p) => (typeof p === 'string' && p.startsWith('/') && !p.startsWith('//') ? BASE + p : p);
