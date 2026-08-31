const { execSync } = require('child_process');
const path = require('path');

exports.default = async function(context) {
  if (context.electronPlatformName === 'darwin') {
    const appName = `${context.packager.appInfo.productFilename}.app`;
    const appPath = path.join(context.appOutDir, appName);
    console.log(`[afterPack Hook] Applying deep ad-hoc code sign to: ${appPath}`);
    try {
      execSync(`codesign --force --deep --sign - "${appPath}"`);
      console.log(`[afterPack Hook] Successfully signed ${appName}`);
    } catch (error) {
      console.error(`[afterPack Hook] Code signing failed:`, error);
      throw error;
    }
  }
};
