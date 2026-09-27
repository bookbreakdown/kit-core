export type { PageHostProps, PageHostHandle, PageHostComponent } from './types';
// Metro and jest-expo/web resolve PageHost.web.tsx on web; PageHost.tsx (WebView) elsewhere.
export { PageHost } from './PageHost';
