import { createContext, useContext, useMemo } from "react";
import { browserHistory, type History } from "./router.js"
import { usePromise, useSubjectValue } from "./hooks.js";
import { assertNever } from "./util.js";
import { BehaviorSubject } from "rxjs";

type Exports = Record<string, any>;

type LazyImport = { exports?: Exports } & (() => Promise<Exports>);

const enum NodeType {
  Dir = 0,
  Page = 1,
}

export type Meta = {

  /**
   * The title of the page or directory.
   *
   * If left unspecified, the title of the parent directory will be used.
   */
  title?: string;

  /**
   * A hook that gets called to determine whether the user may access the given page.
   */
  useIsAuthorized?(): boolean;
}

 interface NodeBase {
  meta?: Meta;
  layout?: LazyImport;
  parent?: Dir;
  page?: LazyImport;
  children?: Record<number | string, Node>;
};

export interface Page extends NodeBase {
  page: LazyImport;
};

export interface Dir extends NodeBase {
  children: Record<number | string, Node>;
};

export type Node = Page | Dir;

type AppContext = {
  history: History;
  pages: Dir | BehaviorSubject<Dir>;
};

const Context = createContext<AppContext | null>(null);

export function useApplication(): AppContext {
  const app = useContext(Context);
  if (app === null) {
    throw new Error(`Trying to call a Swiftly hook without <App /> being present.`);
  }
  return app;
}

export type Definitions = {
  pages: BehaviorSubject<Dir> | Dir;
};

export type DefineAppOptions = {
  pages: BehaviorSubject<Dir> | Dir;
}

export type AppProps = {
  definitions: Definitions;
  history?: History;
  children: React.ReactNode;
};

type FindPageResult = [true, Page] | [false, Dir]

function findPage(path: string, dir: Dir): FindPageResult {

  const chunks = path === '/' ? [] : path.substring(1).split('/');

  let curr: Node = dir;
  let match = true;

  for (const chunk of chunks) {
    if (typeof(curr.children) === 'undefined') {
      match = false;
      break;
    }
    if (curr.children[chunk] === undefined) {
      match = false
      break;
    }
    curr = curr.children[chunk]
  }

  // If the path was fully matched but we don't know yet with what
  if (match && typeof(curr.page) !== 'undefined') {
    return [true, curr as Page];
  }

  // If we arrived at a page but didn't parse the full path,
  // we simply jump one level up for the context.
  if (typeof(curr.children) === 'undefined') {
    curr = curr.parent!;
  }

  return [false, curr as Dir]
}

export function normalize(node: Node): NodeBase {
  assignProperties(node);
  return node;
}

function assignProperties(node: Node, layout?: LazyImport, parent?: Dir): void {
  node.parent = parent;
  if (layout === undefined) {
    layout = () => import('./pages/layout.js');
  }
  if (node.layout === undefined) {
    node.layout = layout;
  } else {
    layout = node.layout;
  }
  if (typeof(node.children) !== 'undefined') {
    for (const child of Object.values(node.children)) {
      assignProperties(child, layout, node as Dir);
    }
  }
}

async function getExports(importer: LazyImport): Promise<Exports> {
  if (importer.exports !== undefined) {
    return importer.exports;
  }
  const exports = await importer();
  importer.exports = exports;
  return exports;
}

function makeTitle(page: Page): string {
  const out = [];
  if (page.meta?.title) {
    out.push(page.meta.title);
  }
  for (const dir of getParents(page.parent!)) {
    if (dir.meta?.title) {
      out.push(dir.meta.title);
    }
  }
  return out.join(' • ');
}

function DefaultLoading() {
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><h1>Loading ...</h1></div>
}

type PageLoaderProps = {
  page: Page;
};

function PageLoader({ page }: PageLoaderProps) {
  const layoutExports = usePromise(() => getExports(page.layout!), [ page.layout ]);
  const pageExports = usePromise(() => getExports(page.page), [ page ]);
  if (pageExports === undefined || layoutExports === undefined) {
    return <DefaultLoading />;
  }
  const Layout = layoutExports.default;
  const C = pageExports.default;
  return (
    <Layout {...pageExports.layoutProps ?? {}}>
      <title>{makeTitle(page)}</title>
      <C />
    </Layout>
  );
}

type HTTPCode = number;

function getSpecialPage(dir: Dir, code: HTTPCode) {

  // Go up the hierarchy and return the first mathing special page we can find
  for (;;) {
    if (dir.children[code] !== undefined) {
      return dir.children[code] as Page;
    }
    if (dir.parent === undefined) {
      break;
    }
    dir = dir.parent;
  }

  // If no special pages were found we are in an exceptional situation and we should throw
  throw new Error(`No special page with HTTP code ${code} was found. Either define one yourself or check that Swiftly is installed correctly.`);
}

function* getParents(node: Node): Iterable<Node> {
  let curr: Node | undefined = node;
  for (;;) {
    if (curr === undefined) {
      break;
    }
    yield curr;
    curr = curr.parent;
  }
}

type GuardProps = {
  dir: Dir;
  children: React.ReactNode;
};

function Guard({ dir, children }: GuardProps) {
  const isAuth = dir.meta!.useIsAuthorized!();
  if (!isAuth) {
    return <PageLoader page={getSpecialPage(dir, 403)} />;
  }
  return children;
}

function useValue<T>(value: T | BehaviorSubject<T>): T {
  if (import.meta.env?.DEV) {
    return useSubjectValue(value as BehaviorSubject<T>);
  } else {
    return value as T;
  }
}

export function usePages(): Dir {
  const app = useApplication();
  return useValue(app.pages);
}

export function App({ definitions, history }: AppProps) {
  const cachedHistory = useMemo(() => history ?? browserHistory(), [ history ]);
  const app = {
    pages: definitions.pages,
    history: cachedHistory
  };
  const pages = useValue(app.pages);
  const path = cachedHistory.usePathName();
  const [isMatch, node] = findPage(path, pages);

  // We will render the page into this variable
  let content = null;

  // Empty content means we are authorized
  if (content === null) {
    if (!isMatch) {
      content = <PageLoader page={getSpecialPage(node, 404)} />;
    } else {
      content = <PageLoader page={node} />;
    }
  }

  for (const parent of getParents(isMatch ? node.parent! : node)) {
    const dir = parent as Dir;
    const useIsAuthorizedFn = dir.meta?.useIsAuthorized;
    if (useIsAuthorizedFn !== undefined) {
      content = <Guard dir={dir}>{content}</Guard>
    }
  }

  return (
    <Context.Provider value={app}>
      {content}
    </Context.Provider>
  );
}

export type AppType = React.ElementType<Omit<AppProps, 'definitions'>>

export function defineApp(opts: DefineAppOptions): AppType {
  return props => <App definitions={opts} {...props} />
}
