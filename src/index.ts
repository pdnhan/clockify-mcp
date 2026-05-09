import { startServer } from "./server.js";

startServer()
  .then(({ port }) => {
    console.log(JSON.stringify({ level: "info", msg: "clockify-mcp listening", port }));
  })
  .catch((err) => {
    console.error(JSON.stringify({ level: "error", msg: String(err?.message ?? err) }));
    process.exit(1);
  });
