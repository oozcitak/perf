import { hrtime } from "process"

global._currentBenchmark = ""
global._benchmarkResults = {}

global.benchmark = function(title: string, func: (() => void)) { 
  global._currentBenchmark = title
  func()
}

global.scenario = function(title: string, countOrFunc: number | (() => void), func?: (() => void)) {
  let count = 1000
  if (isNumber(countOrFunc)) {
    count = countOrFunc
  } else if (isFunction(countOrFunc)) 
  {
    func = countOrFunc
  }
  if (func === undefined) {
    throw new Error("Benchmark contents is not defined.")
  }

  let totalTime = 0
  for (let i = 0; i < count; i++) {
    const startTime = hrtime.bigint()
    func()
    const endTime = hrtime.bigint()
    // convert from nanoseconds to milliseconds
    totalTime += Number((endTime - startTime) / BigInt(1e6))
  }
  const averageTime = totalTime / count
  const scenarios = global._benchmarkResults[global._currentBenchmark] || { }
  scenarios[title] = averageTime
  global._benchmarkResults[global._currentBenchmark] = scenarios
}

const isNumber = function(a: any): a is number  {
  return typeof a === 'number' && isFinite(a)
}

const isFunction = function(a: any): a is Function {
  return typeof a === "function"
}