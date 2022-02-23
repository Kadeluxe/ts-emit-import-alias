import {build, BuildOptions} from "esbuild";
import path from "path";
import {nodeExternalsPlugin} from "esbuild-node-externals";

const Paths = {
  src: path.resolve(__dirname, "../src"),
  dist: path.resolve(__dirname, "../dist")
};

const config: BuildOptions = {
  entryPoints: [Paths.src],
  plugins: [nodeExternalsPlugin()],
  bundle: true,
  sourcemap: true,
  minify: false,
  target: ["esnext"],
  watch: process.argv.includes("-w"),
  platform: "node",
};

Promise.all([
  build({
    ...config,
    outfile: path.resolve(Paths.dist, "index-esm.js"),
    format: "esm",
  }),
  build({
    ...config,
    outfile: path.resolve(Paths.dist, "index-cjs.js"),
    format: "cjs",
  }),
]);
