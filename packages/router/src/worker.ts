import { attachRouterWorker, type RouterWorkerScope } from "./messages";

const scope = globalThis as Partial<RouterWorkerScope> & { document?: unknown; window?: unknown };

if (
  typeof scope.postMessage === "function" &&
  typeof scope.document === "undefined" &&
  typeof scope.window === "undefined"
) {
  attachRouterWorker(scope as RouterWorkerScope);
}
