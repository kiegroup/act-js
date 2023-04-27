import type { Config } from "@jest/types";
// Sync object
const jestConfig: Config.InitialOptions = {
  verbose: true,
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  moduleNameMapper: {
    "^@aj/(.*)$": "<rootDir>/src/$1",
  },
  clearMocks: true,
  resetMocks: true,
  collectCoverageFrom: [
    "src/**",
    "!**/*.types.ts",
    "!**/*.constants.ts",
    "!src/index.ts",
  ],
  testLocationInResults: true,
  testResultsProcessor: "jest-sonar-reporter",
  testTimeout: 120000,
  testPathIgnorePatterns: ["<rootDir>/build"],
};
export default jestConfig;
