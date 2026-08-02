// Minimal ESM resolver so the pure-logic tests can import the app's modules
// directly, without adding a bundler or test framework to the project.
//
// Handles the two things Node's ESM loader won't do on its own:
//   1. the "@/*" path alias from tsconfig.json
//   2. extensionless relative imports ("./dates" -> "./dates.ts")
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const ROOT = path.resolve(import.meta.dirname, "..");

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const base = path.join(ROOT, specifier.slice(2));
    for (const candidate of [base, base + ".ts", base + ".tsx", base + "/index.ts"]) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
  }
  if (specifier.startsWith(".") && !path.extname(specifier)) {
    const parent = context.parentURL ? new URL(context.parentURL).pathname : ROOT;
    const base = path.resolve(path.dirname(parent), specifier);
    for (const candidate of [base + ".ts", base + ".tsx", base + "/index.ts"]) {
      if (fs.existsSync(candidate)) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
  }
  return nextResolve(specifier, context);
}

register(import.meta.url, pathToFileURL("./"));
