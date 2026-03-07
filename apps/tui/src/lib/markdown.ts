import { SyntaxStyle, RGBA } from "@opentui/core";

export const syntaxStyle = SyntaxStyle.fromStyles({
  // Base text
  default: { fg: RGBA.fromHex("#ffffff") },

  // Headings
  "markup.heading.1": { fg: RGBA.fromHex("#ff6ac1"), bold: true },
  "markup.heading.2": { fg: RGBA.fromHex("#57c7ff"), bold: true },
  "markup.heading.3": { fg: RGBA.fromHex("#b48ead"), bold: true },
  "markup.heading.4": { fg: RGBA.fromHex("#9b8fca"), bold: true },
  "markup.heading.5": { fg: RGBA.fromHex("#9b8fca"), bold: true },
  "markup.heading.6": { fg: RGBA.fromHex("#9b8fca"), bold: true },
  "markup.heading": { fg: RGBA.fromHex("#9b8fca"), bold: true },

  // Inline formatting
  "markup.strong": { bold: true },
  "markup.italic": { italic: true },
  "markup.strikethrough": { dim: true },

  // Code
  "markup.raw": { fg: RGBA.fromHex("#ff5c57"), bg: RGBA.fromHex("#2a1a1a") },
  "markup.raw.block": { fg: RGBA.fromHex("#ff5c57") },

  // Blockquote
  "markup.quote": { fg: RGBA.fromHex("#4ec9b0"), italic: true },
  "punctuation.special": { fg: RGBA.fromHex("#6272a4"), dim: true },

  // Links
  "markup.link": { fg: RGBA.fromHex("#58a6ff") },
  "markup.link.label": { fg: RGBA.fromHex("#58a6ff"), underline: true },
  "markup.link.url": { fg: RGBA.fromHex("#6272a4"), dim: true },

  // Lists
  "markup.list": { fg: RGBA.fromHex("#f1fa8c") },
  "markup.list.checked": { fg: RGBA.fromHex("#5af78e") },
  "markup.list.unchecked": { fg: RGBA.fromHex("#6272a4") },

  // Code syntax — keywords, strings, etc.
  keyword: { fg: RGBA.fromHex("#ff79c6"), bold: true },
  string: { fg: RGBA.fromHex("#50fa7b") },
  "string.escape": { fg: RGBA.fromHex("#ffb86c") },
  comment: { fg: RGBA.fromHex("#6272a4"), italic: true },
  number: { fg: RGBA.fromHex("#bd93f9") },
  boolean: { fg: RGBA.fromHex("#bd93f9") },
  type: { fg: RGBA.fromHex("#8be9fd") },
  "type.builtin": { fg: RGBA.fromHex("#8be9fd"), bold: true },
  function: { fg: RGBA.fromHex("#f1fa8c") },
  "function.call": { fg: RGBA.fromHex("#f1fa8c") },
  variable: { fg: RGBA.fromHex("#f8f8f2") },
  "variable.builtin": { fg: RGBA.fromHex("#ff79c6") },
  "variable.member": { fg: RGBA.fromHex("#8be9fd") },
  operator: { fg: RGBA.fromHex("#ff79c6") },
  "punctuation.bracket": { fg: RGBA.fromHex("#cfd2d6") },
  "punctuation.delimiter": { fg: RGBA.fromHex("#cfd2d6") },
  constant: { fg: RGBA.fromHex("#bd93f9") },
  "constant.builtin": { fg: RGBA.fromHex("#bd93f9"), bold: true },
  label: { fg: RGBA.fromHex("#6272a4"), italic: true },
});
