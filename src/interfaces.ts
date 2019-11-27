/**
 * Defines a suite of performance benchmarks.
 * 
 * @param title - title of the benchmark suite
 * @param func - benchmark contents
 */
export declare var benchmark: (title: string, func: (() => void)) => void

/**
 * Defines a benchmark scenario.
 * 
 * @param title - title of the scenario
 * @param count - number of times to run this scenario, defaults to `1000`
 * @param func - benchmark contents
 */
export declare var scenario: (title: string, count: number | (() => void), func?: (() => void)) => void
