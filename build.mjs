import esbuild from "esbuild";
import { cpSync, mkdirSync, rmSync } from "fs";

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });

await esbuild.build({
  entryPoints: ["src/background.ts", "src/popup.ts", "src/options.ts"],
  bundle: true,
  outdir: "dist",
  format: "iife",
  target: "es2020",
});

cpSync("manifest.json", "dist/manifest.json");
cpSync("popup.html", "dist/popup.html");
cpSync("popup.css", "dist/popup.css");
cpSync("options.html", "dist/options.html");
cpSync("options.css", "dist/options.css");
cpSync("icons", "dist/icons", { recursive: true });

console.log("Build complete → dist/");
