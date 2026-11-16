// Flat config. The extension is plain browser scripts (no bundler, no modules):
// each lib/*.js registers itself on globalThis.GRLib and also exports for Node tests.
module.exports = [
  {
    ignores: ["dist/**", "prototype/**", "store/**"],
  },
  {
    files: ["extension/**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "script",
      globals: {
        window: "readonly", document: "readonly", location: "readonly", navigator: "readonly",
        chrome: "readonly", globalThis: "readonly", console: "readonly", fetch: "readonly",
        setTimeout: "readonly", clearTimeout: "readonly", requestAnimationFrame: "readonly",
        MutationObserver: "readonly", localStorage: "readonly", sessionStorage: "readonly",
        module: "writable", require: "readonly",
        GR_DEFAULTS: "readonly", GR_CACHE_KEY: "readonly", GRCockpit: "readonly", GRLib: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { args: "none" }],
      "no-undef": "error",
      eqeqeq: ["error", "smart"],
    },
  },
  {
    files: ["test/**/*.js", "eslint.config.js"],
    languageOptions: { ecmaVersion: 2023, sourceType: "commonjs" },
  },
];
