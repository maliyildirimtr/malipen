const path = require('path');
const fs = require('fs');

exports.default = async function(context) {
  // ── All platforms: copy SETUP_README.txt into the packaged output dir ─────
  const readmeSrc  = path.join(__dirname, 'SETUP_README.txt');
  const readmeDest = path.join(context.appOutDir, 'SETUP_README.txt');

  if (fs.existsSync(readmeSrc)) {
    fs.copyFileSync(readmeSrc, readmeDest);
    console.log(`[afterPack] Copied SETUP_README.txt → ${readmeDest}`);
  } else {
    console.warn(`[afterPack] SETUP_README.txt not found at ${readmeSrc}`);
  }
};
