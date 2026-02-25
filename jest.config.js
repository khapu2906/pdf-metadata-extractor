/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],
  testPathIgnorePatterns: ["/node_modules/", "/tests/integration/"],
  collectCoverageFrom: ["src/**/*.ts"],
  coverageDirectory: "coverage",
  moduleFileExtensions: ["ts", "js", "json"],
};
