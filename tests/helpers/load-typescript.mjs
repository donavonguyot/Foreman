import { registerHooks } from "node:module";

// Production uses Eve's compiler. Offline tests resolve our source .js imports
// to .ts so Node's built-in type stripping can exercise the real hook handlers.
const sourceRoot = new URL("../../agent/", import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      specifier.endsWith(".js") &&
      context.parentURL?.startsWith(sourceRoot)
    ) {
      const source = new URL(specifier, context.parentURL).href;
      if (source.startsWith(sourceRoot)) {
        return nextResolve(`${source.slice(0, -3)}.ts`, context);
      }
    }
    return nextResolve(specifier, context);
  },
});
