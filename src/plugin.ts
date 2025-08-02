import * as vite from "vite"
import path from "node:path"
import { collectPages } from "./compiler.js";

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
        const definitions = await collectPages({
          root: path.join(config.root, 'src', 'pages'),
          extensions: config.resolve.extensions,
        });
        return `
import { defineApp } from "@samvv/turboweb"
export default defineApp({
  pages: ${indent(definitions)},
});
`;
      }
    },
  }
}
