import { createContext, Suspense, useContext, useMemo } from "react";
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
  exports?: Record<string, any>;
  load: () => Promise<Exports>,
  layout?: Page;
};

export type Meta = {
  title?: string;
}

type Dir = {
  type: NodeType.Dir;
  meta?: Meta;
  notFound?: Page;
  index?: Page;
  layout?: Page;
  children: Record<string, Node>;
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

function findPage(path: string, pages: Dir): Node[] {

  const chunks = path === '/' ? [] : path.substring(1).split('/');

  const stack: Node[] = [ pages ];

  let match = true;

  for (const chunk of chunks) {
    const curr = stack[stack.length-1];
    if (curr.type !== NodeType.Dir) {
      match = false;
      break;
    }
    if (curr.children[chunk] === undefined) {
      match = false
      break;
    }
    stack.push(curr.children[chunk])
  }

  if (match) {
    const curr = stack[stack.length-1];
    if (curr.type === NodeType.Page) {
      return stack;
    }
    if (curr.type === NodeType.Dir && curr.index !== undefined) {
      stack.push(curr.index);
      return stack;
    }
  }

  // Go up the stack and return the first 404 we can find
  do {
    const dir = stack[stack.length-1] as Dir;
    if (dir.notFound !== undefined) {
      stack.push(dir.notFound);
      return stack;
    }
    stack.pop();
  } while (stack.length > 0);

  // If no 404s were found, return the built-in 404
  return [
    {
      type: NodeType.Page,
      load: () => import('./pages/404.js'),
    }
  ];
}

function assignLayouts(dir: Dir, layout?: Page): void {
  if (dir.layout !== undefined) {
    layout = dir.layout;
  }
  if (layout === undefined) {
    layout = {
      type: NodeType.Page,
      load: () => import('./pages/_layout.js'),
    };
  }
  const visit = (node: Node) => {
    switch (node.type) {
      case NodeType.Dir:
        assignLayouts(node, layout);
        break;
      case NodeType.Page:
        node.layout = layout;
        break;
      default:
        assertNever(node);
    }
  }
  if (dir.index !== undefined) {
    visit(dir.index)
  }
  if (dir.notFound !== undefined) {
    visit(dir.notFound);
  }
  for (const node of Object.values(dir.children)) {
    visit(node);
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

function makeTitle(stack: Node[]): string {
  const page = stack[stack.length-1] as Page;
  const out = [];
  if (page.exports?.meta?.title) {
    out.push(page.exports!.meta.title);
  }
  for (let i = stack.length-1; i-- > 0;) {
    const dir = stack[i] as Dir;
    if (dir.meta?.title) {
      out.push(dir.meta.title);
    }
  }
  return out.join(' • ');
}

function DefaultLoading() {
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><h1>Loading ...</h1></div>
}

export function App({ definitions, history }: AppProps) {
  const cachedHistory = useMemo(() => history ?? browserHistory(), [ history ]);
  const path = cachedHistory.usePathName();
  const stack = findPage(path, definitions.pages);
  const page = stack[stack.length-1] as Page;
  const layoutExports = usePromise(() => getExports(page.layout!), [ page.layout ]);
  const pageExports = usePromise(() => getExports(page), [ page ]);
  const app = {
    pages: definitions.pages,
    history: cachedHistory
  };
  console.log(layoutExports)
  if (pageExports === undefined || layoutExports === undefined) {
    return <DefaultLoading />;
  }
  console.log('render');
  const Layout = layoutExports.default;
  const C = pageExports.default;
  return (
    <Context.Provider value={app}>
      <Suspense fallback="Loading ...">
        <Layout {...pageExports.layoutProps ?? {}}>
          <title>{makeTitle(stack)}</title>
          <C />
        </Layout>
      </Suspense>
    </Context.Provider>
  );
}

export type AppType = React.ElementType<Omit<AppProps, 'definitions'>>

export function defineApp(opts: DefineAppOptions): AppType {
  assignLayouts(opts.pages);
  return props => <App definitions={opts} {...props} />
}
