// Entry point: validate configuration, then listen. The app itself is built in app.js.
// config/env.js loads .env on import, so import order no longer matters.
import { env, assertEnv } from "./config/env.js";
import { createApp } from "./app.js";

// Fail fast on missing/weak configuration (lists everything that is wrong at once)
assertEnv();

createApp().listen(env.port, () => console.log(`Server running on port ${env.port}`));
