const zeroWidthCharCodes = new Set<number>()
    .add(0x200B) // Zero Width Space
    .add(0x200C) // Zero Width non - joiner Unicode code point
    .add(0x200D) // Zero Width joiner Unicode code point
    .add(0xFEFF) // Zero Width no -break space Unicode code point
    .add(0) // Null
    .add(7) // Bell
    .add(8) // Backspace
    .add(9) // Horizontal Tab
    .add(10) // Line Feed
    .add(11) // Vertical Tab
    .add(12) // Form Feed
    .add(13) // Carriage Return
    .add(26) // Control Z
    .add(27) // Escape

/** Removes any bad characters from a user's string. */
export default function (input: unknown) {
  if (typeof input == 'string') {
    input = input.replace(new RegExp(`[${String.fromCharCode(...zeroWidthCharCodes)}]`, 'g'), '')
    if (input)
      return input as string
  }

  throw TypeError('Expected to sanitize a string')
}
