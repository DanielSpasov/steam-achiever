// electron-builder afterPack hook. Without a paid Apple Developer certificate,
// electron-builder leaves the macOS app with only the stock linker signature,
// which macOS rejects as "damaged". An ad-hoc deep signature makes it launchable
// (users still clear quarantine once with: xattr -cr /Applications/Steam\ Achiever.app).

const { execFileSync } = require("child_process");
const path = require("path");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);

  execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], {
    stdio: "inherit",
  });
  console.log(`ad-hoc signed ${appPath}`);
};
