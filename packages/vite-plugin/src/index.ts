import * as vite from "vite"
import path from "node:path"
import { collectPages } from "@swiftly/compiler";
import { VITE_PLUGIN_NAME, VIRTUAL_MODULE_ID } from "./constants.js";

export default function createPlugin(): vite.Plugin {

  const resolvedVirtualModuleId = '\0' + VIRTUAL_MODULE_ID;

  let config: vite.ResolvedConfig;

  return {
    name: VITE_PLUGIN_NAME,
    configResolved(c) {
      config = c;
    },
    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return resolvedVirtualModuleId
      }
    },
    async load(id) {
      if (id === resolvedVirtualModuleId) {
        return collectPages({
          root: path.join(config.root, 'src', 'pages'),
          extensions: config.resolve.extensions,
        });
      }
    },
  }
}
