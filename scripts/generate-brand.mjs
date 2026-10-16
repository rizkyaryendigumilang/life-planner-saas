import fs from "node:fs";

const iconDark = fs.readFileSync("public/brand-mark.png").toString("base64");
const iconWhite = fs.readFileSync("public/brand-mark-white.png").toString("base64");

// Clean SVGs without conflicting OS media queries
const svgDark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 312 260" width="100%" height="100%">
  <image href="data:image/png;base64,${iconDark}" x="0" y="0" width="312" height="260" />
</svg>
`;

const svgWhite = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 312 260" width="100%" height="100%">
  <image href="data:image/png;base64,${iconWhite}" x="0" y="0" width="312" height="260" />
</svg>
`;

fs.writeFileSync("src/assets/brand-mark.svg", svgDark.trim());
fs.writeFileSync("public/brand-mark.svg", svgDark.trim());
fs.writeFileSync("src/assets/brand-mark-white.svg", svgWhite.trim());
fs.writeFileSync("public/brand-mark-white.svg", svgWhite.trim());

console.log("Brand SVG assets generated successfully!");
