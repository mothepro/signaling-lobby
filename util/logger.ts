let globalLevel = -1

export const enum Level {
  USEFUL,
  INFO,
  DEBUG,
  TRANSFER,
}

export const setLevel = (level: Level) => globalLevel = level

// @ts-ignore shhh... it's okay
export const logErr = (...args: unknown[]) => globalLevel >= Level.USEFUL
  && console.error(...args)
  || true as const // Makes chaining easier...

export default (level: Level, ...args: unknown[]) => globalLevel >= level
  && console.log(...args)
  || true as const // Makes chaining easier...
