import { CyberBackground } from "./core/App.js";
import { GameShell } from "./ui/GameShell.js";
import { UIReadabilityManager } from "./ui/UIReadabilityManager.js";

const container = document.querySelector("#cyber-background");
const app = new CyberBackground({ container });
window.WorldInvasionUI = new UIReadabilityManager();
window.CyberBackground = CyberBackground;
window.cyberBackground = app;

try {
  await app.init();
  window.CyberGeo = app.api;
  window.WorldInvasion = app.game?.api;
  window.WorldInvasionShell = new GameShell({ app });
  app.start();
} catch (error) {
  console.error(error);
  container?.classList.add("is-static");
}
