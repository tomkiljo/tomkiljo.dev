import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import App from "./app";

const renderer = await createCliRenderer();
const root = createRoot(renderer);

let isQuitting = false;
const quit = () => {
  if (isQuitting) {
    return;
  }

  isQuitting = true;
  root.unmount();
  renderer.destroy();
  queueMicrotask(() => process.exit(0));
};

root.render(<App onQuit={quit} />);
