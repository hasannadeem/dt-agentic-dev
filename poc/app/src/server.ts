import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3000);

createApp().listen(port, () => {
  console.error(`poc-task-api listening on :${port}`);
});
