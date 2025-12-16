'use strict';

const {
    enableStrictEnv,
    disableStrictEnv,
    getAccessStats,
    isEnabled,
    hasNativeModule
} = require('./lib/strictenv');

module.exports = {
    enableStrictEnv,
    disableStrictEnv,
    getAccessStats,
    isEnabled,
    hasNativeModule
};
