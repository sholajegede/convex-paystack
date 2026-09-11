import { defineApp } from "convex/server";
import convexPaystack from "../../src/component/convex.config.js";

const app = defineApp();
app.use(convexPaystack);

export default app;
