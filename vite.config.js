import { defineConfig } from "vite";

export default defineConfig(({ command, mode }) => {
  return {
    resolve: {
      alias: {
        'babylonjs': mode === 'development' ? 'babylonjs/babylon.max' : 'babylonjs'
        }
      },
    base: "https://jcordara.github.io/ches/",
    build: {
      outDir: "ches"
    }
  };
});
