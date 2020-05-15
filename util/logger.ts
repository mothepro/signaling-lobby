let globalLevel = Level.USEFUL

export const enum Level {
  USEFUL,
  INFO,
  DEBUG,
  TRANSFER,
}

export const setLevel = (level: Level) => globalLevel = level

// @ts-ignore shhh... it's okay
export const logErr = (...args: unknown[]) => console.error(...args) || true as const

export default (level: Level, ...args: unknown[]) => globalLevel >= level
  && console.log(...args)
  || true as const // Makes chaining easier...
