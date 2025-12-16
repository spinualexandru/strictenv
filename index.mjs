import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const strictenv = require('./lib/strictenv.js');

export const enableStrictEnv = strictenv.enableStrictEnv;
export const disableStrictEnv = strictenv.disableStrictEnv;
export const getAccessStats = strictenv.getAccessStats;
export const isEnabled = strictenv.isEnabled;
export const hasNativeModule = strictenv.hasNativeModule;

export default strictenv;
