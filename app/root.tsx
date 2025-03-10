import { useStore } from '@nanostores/react';
import type { LinksFunction } from '@remix-run/cloudflare';
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from '@remix-run/react';
import tailwindReset from '@unocss/reset/tailwind-compat.css?url';
import { themeStore } from './lib/stores/theme';
import { stripIndents } from './utils/stripIndent';
import { createHead } from 'remix-island';
import { useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

import reactToastifyStyles from 'react-toastify/dist/ReactToastify.css?url';
import globalStyles from './styles/index.scss?url';
import xtermStyles from '@xterm/xterm/css/xterm.css?url';

import 'virtual:uno.css';
import { initializePromptUpdates } from './lib/common/prompt-updater';
import { PromptLibrary } from '~/lib/common/prompt-library';

export const links: LinksFunction = () => [
  {
    rel: 'icon',
    href: '/favicon.svg',
    type: 'image/svg+xml',
  },
  { rel: 'stylesheet', href: reactToastifyStyles },
  { rel: 'stylesheet', href: tailwindReset },
  { rel: 'stylesheet', href: globalStyles },
  { rel: 'stylesheet', href: xtermStyles },
  {
    rel: 'preconnect',
    href: 'https://fonts.googleapis.com',
  },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  },
];

const inlineThemeCode = stripIndents`
  setTutorialKitTheme();

  function setTutorialKitTheme() {
    let theme = localStorage.getItem('bolt_theme');

    if (!theme) {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    document.querySelector('html')?.setAttribute('data-theme', theme);
  }
`;

export const Head = createHead(() => (
  <>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <Meta />
    <Links />
    <script dangerouslySetInnerHTML={{ __html: inlineThemeCode }} />
  </>
));

export function Layout({ children }: { children: React.ReactNode }) {
  const theme = useStore(themeStore);

  useEffect(() => {
    document.querySelector('html')?.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <DndProvider backend={HTML5Backend}>
      {children}
      <ScrollRestoration />
      <Scripts />
    </DndProvider>
  );
}

import { logStore } from './lib/stores/logs';

export default function App() {
  const theme = useStore(themeStore);

  useEffect(() => {
    // Initialize application
    logStore.logSystem('Application initialized', {
      theme,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });

    // Initialize prompt updates
    initializePromptUpdates()
      .then(() => {
        console.log('Prompt updates initialized');
      })
      .catch((error) => {
        console.error('Error initializing prompt updates:', error);
      });

    // Initialize PromptLibrary
    try {
      // Async olarak başlatmak için Promise'i yakala ama hatayı yukarı fırlatma
      const initPromise = PromptLibrary.initialize();
      initPromise.then(success => {
        if (success) {
          console.log('PromptLibrary initialized successfully');
        } else {
          // Error durumunda sessizce geç, çalışmaya devam et
          console.warn('PromptLibrary could not be initialized, using localStorage fallback');
        }
      }).catch(error => {
        // Hata olursa sessizce geç, çalışmaya devam et
        console.error('Error initializing PromptLibrary:', error);
      });
    } catch (error) {
      // Herhangi bir hata olursa sessizce geç, çalışmaya devam et
      console.error('Error starting PromptLibrary initialization:', error);
    }
  }, []);

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
