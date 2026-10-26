import { createMapController } from "./map/controller";
import { mountUi } from "./ui/index";
import "./page.css";

const mapRoot = document.getElementById("map-root");
if (!mapRoot) throw new Error("missing #map-root");

const controller = createMapController(mapRoot, { demo: import.meta.env.DEV });
const uiRoot = document.getElementById("ui-root");
if (uiRoot) mountUi(uiRoot, controller);
