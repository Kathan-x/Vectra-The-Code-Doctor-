declare module 'eslint-plugin-security' {
  import type { ESLint } from 'eslint';
  const plugin: ESLint.Plugin & { rules: NonNullable<ESLint.Plugin['rules']> };
  export default plugin;
}
