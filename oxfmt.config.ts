import { defineConfig } from 'oxfmt';

export default defineConfig({
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  arrowParens: 'always',
  trailingComma: 'es5',
  bracketSpacing: true,
  bracketSameLine: false,
  proseWrap: 'preserve',
  endOfLine: 'lf',
  quoteProps: 'as-needed',
  singleAttributePerLine: false,
  jsxSingleQuote: false,
  htmlWhitespaceSensitivity: 'css',
  embeddedLanguageFormatting: 'auto',
  sortPackageJson: false,
  sortImports: {
    groups: [
      'builtin',
      'external',
      'internal',
      ['parent', 'sibling', 'index'],
      'side_effect',
      'unknown',
    ],
    partitionByComment: true,
    newlinesBetween: false,
    order: 'asc',
  },
  overrides: [
    { files: ['**/*.json', '**/*.jsonc'], options: { trailingComma: 'none' } },
  ],
});
