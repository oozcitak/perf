declare module "git-state" {
  export function isGitSync(path: string): boolean
  export function dirtySync(path: string, options?: { maxBuffer?: number }): number
}