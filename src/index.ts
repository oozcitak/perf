#!/usr/bin/env node
import { 
  readdirSync, statSync, existsSync, readFileSync, closeSync, openSync,
  writeFileSync
} from "fs"
import { join, dirname } from "path"
import { isGitSync, dirtySync } from "git-state"
import chalk from "chalk"
require("./globals")

type ScenarioObject = { [key: string]: number }
type BenchmarkObject = { [key: string]: ScenarioObject }
type PerfObject = { [key: string]: BenchmarkObject }

const runPerfTests = function(): void {
  const perfDirName = process.argv[2] || "./perf"
  const projectDir = getProjectDir()
  if (projectDir === undefined) {
    throw new Error(`Unable to locate project directory.`)
  }

  _benchmarkResults = {}
  let hasTests = false
  for (const filename of getTestFiles(join(projectDir, perfDirName))) {
    hasTests = true
    require(filename)
  }

  if (!hasTests) {
    console.log(`${chalk.bold.red(`No performance tests found in directory: '${perfDirName}'`)}`)
    return
  }

  const perfObj = readPerfResults(projectDir)
  const version = getCurrentVersion(projectDir) + (gitWorking(projectDir) ? "*" : "")
  perfObj[version] = global._benchmarkResults
  savePerfResults(projectDir, perfObj)
  printPerfResults(perfObj, version)
}

const printPerfResults = function(perfObj: PerfObject, version: string): void {
  const benchmarks = perfObj[version]
  for (const benchmarkTitle in benchmarks) {

    // print benchmark title
    console.log("")
    console.log(`Benchmark: ${chalk.bold(benchmarkTitle)}, v${version}${version.endsWith("*") ? " (Working Tree)" : ""}`)
    const scenarios = benchmarks[benchmarkTitle]

    // find the fastest scenario
    let fastestScenario = ""
    let fastestAverageTime = Number.MAX_SAFE_INTEGER
    for (const scenarioTitle in scenarios) {
      const averageTime = scenarios[scenarioTitle]
      if (averageTime < fastestAverageTime) {
        fastestScenario = scenarioTitle
        fastestAverageTime = averageTime
      }
    }

    for (const scenarioTitle in scenarios) {
      const averageTime = scenarios[scenarioTitle]
      // print scenario title
      if (scenarioTitle === fastestScenario)
      {
        console.log(`  * ${chalk.bold(scenarioTitle)}: ${chalk.green.bold(averageTime.toFixed(4))} ms`)
      } else {
        console.log(`  * ${chalk.bold(scenarioTitle)}: ${chalk.red.bold(averageTime.toFixed(4))} ms`)
      }
    }

    // compare to previous version
    const prev = findPrevVersion(perfObj, version, benchmarkTitle)
    if (prev !== undefined) {
      const prevVersion = prev[0]
      const prevScenario = prev[1]
      const prevAverageTime = prev[2]
      console.log("")
      if (fastestAverageTime < prevAverageTime) {
        console.log(`${fastestScenario} is faster than ${prevScenario} of v${prevVersion}${prevVersion.endsWith("*") ? " (Working Tree)" : ""}: ${chalk.green.bold(fastestAverageTime.toFixed(4))} ms vs ${chalk.bold(prevAverageTime.toFixed(4))} ms`)
      } else if (fastestAverageTime < prevAverageTime) {
        console.log(`${fastestScenario} is slower than ${prevScenario} of v${prevVersion}${prevVersion.endsWith("*") ? " (Working Tree)" : ""}: ${chalk.red.bold(fastestAverageTime.toFixed(4))} ms vs ${chalk.bold(prevAverageTime.toFixed(4))} ms`)
      } else {
        console.log(`${fastestScenario} is same as ${prevScenario} of v${prevVersion}${prevVersion.endsWith("*") ? " (Working Tree)" : ""}: ${chalk.bold(fastestAverageTime.toFixed(4))} ms vs ${chalk.bold(prevAverageTime.toFixed(4))} ms`)
      }
    }
  }
}

const findPrevVersion = function(perfObj: PerfObject, version: string, title: string): [string, string, number] | undefined {
  const versionNumber = parseVersion(version)
  let closestVersion: string = ""
  let closestVersionNumber: number = 0
  let closestFastestAverageTime: number = Number.MAX_SAFE_INTEGER
  let closestFastestScenario: string = ""
  let found = false
  for (const perfVersion in perfObj) {
    const perfVersionNumber = parseVersion(perfVersion)
    if (perfVersionNumber >= versionNumber) {
      continue
    } else if (perfVersionNumber > closestVersionNumber) {
      const benchmarks = perfObj[version]
      for (const benchmarkTitle in benchmarks) {
        if (benchmarkTitle === title) {
          found = true
          closestVersionNumber = perfVersionNumber
          closestVersion = perfVersion
          const scenarios = benchmarks[benchmarkTitle]
          closestFastestAverageTime = Number.MAX_SAFE_INTEGER
          for (const scenarioTitle in scenarios) {
            const averageTime = scenarios[scenarioTitle]
            if (averageTime < closestFastestAverageTime) {
              closestFastestAverageTime = averageTime
              closestFastestScenario = scenarioTitle
            }
          }
        }
      }
    }
  }

  return (found ? [closestVersion, closestFastestScenario, closestFastestAverageTime] : undefined)
}

const parseVersion = function(version: string): number {
  const arr = version.split(".")
  return parseInt(arr[0]) * 1000000 +
    parseInt(arr[1]) * 10000 +
    parseInt(arr[2]) * 100 +
    (arr.length === 4 && arr[3] === "*" ? 1 : 0)
}

const readPerfResults = function(directory: string): PerfObject {
  const perfFile = join(directory, "perf.list")
  return existsSync(perfFile) ? JSON.parse(readFileSync(perfFile, 'utf8')) : { }
}

const savePerfResults = function(directory: string, perfObj: PerfObject): void {
  const perfFile = join(directory, "perf.list")
  if (!existsSync(perfFile)) {
    closeSync(openSync(perfFile, 'w'))
  }
  writeFileSync(perfFile, JSON.stringify(perfObj, null, 2), 'utf-8')
}

const gitWorking = function(directory: string): boolean {
  return isGitSync(directory) && dirtySync(directory) !== 0
}

const getCurrentVersion = function(projectDir: string): string {
  const obj = require(join(projectDir, "package.json"))
  return obj.version
}

const getProjectDir = function(): string | undefined {
  let dir = __dirname
  while (dir !== "/") {
    if (directoryContainsFile(dir, "package.json")) {
      return dir
    } else {
      dir = dirname(dir)
    }
  }
  return undefined
}

const directoryContainsFile = function(directory: string, filename: string): boolean {
  for (const file of readdirSync(directory)) {
    if (file !== filename) continue
    if (statSync(join(directory, file)).isFile()) return true
  }
  return false
}

const getTestFiles = function*(directory: string): IterableIterator<string> {
  if (!existsSync(directory)) return

  for (const file of readdirSync(directory)) {
    const filename = join(directory, file)
    const stat = statSync(filename)
    if (stat.isFile() && isTestFile(filename)) {
      yield filename
    } else if (stat.isDirectory()) {
      yield *getTestFiles(filename)
    }
  }
}

const isTestFile = function(filename: string): boolean {
  const index = filename.indexOf(".")
  return filename.substr(index + 1) === "perf.ts"
}

runPerfTests()
