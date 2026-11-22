const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

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

  // electron-builder 24 reads these values from the shared mac config while
  // packaging. Keep the Developer ID build unchanged and apply the MAS-only
  // values before the application is signed.
  if (context.electronPlatformName === 'mas') {
    const masConfig = context.packager.config.mas;
    const category = masConfig?.category;
    const minimumSystemVersion = masConfig?.minimumSystemVersion;
    const appName = `${context.packager.appInfo.productFilename}.app`;
    const infoPlist = path.join(context.appOutDir, appName, 'Contents', 'Info.plist');

    if (category) {
      execFileSync('/usr/bin/plutil', [
        '-replace',
        'LSApplicationCategoryType',
        '-string',
        category,
        infoPlist,
      ]);
      console.log(`[afterPack] Set MAS category to ${category}`);
    }

    if (minimumSystemVersion) {
      execFileSync('/usr/bin/plutil', [
        '-replace',
        'LSMinimumSystemVersion',
        '-string',
        minimumSystemVersion,
        infoPlist,
      ]);
      console.log(`[afterPack] Set MAS minimum system version to ${minimumSystemVersion}`);
    }
  }
};
