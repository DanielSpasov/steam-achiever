// Standalone command-line check, kept from the first version of this project.
// The real UI is the Electron app: `npm start`.
//
// Edit APP_ID and ACHIEVEMENT below, then run `npm run manual` with Steam open.

const steamworks = require("steamworks.js");

const APP_ID = 413150;
const ACHIEVEMENT = "37";

try {
  const client = steamworks.init(APP_ID);
  console.log(`Connected as ${client.localplayer.getSteamId().steamId64}`);

  console.log(`${ACHIEVEMENT} activated:`, client.achievement.isActivated(ACHIEVEMENT));

  // client.achievement.activate(ACHIEVEMENT);
  client.achievement.clear(ACHIEVEMENT);
  client.stats.store();
  console.log("stored");
} catch (error) {
  console.error("connection failed:", error.message);
}

process.exit(0);
