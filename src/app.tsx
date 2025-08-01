import { createContext, useContext } from "react";
import { Router } from "./router.js";
import { assert } from "console";

type Page = {
  name: string;
  pattern: string;
  regex: RegExp;
  exports: Record<string, any>;
};

const Context = createContext<Definitions | null>(null);

function useApplication(): Definitions {
  const defs = useContext(Context);
  if (defs === null) {
    throw new Error(`Trying to call a Turboweb hook without <App /> being present.`);
  }
  return defs;
}

export function usePages(): Page[] {
  return useApplication().pages;
}

export type Definitions = {
  pages: Page[];
};

export type DefineAppOptions = {
  pages: Page[];
}

export type AppProps = {
  definitions: Definitions;
};

export function App({ definitions }: AppProps) {
  return (
    <Context.Provider value={definitions}>
      <Router />
    </Context.Provider>
  );
}

export type AppType = React.ElementType<Omit<AppProps, 'definitions'>>

export function defineApp(opts: DefineAppOptions): AppType {
  return props => <App definitions={opts} {...props} />
}
