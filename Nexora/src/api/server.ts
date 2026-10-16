import express from "express";
import { env } from "../config/env.js";
import { describeProvider } from "../ai/provider.js";
import loanRoutes from "./loan-routes.js";
import tmuRoutes from "./tmu-routes.js";

const app = express();

// Base64 files inflate ~33%, so allow headroom over the 8 MB file limit.
app.use(express.json({ limit: "14mb" }));

// The TMU web app calls this service from the browser.
app.use((req, res, next) => {
  const origin = req.header("origin");
  const allowAny = env.corsOrigins.includes("*");
  if (origin && (allowAny || env.corsOrigins.includes(origin))) {
    res.setHeader("Access-Control-Allow-Origin", allowAny ? "*" : origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  }
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "nexora-loan-intelligence",
    ai: describeProvider(),
  });
});

app.use("/api/loan", loanRoutes);
app.use("/api", tmuRoutes);

app.listen(env.port, () => {
  console.log(`Nexora API running on http://localhost:${env.port} (AI: ${describeProvider()})`);
});
