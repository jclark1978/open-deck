import { createApp } from "./server.js";

const port = Number.parseInt(process.env.PORT ?? "3001", 10);
const app = createApp();

app.httpServer.listen(port, () => {
  console.log(`Open Deck backend listening on http://127.0.0.1:${port}`);
});
