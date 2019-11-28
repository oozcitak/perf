/// <reference types="node" />

declare namespace NodeJS {
  // Augments `global` object when node.d.ts is loaded
  interface Global extends PerfGlobals { }
}

interface PerfGlobals {
 /**
  * Defines a suite of performance benchmarks.
  * 
  * @param title - title of the benchmark suite
  * @param func - benchmark contents
  */
 benchmark: ((title: string, func: (() => void)) => void)
 
 /**
  * Defines a benchmark scenario.
  * 
  * @param title - title of the scenario
  * @param count - number of times to run this scenario, defaults to `1000`
  * @param func - benchmark contents
  */
 scenario: ((title: string, count: number | (() => void), func?: (() => void)) => void)

  _currentBenchmark: string
  _benchmarkResults: { [key: string]: { [key: string]: number } }
}
