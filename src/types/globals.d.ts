type ScenarioFunction = (title: string, count: number | EmptyFunction, func?: EmptyFunction) => void
type BenchmarkFunction = (title: string, func: EmptyFunction) => void
type EmptyFunction = () => void

type ScenarioObject = { [key: string]: number }
type BenchmarkObject = { [key: string]: ScenarioObject }
type PerfObject = { [key: string]: BenchmarkObject }

declare namespace NodeJS {
  export interface Global {
    benchmark: BenchmarkFunction
    scenario: ScenarioFunction
    _currentBenchmark: string
    _benchmarkResults: BenchmarkObject
  }
}

/**
 * Defines a suite of performance benchmarks.
 * 
 * @param title - title of the benchmark suite
 * @param func - benchmark contents
 */
declare var benchmark: BenchmarkFunction

/**
 * Defines a benchmark scenario.
 * 
 * @param title - title of the scenario
 * @param count - number of times to run this scenario, defaults to `1000`
 * @param func - benchmark contents
 */
declare var scenario: ScenarioFunction

declare var _currentBenchmark: string
declare var _benchmarkResults: BenchmarkObject