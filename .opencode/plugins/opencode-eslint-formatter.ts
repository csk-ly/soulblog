import type { Plugin } from "@opencode-ai/plugin";
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface EslintFormatterOptions {
  enable?: boolean;
}

export function createEslintFormatterPlugin(options: EslintFormatterOptions = {}): Plugin {
  return async ({ directory }) => {
    // Check if ESLint is enabled (default to true)
    if (options.enable === false) {
      return {};
    }

    return {
      config: async (config) => {
        // Check if an ESLint RC file exists in the project
        const eslintRcFiles = [
          ".eslintrc",
          ".eslintrc.json",
          ".eslintrc.js",
          ".eslintrc.cjs",
          ".eslintrc.yaml",
          ".eslintrc.yml",
          "eslint.config.js",
          "eslint.config.mjs",
          "eslint.config.cjs"
        ];

        const hasEslintConfig = eslintRcFiles.some(file => 
          existsSync(join(directory, file))
        );

        if (!hasEslintConfig) {
          // No ESLint config found, don't modify configuration
          return;
        }

        // Add formatter configuration
        if (!config.formatter) {
          config.formatter = {};
        }

        // Disable prettier
        config.formatter.prettier = {
          disabled: true
        };

        // Add ESLint as formatter
        config.formatter["lint-formatter"] = {
          command: ["yarn", "eslint", "--fix", "$FILE"],
          extensions: [".js", ".ts", ".jsx", ".tsx"]
        };

        // Add LSP configuration
        if (!config.lsp) {
          config.lsp = {};
        }

        // Add ESLint LSP
        config.lsp.eslint = {
          command: ["vscode-eslint-language-server", "--stdio"],
          extensions: [".js", ".jsx", ".ts", ".tsx"]
        };
      }
    };
  };
}

// Default export for convenience
export default createEslintFormatterPlugin;