"use strict";

const process = require("process");

global._currentBenchmark = "";
global._benchmarkResults = {};

global.benchmark = function (title, func) {
    global._currentBenchmark = title;
    func();
};

global.scenario = function (title, countOrFunc, func) {
    let count = 1000;
    if (isNumber(countOrFunc)) {
        count = countOrFunc;
    }
    else if (isFunction(countOrFunc)) {
        func = countOrFunc;
    }
    if (func === undefined) {
        throw new Error("Benchmark contents not defined.");
    }
    let totalTime = 0;
    for (let i = 0; i < count; i++) {
        const startTime = process.hrtime.bigint();
        func();
        const endTime = process.hrtime.bigint();
        // convert from nanoseconds to milliseconds
        totalTime += Number((endTime - startTime) / BigInt(1e6));
    }
    const averageTime = totalTime / count;
    const scenarios = global._benchmarkResults[global._currentBenchmark] || {};
    scenarios[title] = averageTime;
    global._benchmarkResults[global._currentBenchmark] = scenarios;
};

const isNumber = function (a) {
    return typeof a === 'number' && isFinite(a);
};

const isFunction = function (a) {
    return typeof a === "function";
};
