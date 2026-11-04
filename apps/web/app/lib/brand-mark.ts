/** Hình học nhận diện: sách mở đỏ–xanh, ngòi bút và sao vàng. */
export const BRAND_COLORS = {
  red: ["#C22A43", "#A61C30"],
  blue: ["#267798", "#104866"],
  gold: ["#E5C66B", "#C89B22"],
} as const;
export const BRAND_DRUM_RINGS = [78, 84, 94, 100, 118, 124] as const;
export const BRAND_PATHS = [
  {
    tone: "blue",
    d: "M12 184 L27 180 L38 239 C87 241 128 266 160 300 C119 273 72 258 22 258 Z",
  },
  {
    tone: "blue",
    d: "M308 184 L293 180 L282 239 C233 241 192 266 160 300 C201 273 248 258 298 258 Z",
  },
  {
    tone: "blue",
    d: "M35 157 L51 155 L62 219 C101 230 134 254 158 291 C123 255 86 238 47 232 Z",
  },
  {
    tone: "blue",
    d: "M285 157 L269 155 L258 219 C219 230 186 254 162 291 C197 255 234 238 273 232 Z",
  },
  {
    tone: "red",
    d: "M62 130 C103 131 138 151 154 181 L158 276 C135 229 107 204 74 193 Z",
  },
  {
    tone: "red",
    d: "M258 130 C217 131 182 151 166 181 L162 276 C185 229 213 204 246 193 Z",
  },
  {
    tone: "gold",
    d: "M160 88 C153 105 138 118 141 132 C143 143 154 149 160 172 C166 149 177 143 179 132 C182 118 167 105 160 88 Z M160 119 A4 4 0 1 0 160 127 A4 4 0 1 0 160 119 Z M158.5 127 H161.5 V160 H158.5 Z",
    fillRule: "evenodd",
  },
  {
    tone: "gold",
    d: "M160.00 3.00 L170.58 34.44 L203.75 34.79 L177.12 54.56 L187.04 86.21 L160.00 67.00 L132.96 86.21 L142.88 54.56 L116.25 34.79 L149.42 34.44 Z",
  },
] as const;

/** Nguồn dùng chung cho favicon, PWA và logo nhúng của trang offline. */
export function brandMarkSvg(white = false) {
  const defs = Object.entries(BRAND_COLORS)
    .map(
      ([tone, colors]) =>
        `<linearGradient id="brand-${tone}" x2="0" y2="1"><stop stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></linearGradient>`,
    )
    .join("");
  const ornament = white
    ? ""
    : `<g fill="none" stroke="#D1AA36" stroke-width="1.5" opacity=".2">${BRAND_DRUM_RINGS.map((r) => `<circle cx="160" cy="142" r="${r}"/>`).join("")}</g>`;
  const shapes = BRAND_PATHS.map(
    (shape) =>
      `<path d="${shape.d}" fill="${white ? "#FFFFFF" : `url(#brand-${shape.tone})`}" fill-rule="${"fillRule" in shape ? shape.fillRule : "nonzero"}"/>`,
  ).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" role="img" aria-label="Học tập pháp luật và bồi dưỡng nghiệp vụ"><defs>${defs}</defs>${ornament}${shapes}</svg>`;
}
