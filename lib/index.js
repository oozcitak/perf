#!/usr/bin/env node
"use strict";

const fs_1 = require("fs");
const path_1 = require("path");
const git_state_1 = require("git-state");
const chalk_1 = __importDefault(require("chalk"));
require("./globals");

const runPerfTests = function () {
    const perfDirName = process.argv[2] || "./perf";
    const projectDir = getProjectDir();
    if (projectDir === undefined) {
        throw new Error(`Unable to locate project directory.`);
    }
    global._benchmarkResults = {};
    let hasTests = false;
    for (const filename of getTestFiles(path_1.join(projectDir, perfDirName))) {
        hasTests = true;
        require(filename);
    }
    if (!hasTests) {
        console.log(`${chalk_1.default.bold.red(`No performance tests found in directory: '${perfDirName}'`)}`);
        return;
    }
    const perfObj = readPerfResults(projectDir);
    const version = getCurrentVersion(projectDir) + (gitWorking(projectDir) ? "*" : "");
    perfObj[version] = global._benchmarkResults;
    savePerfResults(projectDir, perfObj);
    printPerfResults(perfObj, version);
};
const printPerfResults = function (perfObj, version) {
    const benchmarks = perfObj[version];
    for (const benchmarkTitle in benchmarks) {
        // print benchmark title
        console.log("");
        console.log(`Benchmark: ${chalk_1.default.bold(benchmarkTitle)}, v${version}${version.endsWith("*") ? " (Working Tree)" : ""}`);
        const scenarios = benchmarks[benchmarkTitle];
        // find the fastest scenario
        let fastestScenario = "";
        let fastestAverageTime = Number.MAX_SAFE_INTEGER;
        for (const scenarioTitle in scenarios) {
            const averageTime = scenarios[scenarioTitle];
            if (averageTime < fastestAverageTime) {
                fastestScenario = scenarioTitle;
                fastestAverageTime = averageTime;
            }
        }
        for (const scenarioTitle in scenarios) {
            const averageTime = scenarios[scenarioTitle];
            // print scenario title
            if (scenarioTitle === fastestScenario) {
                console.log(`  * ${chalk_1.default.bold(scenarioTitle)}: ${chalk_1.default.green.bold(averageTime.toFixed(4))} ms`);
            }
            else {
                console.log(`  * ${chalk_1.default.bold(scenarioTitle)}: ${chalk_1.default.red.bold(averageTime.toFixed(4))} ms`);
            }
        }
        // compare to previous version
        const prev = findPrevVersion(perfObj, version, benchmarkTitle);
        if (prev !== undefined) {
            const prevVersion = prev[0];
            const prevScenario = prev[1];
            const prevAverageTime = prev[2];
            console.log("");
            if (fastestAverageTime < prevAverageTime) {
                console.log(`${fastestScenario} is faster than ${prevScenario} of v${prevVersion}${prevVersion.endsWith("*") ? " (Working Tree)" : ""}: ${chalk_1.default.green.bold(fastestAverageTime.toFixed(4))} ms vs ${chalk_1.default.bold(prevAverageTime.toFixed(4))} ms`);
            }
            else if (fastestAverageTime < prevAverageTime) {
                console.log(`${fastestScenario} is slower than ${prevScenario} of v${prevVersion}${prevVersion.endsWith("*") ? " (Working Tree)" : ""}: ${chalk_1.default.red.bold(fastestAverageTime.toFixed(4))} ms vs ${chalk_1.default.bold(prevAverageTime.toFixed(4))} ms`);
            }
            else {
                console.log(`${fastestScenario} is same as ${prevScenario} of v${prevVersion}${prevVersion.endsWith("*") ? " (Working Tree)" : ""}: ${chalk_1.default.bold(fastestAverageTime.toFixed(4))} ms vs ${chalk_1.default.bold(prevAverageTime.toFixed(4))} ms`);
            }
        }
    }
};
const findPrevVersion = function (perfObj, version, title) {
    const versionNumber = parseVersion(version);
    let closestVersion = "";
    let closestVersionNumber = 0;
    let closestFastestAverageTime = Number.MAX_SAFE_INTEGER;
    let closestFastestScenario = "";
    let found = false;
    for (const perfVersion in perfObj) {
        const perfVersionNumber = parseVersion(perfVersion);
        if (perfVersionNumber >= versionNumber) {
            continue;
        }
        else if (perfVersionNumber > closestVersionNumber) {
            const benchmarks = perfObj[version];
            for (const benchmarkTitle in benchmarks) {
                if (benchmarkTitle === title) {
                    found = true;
                    closestVersionNumber = perfVersionNumber;
                    closestVersion = perfVersion;
                    const scenarios = benchmarks[benchmarkTitle];
                    closestFastestAverageTime = Number.MAX_SAFE_INTEGER;
                    for (const scenarioTitle in scenarios) {
                        const averageTime = scenarios[scenarioTitle];
                        if (averageTime < closestFastestAverageTime) {
                            closestFastestAverageTime = averageTime;
                            closestFastestScenario = scenarioTitle;
                        }
                    }
                }
            }
        }
    }
    return (found ? [closestVersion, closestFastestScenario, closestFastestAverageTime] : undefined);
};
const parseVersion = function (version) {
    const arr = version.split(".");
    return parseInt(arr[0]) * 1000000 +
        parseInt(arr[1]) * 10000 +
        parseInt(arr[2]) * 100 +
        (arr.length === 4 && arr[3] === "*" ? 1 : 0);
};
const readPerfResults = function (directory) {
    const perfFile = path_1.join(directory, "perf.list");
    return fs_1.existsSync(perfFile) ? JSON.parse(fs_1.readFileSync(perfFile, 'utf8')) : {};
};
const savePerfResults = function (directory, perfObj) {
    const perfFile = path_1.join(directory, "perf.list");
    if (!fs_1.existsSync(perfFile)) {
        fs_1.closeSync(fs_1.openSync(perfFile, 'w'));
    }
    fs_1.writeFileSync(perfFile, JSON.stringify(perfObj, null, 2), 'utf-8');
};
const gitWorking = function (directory) {
    return git_state_1.isGitSync(directory) && git_state_1.dirtySync(directory) !== 0;
};
const getCurrentVersion = function (projectDir) {
    const obj = require(path_1.join(projectDir, "package.json"));
    return obj.version;
};
const getProjectDir = function () {
    let dir = __dirname;
    while (dir !== "/") {
        if (directoryContainsFile(dir, "package.json")) {
            return dir;
        }
        else {
            dir = path_1.dirname(dir);
        }
    }
    return undefined;
};
const directoryContainsFile = function (directory, filename) {
    for (const file of fs_1.readdirSync(directory)) {
        if (file !== filename)
            continue;
        if (fs_1.statSync(path_1.join(directory, file)).isFile())
            return true;
    }
    return false;
};
const getTestFiles = function* (directory) {
    if (!fs_1.existsSync(directory))
        return;
    for (const file of fs_1.readdirSync(directory)) {
        const filename = path_1.join(directory, file);
        const stat = fs_1.statSync(filename);
        if (stat.isFile() && isTestFile(filename)) {
            yield filename;
        }
        else if (stat.isDirectory()) {
            yield* getTestFiles(filename);
        }
    }
};
const isTestFile = function (filename) {
    const index = filename.indexOf(".");
    return filename.substr(index + 1) === "perf.ts";
};
runPerfTests();
