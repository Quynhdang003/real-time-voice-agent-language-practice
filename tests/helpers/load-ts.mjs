import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";
import ts from "typescript";

const root = fileURLToPath(new URL("../../", import.meta.url));

// Isolated module graph per test; only explicit external boundaries are mocked.
// Type safety is checked separately with tsc, not by transpileModule.
export function loadTs(entry, mocks = {}) {
  const cache = new Map();
  function load(filename) {
    if (!existsSync(filename) && existsSync(`${filename}.ts`)) filename += ".ts";
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const nativeRequire = createRequire(filename);
    const require = (specifier) => {
      if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
      if (specifier === "server-only") return {};
      if (specifier.startsWith("@/")) return load(resolve(root, specifier.slice(2)));
      if (specifier.startsWith(".")) return load(resolve(dirname(filename), specifier));
      return nativeRequire(specifier);
    };
    const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      fileName: filename,
    });
    new Script(`(function(require,module,exports){${outputText}\n})`, { filename })
      .runInThisContext()(require, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load(resolve(root, entry));
}
