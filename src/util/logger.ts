let globalLevel = Level.SEVERE

export const enum Level {
  SEVERE,
  USEFUL,
  INFO,
  DEBUG,
  TRANSFER,
}

export const setLevel = (level: Level | number) => globalLevel = level

export default (level: Level, ...args: unknown[]) => globalLevel >= level && console.log(...args) || true as const
