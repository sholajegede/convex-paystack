import { httpRouter } from "convex/server";
import { components } from "./_generated/api";
import { Paystack } from "../../src/client/index.js";

const paystack = new Paystack(components.convexPaystack, {
  secretKey: process.env.PAYSTACK_SECRET_KEY!,
});

const http = httpRouter();

http.route({
  path: "/webhooks/paystack",
  method: "POST",
  handler: paystack.webhookHandler,
});

export default http;
