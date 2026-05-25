import { defineConfig, globalIgnores } from "eslint/config";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([globalIgnores([
    "**/node_modules/",
    "**/build/",
    "**/bin/",
    "**/coverage/",
    "**/scripts/",
    "**/jest.config.ts",
]), {
    extends: compat.extends("eslint:recommended", "plugin:@typescript-eslint/recommended"),

    plugins: {
        "@typescript-eslint": typescriptEslint,
    },

    languageOptions: {
        parser: tsParser,
        ecmaVersion: 5,
        sourceType: "script",

        parserOptions: {
            project: ["./tsconfig.json"],
        },
    },

    rules: {
        quotes: ["error", "double"],
        semi: ["error", "always"],

        "@typescript-eslint/no-explicit-any": ["error", {
            fixToUnknown: true,
        }],

        curly: "error",
        "no-empty": "error",
        "no-alert": "error",
        "@typescript-eslint/no-non-null-assertion": "off",
        "no-unused-vars": "off",

        "@typescript-eslint/no-unused-vars": ["warn", {
            varsIgnorePattern: "^_",
            argsIgnorePattern: "^_",
        }],

        "no-fallthrough": "off",
        "arrow-parens": ["error", "as-needed"],
    },
}]);