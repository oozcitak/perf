#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const git_state = require("git-state");
const chalk = __importDefault(require("chalk"));
require("./globals");

const runPerfTests = function () {
    const perfDirName = process.argv[2] || "./perf";
    const projectDir = getProjectDir();
    if (projectDir === undefined) {
        throw new Error(`Unable to locate project directory.`);
    }
    global._benchmarkResults = {};
    let hasTests = false;
    for (const filename of getTestFiles(path.join(projectDir, perfDirName))) {
        hasTests = true;
        require(filename);
    }
    if (!hasTests) {
        console.log(`${chalk.default.bold.red(`No performance tests found in directory: '${perfDirName}'`)}`);
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
        console.log(`Benchmark: ${chalk.default.bold(benchmarkTitle)}, v${version}${version.endsWith("*") ? " (Working Tree)" : ""}`);
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
                console.log(`  * ${chalk.default.bold(scenarioTitle)}: ${chalk.default.green.bold(averageTime.toFixed(4))} ms`);
            }
            else {
                console.log(`  * ${chalk.default.bold(scenarioTitle)}: ${chalk.default.red.bold(averageTime.toFixed(4))} ms`);
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
                console.log(`${fastestScenario} is faster than ${prevScenario} of v${prevVersion}${prevVersion.endsWith("*") ? " (Working Tree)" : ""}: ${chalk.default.green.bold(fastestAverageTime.toFixed(4))} ms vs ${chalk.default.bold(prevAverageTime.toFixed(4))} ms`);
            }
            else if (fastestAverageTime < prevAverageTime) {
                console.log(`${fastestScenario} is slower than ${prevScenario} of v${prevVersion}${prevVersion.endsWith("*") ? " (Working Tree)" : ""}: ${chalk.default.red.bold(fastestAverageTime.toFixed(4))} ms vs ${chalk.default.bold(prevAverageTime.toFixed(4))} ms`);
            }
            else {
                console.log(`${fastestScenario} is same as ${prevScenario} of v${prevVersion}${prevVersion.endsWith("*") ? " (Working Tree)" : ""}: ${chalk.default.bold(fastestAverageTime.toFixed(4))} ms vs ${chalk.default.bold(prevAverageTime.toFixed(4))} ms`);
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
    const perfFile = path.join(directory, "perf.list");
    return fs.existsSync(perfFile) ? JSON.parse(fs.readFileSync(perfFile, 'utf8')) : {};
};
const savePerfResults = function (directory, perfObj) {
    const perfFile = path.join(directory, "perf.list");
    if (!fs.existsSync(perfFile)) {
        fs.closeSync(fs.openSync(perfFile, 'w'));
    }
    fs.writeFileSync(perfFile, JSON.stringify(perfObj, null, 2), 'utf-8');
};
const gitWorking = function (directory) {
    return git_state.isGitSync(directory) && git_state.dirtySync(directory) !== 0;
};
const getCurrentVersion = function (projectDir) {
    const obj = require(path.join(projectDir, "package.json"));
    return obj.version;
};
const getProjectDir = function () {
    let dir = __dirname;
    while (dir !== "/") {
        if (directoryContainsFile(dir, "package.json")) {
            return dir;
        }
        else {
            dir = path.dirname(dir);
        }
    }
    return undefined;
};
const directoryContainsFile = function (directory, filename) {
    for (const file of fs.readdirSync(directory)) {
        if (file !== filename)
            continue;
        if (fs.statSync(path.join(directory, file)).isFile())
            return true;
    }
    return false;
};
const getTestFiles = function* (directory) {
    if (!fs.existsSync(directory))
        return;
    for (const file of fs.readdirSync(directory)) {
        const filename = path.join(directory, file);
        const stat = fs.statSync(filename);
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
