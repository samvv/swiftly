import { createContext, useContext, useMemo } from "react";
import { browserHistory, type History } from "./router.js"
import { usePromise } from "./hooks.js";
import { DefaultLayout } from "./DefaultLayout.js";

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

type Dir = {
  type: NodeType.Dir;
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

function findPage(path: string, pages: Dir): Page {
  const chunks = path === '/' ? [] : path.substring(1).split('/');
  const stack = [ pages ];
  let curr: Node | null = pages;
  for (const chunk of chunks) {
    if (curr.type !== NodeType.Dir) {
      curr = null;
      break;
    }
    if (curr.children[chunk] === undefined) {
      curr = null;
      break;
    }
    curr = curr.children[chunk];
  }
  if (curr?.type === NodeType.Page) {
    return curr;
  }
  if (curr?.type === NodeType.Dir && curr.index !== undefined) {
    return curr.index;
  }
  for (let i = stack.length; i-- > 0;) {
    if (stack[i].notFound !== undefined) {
      return stack[i].notFound;
    }
  }
  // TODO add built-in 404 page
  throw new Error(`No default 404 route found.`)
}

function assignLayouts(dir: Dir, layout?: Page): void {
  if (dir.layout !== undefined) {
    layout = dir.layout;
  }
  if (layout === undefined) {
    layout = {
      type: NodeType.Page,
      load: async () => ({
        default: DefaultLayout,
      }),
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

async function getExports(page: Page) {
  if (page.exports !== undefined) {
    return page.exports;
  }
  const exports = await page.load();
  page.exports = exports;
  return exports;
}

export function App({ definitions, history }: AppProps) {
  const h = useMemo(() => history ?? browserHistory(), [ history ]);
  const path = h.usePathName();
  const page = findPage(path, definitions.pages);
  const layoutExports = usePromise(() => getExports(page.layout), [ page.layout ]);
  const pageExports = usePromise(() => getExports(page), [ page ]);
  const app = {
    pages: definitions.pages,
    history: h
  };
  if (pageExports === undefined || layoutExports === undefined) {
    return <h1>Loading ...</h1>
  }
  const Layout = layoutExports.default;
  const C = pageExports.default;
  return (
    <Context.Provider value={app}>
      <Layout {...pageExports.layoutProps ?? {}}>
        <C />
      </Layout>
    </Context.Provider>
  );
}

export type AppType = React.ElementType<Omit<AppProps, 'definitions'>>

export function defineApp(opts: DefineAppOptions): AppType {
  assignLayouts(opts.pages);
  return props => <App definitions={opts} {...props} />
}
