import t from "@babel/types"
import { generate } from "@babel/generator"
import path from "node:path"
import fs from "node:fs/promises";
import { PACKAGE, VIRTUAL_MODULE_ID } from "./constants.js";

export type CollectPagesOptions = {
  root: string;
  extensions: string[];
};

export function getNameFromFilePath(fname: string): string {
  return path.basename(fname).split('.')[0];
}

export async function compile({
  root,
  extensions,
}: CollectPagesOptions): Promise<string> {

  // Used for poor man's identifier generator
  let nextTempId = 0;

  // Will contain the generated code
  let out = '';

  const imports: t.Statement[] = [];

  async function traverse(dir: string = ''): Promise<t.Expression> {

    const props = {} as Record<string, t.Expression>;

    props.type = t.numericLiteral(0);

    if (dir) {
      props.path = t.stringLiteral(dir);
    }

    const buildImport = (fname: string) => {
      const name = getNameFromFilePath(fname);
      const props = {} as Record<string, t.Expression>;
      props.type = t.numericLiteral(1);
      props.load = t.arrowFunctionExpression([], t.importExpression(t.stringLiteral(path.resolve(root, fname))));
      // props.path = t.stringLiteral(name);
      return buildObject(props);
    }

    // Find the meta file and import it if necessary
    const meta = await resolve(path.join(root, dir, '_meta'));
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
    const layout = await resolve(path.join(root, dir, '_layout'));
    if (layout) {
      props.layout = buildImport(layout);
    }

    // Find special status code pages
    // const notFound = await resolve(path.join(root, dir, '404'));
    // if (notFound) {
    //   props.notFound = buildImport(notFound);
    // }

    // Find the index page
    const index = await resolve(path.join(root, dir, 'index'));
    if (index) {
      props.index = buildImport(index);
    }

    const children = {} as Record<string, t.Expression>;
    for await (const entry of await fs.opendir(path.join(root, dir))) {
      const name = getNameFromFilePath(entry.name);
      if ((!entry.isFile() && !entry.isDirectory()) || entry.name.startsWith('_')) {
        continue;
      }
      let child;
      if (entry.isDirectory()) {
        child = await traverse(path.join(dir, entry.name));
      } else {
        child = buildImport(path.join(dir, entry.name));
      }
      children[name] = child;
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

  const pagesExpr = generate(await traverse()).code;

  // Imports from 'external' packages
  out += `import { BehaviorSubject } from "rxjs";\n`;
  out += `import { defineApp, normalize } from "${PACKAGE}";\n`;
  out += '\n';

  // Imports to local pages
  out += generate(t.program(imports)).code;

  out += `export const pagesSubject = new BehaviorSubject(normalize(${pagesExpr}));

`;

  out += `if (import.meta.hot) {
  import.meta.hot.accept(newModule => {
    if (newModule) {
      pagesSubject.next(normalize(newModule.pagesSubject.value));
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
