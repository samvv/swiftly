import * as vite from "vite"
import path from "node:path"
import fs from "node:fs/promises";
import { wrap } from "node:module";

type Node = Dir | Page

type Dir = {
  name: string;
  layout?: Page;
  children: Node[];
};

type Page = {
  name: string;
  path: string;
};

function firstUpper(name: string): string {
  return name[0].toUpperCase() + name.substring(1);
}

function camelCase(name: string): string {
  return name.split('-').map(c => firstUpper(c)).join('');
}

function isSpace(ch: string): boolean {
  return /[\s]/.test(ch)
}

function indent(text: string, indentation = '  ', atBlankLine = true): string {
  let out = ''
  for (const ch of text) {
    if (ch === '\n') {
      atBlankLine = true;
    } else if (!isSpace(ch)) {
      if (atBlankLine) {
        out += indentation;
      }
      atBlankLine = false;
    }
    out += ch;
  }
  return out
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

export function turboweb(): vite.Plugin {
  const virtualModuleId = '@samvv/turboweb/app'
  const resolvedVirtualModuleId = '\0' + virtualModuleId

  let config: vite.ResolvedConfig;

  // async function collectPages(): Promise<PageInfo[]> {
  //   const pages = [];
  //   // FIXME should also collect regular ts files
  //   for await (const fname of glob(path.join(config.root, 'src', 'pages', '**', '*.tsx'))) {
  //     pages.push({
  //       name: path.basename(fname).split('.')[0],
  //       path: fname,
  //     });
  //   }
  //   return pages;
  // }

  // function renderNames(pages: PageInfo[]) {
  //   return pages.map(p => p.name).join(',\n');
  // }

  // function renderImports(pages: PageInfo[]) {
  //   let out = '';
  //   for (const page of pages) {
  //     out += `import ${camelCase(page.name)}Page from "${page.path}"\n`;
  //   }
  //   return out
  // }

  function getName(fname: string): string {
    return path.basename(fname).split('.')[0];
  }

  async function collectPages(dir: string = ''): Promise<string> {

    const root = path.join(config.root, 'src', 'pages');

    let out = '{\n';

    const writeImport = (fname: string) => {
      const name = getName(fname);

      console.log(fname, root)
      out += '{';
      out += `load: () => import("${path.resolve(root, fname)}"),`
      out += `name: "${name}"`;
      out += '}\n';
    }

    const layout = await findAnyFile(config.resolve.extensions.map(ext => path.join(root, dir, `_layout.${ext}`)));
    if (layout) {
      out += 'layout: ';
      writeImport(layout);
      out += ',\n';
    }

    out += 'children: [';
    let first = true;
    for await (const entry of await fs.opendir(path.join(root, dir))) {
      if ((!entry.isFile() && !entry.isDirectory()) || entry.name.startsWith('_')) {
        continue;
      }
      if (first) first = false;
      else out += ',';
      if (entry.isDirectory()) {
        out += await collectPages(path.join(dir, entry.name));
      } else {
        writeImport(path.join(dir, entry.name));
      }
    }
    out += '],\n';

    out += '}\n';
    return out;
  }

  return {
    name: 'turboweb',
    configResolved(c) {
      config = c;
    },
    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId
      }
    },
    async load(id) {
      if (id === resolvedVirtualModuleId) {
        const pages = await collectPages();
        return `
import { defineApp } from "@samvv/turboweb"
export default defineApp({
  pages: ${indent(await collectPages())},
});
`;
      }
    },
  }
}
