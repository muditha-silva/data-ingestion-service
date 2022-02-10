module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}', 'lib/**/*.{js,jsx,ts,tsx}'],
  testPathIgnorePatterns: ['./node_modules/'],
  modulePathIgnorePatterns: ['<rootDir>/dist/']
};
