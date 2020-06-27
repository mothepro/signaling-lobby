/** Number of bytes that a data type takes up. */
export const enum Size {
  CHAR = 1 << 0,
  SHORT = 1 << 1,
  INT = 1 << 2,
  BIG = 1 << 3,
}

/** Number of bits that a data type takes up. */
const enum SizeBits {
  CHAR = Size.CHAR << 3,
  SHORT = Size.SHORT << 3,
  INT = Size.INT << 3,
  BIG = Size.BIG << 3,
}

/** Max value that can fit in a data type. */
export const enum Max {
  CHAR = 2 ** SizeBits.CHAR - 1,
  SHORT = 2 ** SizeBits.SHORT - 1,
  INT = 2 ** SizeBits.INT - 1,
  BIG = 2 ** SizeBits.BIG - 1,
}

/** The name of the client, set by them. */
export type Name = string

/** Unique Key of the app that is utlizing the signaling lobby. */
export type LobbyID = string

/** Uint16 (2 bytes) to represent the ID of a client. */
export type ClientID = number

/** Prefix to buffer sent from server to the clients. */
export const enum Code {
  CLIENT_LEAVE,
  CLIENT_JOIN,
  GROUP_REQUEST,
  GROUP_REJECT,
  GROUP_FINAL,
  YOUR_NAME,
}
