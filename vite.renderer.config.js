const path = require("path");
const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");
const tailwindcssModule = require("@tailwindcss/vite");
const tailwindcss = tailwindcssModule.default || tailwindcssModule;

module.exports = defineConfig({
  root: path.resolve(__dirname, "src/renderer-app"),
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/renderer-app/src")
    }
  },
  build: {
    outDir: path.resolve(__dirname, "dist/renderer-app"),
    emptyOutDir: true
  }
});
