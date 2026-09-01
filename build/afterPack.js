const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.default = async function(context) {
  const platform = context.electronPlatformName; // 'darwin' | 'win32'

  // ── macOS: deep ad-hoc code sign ─────────────────────────────────────────
  if (platform === 'darwin') {
    const appName = `${context.packager.appInfo.productFilename}.app`;
    const appPath = path.join(context.appOutDir, appName);
    console.log(`[afterPack] Ad-hoc code signing: ${appPath}`);
    try {
      execSync(`codesign --force --deep --sign - "${appPath}"`);
      console.log(`[afterPack] Signed: ${appName}`);
    } catch (error) {
      console.error(`[afterPack] Code signing failed:`, error);
      throw error;
    }
  }

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
