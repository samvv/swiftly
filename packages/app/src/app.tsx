import { createContext, useContext, useMemo } from "react";
import { browserHistory, type History } from "./router.js"
import { usePromise } from "./hooks.js";
import { assertNever } from "./util.js";

type Exports = Record<string, any>;

const enum NodeType {
  Dir = 0,
  Page = 1,
}

type Page = {
  type: NodeType.Page;
  exports?: Exports;
  load: () => Promise<Exports>,
  layout?: Page;
  parent?: Dir;
};

export type Meta = {
  title?: string;
  useIsAuthorized?(): boolean;
}

type Dir = {
  type: NodeType.Dir;
  meta?: Meta;
  index?: Page;
  layout?: Page;
  children: Record<number | string, Node>;
  parent?: Dir;
};

type Node = Dir | Page;

type AppContext = {
  history: History;
  pages: Dir;
};

const Context = createContext<AppContext | null>(null);

export function useApplication(): AppContext {
  const app = useContext(Context);
  if (app === null) {
    throw new Error(`Trying to call a Turboweb hook without <App /> being present.`);
  }
  return app;
}

export function usePages(): Dir {
  return useApplication().pages;
}

export type Definitions = {
  pages: Dir;
};

export type DefineAppOptions = {
  pages: Dir;
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
    if (curr.type !== NodeType.Dir) {
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
  if (match) {
    if (curr.type === NodeType.Page) {
      return [true, curr];
    }
    if (curr.index !== undefined) {
      return [true, curr.index];
    }
  }

  // If we arrived at a page but didn't parse the full path,
  // we simply jump one level up for the context.
  if (curr.type === NodeType.Page) {
    curr = curr.parent!;
  }

  return [false, curr]
}

function assignProperties(dir: Dir, layout?: Page, parent?: Dir): void {
  dir.parent = parent;
  if (dir.layout !== undefined) {
    layout = dir.layout;
  }
  if (layout === undefined) {
    layout = {
      type: NodeType.Page,
      load: () => import('./pages/_layout.js'),
    };
  }
  const visit = (node: Node, parent: Dir) => {
    switch (node.type) {
      case NodeType.Dir:
        assignProperties(node, layout, parent);
        break;
      case NodeType.Page:
        node.parent = parent;
        node.layout = layout;
        break;
      default:
        assertNever(node);
    }
  }
  if (dir.index !== undefined) {
    visit(dir.index, dir)
  }
  for (const node of Object.values(dir.children)) {
    visit(node, dir);
  }
}

async function getExports(page: Page): Promise<Exports> {
  if (page.exports !== undefined) {
    return page.exports;
  }
  const exports = await page.load();
  page.exports = exports;
  console.log('assigned', page);
  return exports;
}

function makeTitle(page: Page): string {
  const out = [];
  if (page.exports?.meta?.title) {
    out.push(page.exports!.meta.title);
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
  const pageExports = usePromise(() => getExports(page), [ page ]);
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

function* getParents(node: Dir): Iterable<Dir> {
  let curr: Dir | undefined = node;
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

export function App({ definitions, history }: AppProps) {
  const cachedHistory = useMemo(() => history ?? browserHistory(), [ history ]);
  const app = {
    pages: definitions.pages,
    history: cachedHistory
  };
  const path = cachedHistory.usePathName();
  const [isMatch, node] = findPage(path, app.pages);

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
      content = <Guard dir={parent}>{content}</Guard>
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
  assignProperties(opts.pages);
  return props => <App definitions={opts} {...props} />
}
