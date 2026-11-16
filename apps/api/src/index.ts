import { Effect, Layer, Schema } from "effect";
import { NodeFileSystem, NodePath, NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from "effect/http-api";
import { HttpRouter } from "effect/http";
import { Server } from "node:http";

class HealthGroup extends HttpApiGroup.make("health").add(
  HttpApiEndpoint.get("health", "/health", {
    success: Schema.Struct({ status: Schema.Literal("ok") }),
  }),
) {}

const api = HttpApi.make("wapu").add(HealthGroup);

const HealthLive = HttpApiBuilder.group(api, "health", (handlers) =>
  handlers.handle("health", () => Effect.succeed({ status: "ok" as const })),
);

const App = HttpApiBuilder.layer(api).pipe(Layer.provide(HealthLive));

const Main = HttpRouter.serve(App).pipe(
  Layer.provide(NodeFileSystem.layer),
  Layer.provide(NodePath.layerPosix),
  Layer.provide(NodeHttpServer.layer(() => new Server(), { port: 3000, host: "localhost" })),
  Layer.launch,
);

NodeRuntime.runMain(Main);
