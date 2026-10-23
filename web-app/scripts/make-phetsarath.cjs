const fs = require('fs');
const path = require('path');

const regPath = path.join(__dirname, '..', 'public', 'fonts', 'Phetsarath-Regular.ttf');
const boldPath = path.join(__dirname, '..', 'public', 'fonts', 'Phetsarath-Bold.ttf');
const outPath = path.join(__dirname, '..', 'src', 'utils', 'phetsarathFont.js');

const regB64 = fs.readFileSync(regPath).toString('base64');
const boldB64 = fs.readFileSync(boldPath).toString('base64');

const output = `export const PHETSARATH_REGULAR_B64 = ${JSON.stringify(regB64)};
export const PHETSARATH_BOLD_B64 = ${JSON.stringify(boldB64)};

export const PHETSARATH_CSS = \`
@font-face {
  font-family: 'Phetsarath';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(data:font/truetype;charset=utf-8;base64,\${PHETSARATH_REGULAR_B64}) format('truetype');
}
@font-face {
  font-family: 'Phetsarath';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url(data:font/truetype;charset=utf-8;base64,\${PHETSARATH_BOLD_B64}) format('truetype');
}
\`;

export async function ensurePhetsarathLoaded() {
  if (typeof document === 'undefined') return;
  try {
    if (!document.getElementById('phetsarath-base64-style')) {
      const style = document.createElement('style');
      style.id = 'phetsarath-base64-style';
      style.textContent = PHETSARATH_CSS;
      document.head.appendChild(style);
    }
    if (document.fonts && typeof FontFace !== 'undefined') {
      const regFace = new FontFace(
        'Phetsarath',
        \`url(data:font/truetype;charset=utf-8;base64,\${PHETSARATH_REGULAR_B64})\`,
        { weight: '400', style: 'normal' }
      );
      const boldFace = new FontFace(
        'Phetsarath',
        \`url(data:font/truetype;charset=utf-8;base64,\${PHETSARATH_BOLD_B64})\`,
        { weight: '700', style: 'normal' }
      );
      const [r, b] = await Promise.all([regFace.load(), boldFace.load()]);
      document.fonts.add(r);
      document.fonts.add(b);
      await document.fonts.ready;
    }
  } catch (err) {
    console.warn('[phetsarathFont] Font loading notice:', err);
  }
}
`;

fs.writeFileSync(outPath, output, 'utf8');
console.log('Successfully generated phetsarathFont.js');
