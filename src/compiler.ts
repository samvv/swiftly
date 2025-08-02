import t from "@babel/types"
import { generate } from "@babel/generator"
import path from "node:path"
import fs from "node:fs/promises";

type CollectPagesOptions = {
  root: string;
  extensions: string[];
};

export function getNameFromFilePath(fname: string): string {
  return path.basename(fname).split('.')[0];
}

export async function collectPages({
  root,
  extensions,
}: CollectPagesOptions): Promise<string> {

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

    // Find the layout file, if any, and add it to the definitions
    const layout = await findAnyFile(extensions.map(ext => path.join(root, dir, `_layout${ext}`)));
    if (layout) {
      props.layout = buildImport(layout);
    }

    // Find special status code pages
    const notFound = await findAnyFile(extensions.map(ext => path.join(root, dir, `404${ext}`)));
    if (notFound) {
      props.notFound = buildImport(notFound);
    }

    // Find the index page
    const index = await findAnyFile(extensions.map(ext => path.join(root, dir, `index${ext}`)));
    if (index) {
      props.index = buildImport(index);
    }

    const children = {} as Record<string, t.Expression>;
    for await (const entry of await fs.opendir(path.join(root, dir))) {
      const name = getNameFromFilePath(entry.name);
      if ((!entry.isFile() && !entry.isDirectory()) || entry.name.startsWith('_') || !Number.isNaN(Number(getNameFromFilePath(entry.name)))) {
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

  return generate(await traverse()).code;
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

async function findAnyFile(paths: string[]): Promise<string | undefined> {
  for (const path of paths) {
    if (await fileExists(path)) {
      return path;
    }
  }
}

function buildObject(props: Record<string, t.Expression>) {
  return t.objectExpression(
    Object.entries(props).map(([k, v]) =>
      t.objectProperty(t.identifier(k), v))
  );
}
