import t from "@babel/types"
import { generate } from "@babel/generator"
import path from "node:path"
import fs from "node:fs/promises";
import { PACKAGE } from "./constants.js";

export type CollectPagesOptions = {
  root: string;
  extensions: string[];
};

export function getFileStem(fname: string): string {
  return path.basename(fname).split('.')[0];
}

const SPECIALS = [ 'meta', 'page', 'layout' ];

export async function compile({
  root,
  extensions,
}: CollectPagesOptions): Promise<string> {

  // Used for poor man's identifier generator
  let nextTempId = 0;

  // Will contain the generated code
  let out = '';

  const imports: t.Statement[] = [];

  async function scanDir(dir: string = ''): Promise<t.Expression> {

    const props = {} as Record<string, t.Expression>;

    props.type = t.numericLiteral(0);
    if (dir.length > 0) {
      props.pathElement = t.stringLiteral(dir);
    }

    function buildLazyImport(fname: string) {
      return t.arrowFunctionExpression([], t.importExpression(t.stringLiteral(path.resolve(root, fname))));
    }

    // Find the meta file and import it if necessary
    const meta = await resolve(path.join(root, dir, 'meta'));
    if (meta) {
      const id = generateId();
      props.meta = t.identifier(id);
      imports.push(
        t.importDeclaration(
          [
            t.importDefaultSpecifier(
              t.identifier(id),
            ),
          ],
          t.stringLiteral(meta),
        )
      );
    }

    // Find the layout file, if any, and add it to the definitions
    const layout = await resolve(path.join(root, dir, 'layout'));
    if (layout) {
      props.layout = buildLazyImport(layout);
    }

    // Find the index page
    const index = await resolve(path.join(root, dir, 'page'));
    if (index) {
      props.page = buildLazyImport(index);
    }

    const children = {} as Record<string, t.Expression>;
    for await (const entry of await fs.opendir(path.join(root, dir))) {
      const stem = getFileStem(entry.name);
      if (!entry.isDirectory()) {
        // FIXME does not take file extensions into account
        if (SPECIALS.indexOf(stem) === -1) {
          console.warn(`Unknown special file ${entry.name}`);
        }
        continue;
      }
      children[stem] = await scanDir(path.join(dir, entry.name));;
    }
    props.children = buildObject(children);

    return buildObject(props);
  }

  async function resolve(basePath: string): Promise<string | undefined> {
    for (const ext of extensions) {
      const fullPath = `${basePath}${ext}`;
      if (await fileExists(fullPath)) {
        return fullPath;
      }
    }
  }

  function generateId(): string {
    return `__temp${nextTempId++}`;
  }

  const pagesExpr = generate(await scanDir()).code;

  // Imports from 'external' packages
  out += `import { BehaviorSubject } from "rxjs";\n`;
  out += `import { defineApp, normalize } from "${PACKAGE}";\n`;
  out += '\n';

  // Imports to local pages
  out += generate(t.program(imports)).code;

  out += `

const pages = normalize(${pagesExpr});

const pagesSubject = new BehaviorSubject(pages);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    import.meta.data.pages = pages;
  });
  import.meta.hot.accept(newModule => {
    if (newModule) {
      pagesSubject.next(import.meta.hot.data.pages);
    }
  });
}

`;

  out += `export default defineApp({ pages: pagesSubject })`;

  return out;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p, fs.constants.R_OK);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'EISDIR') {
      return false;
    }
    throw e;
  }
  return true;
}

function buildObject(props: Record<string, t.Expression>) {
  return t.objectExpression(
    Object.entries(props).map(([k, v]) =>
      t.objectProperty(t.identifier(k), v))
  );
}
