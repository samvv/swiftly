
// We define Vite's `import.meta` manually so that we
// don't have to depend on the entire package.
interface ImportMeta {
  env?: {
    DEV: boolean;
  };
}
