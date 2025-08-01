/**
 * A very quick and dirty implementation of a routing framework.
 *
 * Why? Because we want to able to introspect what routes we have,
 * so that we can render breadcrumbs and menus.
 *
 * The application routes URLs to the correct components.
 * `urlSubject` is the single source of truth for the application.
 */

import { BehaviorSubject } from "rxjs";
import { useSubjectValue } from "./hooks.js";
import { pathToRegexp } from "path-to-regexp";
import { createContext, useContext } from "react";
import { usePages } from "./app.js";

const Context = createContext<History | null>(null);

function useRouter() {
  const router = useContext(Context);
  if (router === null) {
    throw new Error(`Could not find the main <Router />. You need to make sure your application is wrapped in <Router>...</Router>.`);
  }
  return router;
}

export type RedirectFn = (path: string) => void;

export function useRedirect(): RedirectFn {
  const router = useRouter();
  return router.useRedirect();
}

export function useUrl(): string {
  const router = useRouter();
  return router.useUrl();
}

interface History {
  useUrl(): string;
  useRedirect(): RedirectFn;
}

type HistoryExt = History & {
  destroy(): void;
};

class BrowserHistory implements History {

  private urlSubject = new BehaviorSubject(window.location.href);

  public constructor() {
    window.addEventListener('popstate', this.onpopstate);
  }

  private onpopstate = (_e: PopStateEvent) => {
    const newUrl = window.location.href;
    this.urlSubject.next(newUrl);
  }

  public useUrl(): string {
    return useSubjectValue(this.urlSubject);
  }

  public useRedirect(): RedirectFn {
    return (path: string) => {
      const h = window.location;
      const url = `${h.protocol}//${h.host}${path}`;
      history.pushState({}, '', url);
      this.urlSubject.next(url);
    }
  }

  public destroy(): void {
    window.removeEventListener('popstate', this.onpopstate);
  }

}

class StaticHistory implements HistoryExt {

  public constructor(
    public url: string,
  ) {

  }

  public useUrl(): string {
    return this.url;
  }

  public useRedirect(): RedirectFn {
    return (path: string) => {
      throw new Error(`Cannot redirect to ${path} while using a static router. Static routers only allow one fixed URL.`);
    }
  }

  public destroy(): void {
    // noop
  }

}

/**
 * Create a new object that uses the browser's API to naviate.
 *
 * In the future, more options might be added.
 */
export function browserHistory(): History {
  return new BrowserHistory();
}

export function staticHistory(url: string): History {
  return new StaticHistory(url);
}

export interface RouteSpec {
  path: string;
  title?: string;
  component?: React.ElementType<any>;
  hideMetaTitle?: boolean;
  onEnter?: () => void;
  auth?: boolean;
}

interface Route {
  path: string;
  regexp: RegExp;
  title?: string;
  component?: React.ElementType<any>;
  onEnter?: () => void;
  auth?: boolean;
}

export type RouterProps = {
  history: History;
}

function matchPage(path: string, pages: Page[]): Page | undefined {
  for (const page of pages) {
    if (page.regexp.test(path)) {
      return page;
    }
  }
}

export function Router({ history }: RouterProps) {

  const pages = usePages();
  const loggedIn = useLoggedIn();

  const urlText = history.useUrl();
  const url = new URL(urlText);
  const path = url.pathname;

  let out = null;

  const page = matchPage(path, pages);

  if (!page) {
    return <NotFound />
  }

  if (page.exports.mustAuthenticate && !loggedIn) {
    return <Login />
  }

  if (page.exports.default) {
    const C = page.component;
    out = (
      <>
        <title>{page.title}</title>
        <C />
      </>
    );
  } else {
    console.warn(`page '${page.path}' did not have any action specified.`);
  }

  return (
    <Context.Provider value={history}>
      {out}
    </Context.Provider>
  );
}

export function compileRoutes(routes: RouteSpec[]): Route[] {
  return routes.map(spec => {
    const { regexp, keys } = pathToRegexp(spec.path);
    return {
      ...spec,
      regexp,
      keys,
    };
  });
}

export type LinkProps = { to: string } & Omit<React.HTMLProps<HTMLAnchorElement>, 'href'>;

export function Link({ to, ...props }: LinkProps) {
  const redirect = useRedirect();
  return <a
    href={to}
    onClick={e => { e.preventDefault(); redirect(to) }}
    {...props}
  />
}

