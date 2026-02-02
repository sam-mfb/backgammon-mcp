import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default tseslint.config(
  // Ignores
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'eslint.config.js',
      '**/vite.config.ts',
      '**/vite.config.*.ts'
    ]
  },

  // Base configs
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // TypeScript files - strict rules
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      // No `any` allowed
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',

      // Explicit return types required
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',

      // Additional strict rules
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' }
      ],

      // Disable stylistic rules we don't want
      '@typescript-eslint/consistent-type-definitions': 'off',
      // Allow default type arguments when they're explicit for clarity
      '@typescript-eslint/no-unnecessary-type-arguments': 'off'
    }
  },

  // React packages (viewer, web-app, mcp-server client)
  {
    files: [
      'packages/viewer/**/*.{ts,tsx}',
      'packages/web-app/**/*.{ts,tsx}',
      'packages/mcp-server/src/client/**/*.{ts,tsx}'
    ],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: { globals: { ...globals.browser } },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/prop-types': 'off',
      'react/jsx-key': 'error',
      'react/no-unstable-nested-components': 'error',
      'react/self-closing-comp': 'error'
    }
  },

  // Node packages (game, mcp-server)
  {
    files: ['packages/game/**/*.ts', 'packages/mcp-server/**/*.ts'],
    languageOptions: { globals: { ...globals.node } }
  },

  // MCP server - disable deprecated warning for SDK methods and allow inferred callback types
  {
    files: ['packages/mcp-server/**/*.ts'],
    rules: {
      '@typescript-eslint/no-deprecated': 'off',
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true
        }
      ]
    }
  },

  // MCP server client files - use client tsconfig
  // Relax some rules due to MCP SDK types being incomplete
  {
    files: ['packages/mcp-server/src/client/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: './packages/mcp-server/tsconfig.client.json',
        projectService: false
      }
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true
        }
      ],
      // MCP ext-apps SDK has incomplete types
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      // Effects that sync external MCP SDK state need setState
      'react-hooks/set-state-in-effect': 'off'
    }
  },

  // Test files - relax strict rules
  {
    files: ['**/__tests__/**', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off'
    }
  },

  // Prettier compatibility (must be last)
  prettier
)
