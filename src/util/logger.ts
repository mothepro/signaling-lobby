let globalLevel: Level

export const enum Level {
  SEVERE,
  WARNING,
  INFO,
  DEBUG,
}

export const setLevel = (level: Level | number) => globalLevel = level

export default (level: Level, ...args: unknown[]) => globalLevel >= level && console.log(...args) || true as const
