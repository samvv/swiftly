import * as vite from "vite"
import path from "node:path"
import { compile } from "@swiftly/compiler";
import { VITE_PLUGIN_NAME, VIRTUAL_MODULE_ID } from "./constants.js";

function pathInside(child: string, base: string): boolean {
  return !path.relative(base, child).startsWith('..')
}

export default function createPlugin(): vite.Plugin {

  const resolvedVirtualModuleId = '\0' + VIRTUAL_MODULE_ID;

  let config: vite.ResolvedConfig;

  function getPagesDir(): string {
    return path.join(config.root, 'src', 'pages');
  }

  return {
    name: VITE_PLUGIN_NAME,
    configResolved(c) {
      config = c;
    },
    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return resolvedVirtualModuleId;
      }
    },
    configureServer(server: vite.ViteDevServer) {
      const pagesDir = getPagesDir();
      server.watcher.add(pagesDir);
      function onWatchChange(filepath: string) {
        if (pathInside(filepath, pagesDir)) {
          server.hot.send({ type: 'full-reload' });
        }
      }
      server.watcher.on('add', onWatchChange);
      server.watcher.on('unlink', onWatchChange);
      server.watcher.on('change', onWatchChange);
    },
    handleHotUpdate(ctx) {
        ctx.server.hot.send({ type: 'update', updates: [] });
    },
    async load(id) {
      if (id === resolvedVirtualModuleId) {
        return compile({
          root: path.join(config.root, 'src', 'pages'),
          extensions: config.resolve.extensions,
        });
      }
    },
  }
}
