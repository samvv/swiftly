import * as vite from "vite"
import path from "node:path"
import { glob } from "node:fs/promises";

type PageInfo = {
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

export function turboweb(): vite.Plugin {
  const virtualModuleId = '@samvv/turboweb/app'
  const resolvedVirtualModuleId = '\0' + virtualModuleId

  let config: vite.ResolvedConfig;

  async function collectPages(): Promise<PageInfo[]> {
    const pages = [];
    // FIXME should also collect regular ts files
    for await (const fname of glob(path.join(config.root, 'src', 'pages', '**', '*.tsx'))) {
      pages.push({
        name: path.basename(fname).split('.')[0],
        path: fname,
      });
    }
    return pages;
  }

  function renderNames(pages: PageInfo[]) {
    return pages.map(p => p.name).join(',\n');
  }

  function renderImports(pages: PageInfo[]) {
    let out = '';
    for (const page of pages) {
      out += `import ${camelCase(page.name)}Page from "${page.path}"\n`;
    }
    return out
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
${renderImports(pages)}
export default createApp({
  pages: [\n${indent(renderNames(pages))}\n]
});
`;
      }
    },
  }
}
