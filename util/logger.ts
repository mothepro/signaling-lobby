let globalLevel = -1

export const enum Level {
  SEVERE,
  WARN,
  INFO,
  DEBUG,
  TRANSFER,
}

export const setLevel = (level: Level) => globalLevel = level

export const logErr = (...args: unknown[]) => globalLevel >= Level.SEVERE // hidden outside of binary
  && console.error(new Date().toLocaleString(), ...args)
  || true as const // Makes chaining easier...

export default (level: Level, ...args: unknown[]) => globalLevel >= level
  && console.log(new Date().toLocaleString(), ...args)
  || true as const // Makes chaining easier...
