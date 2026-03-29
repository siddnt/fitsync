import request from "supertest";
import app from "../src/app.js";
import apiRouter from "../src/api/routes/index.js";
import { createOpenApiSpec } from "../src/docs/openapi.js";

const SUPPORTED_METHODS = new Set(["get", "post", "put", "patch", "delete"]);

const normalizeMountPath = (regexp) =>
  regexp?.source
    ?.replace("\\/?(?=\\/|$)", "")
    ?.replace(/\\\//g, "/")
    ?.replace(/^\^/, "")
    ?.replace(/\$$/, "") ?? "";

const normalizePath = (path) => {
  const normalized = path
    .replace(/:([A-Za-z0-9_]+)/g, "{$1}")
    .replace(/\/+/g, "/");
  return normalized.length > 1 ? normalized.replace(/\/$/, "") : normalized;
};

const collectRoutes = (router, prefix = "") => {
  const routes = [];

  for (const layer of router.stack ?? []) {
    if (layer.route?.path) {
      const routePaths = Array.isArray(layer.route.path)
        ? layer.route.path
        : [layer.route.path];
      const methods = Object.keys(layer.route.methods ?? {}).filter((method) =>
        SUPPORTED_METHODS.has(method),
      );

      for (const routePath of routePaths) {
        const normalizedPath = normalizePath(`${prefix}${routePath}`);
        for (const method of methods) {
          routes.push(`${method.toUpperCase()} ${normalizedPath}`);
        }
      }
      continue;
    }

    if (layer.name === "router" && layer.handle?.stack) {
      const mountPath = normalizeMountPath(layer.regexp);
      routes.push(...collectRoutes(layer.handle, `${prefix}${mountPath}`));
    }
  }

  return routes;
};

describe("OpenAPI route coverage", () => {
  it("documents every mounted /api route and does not keep stale route entries", () => {
    const spec = createOpenApiSpec();
    const actualRoutes = [...new Set(collectRoutes(apiRouter, "/api"))].sort();
    const documentedRoutes = Object.entries(spec.paths)
      .flatMap(([path, operations]) =>
        Object.keys(operations)
          .filter((method) => SUPPORTED_METHODS.has(method))
          .map((method) => `${method.toUpperCase()} ${normalizePath(path)}`),
      )
      .sort();

    const missingFromSpec = actualRoutes.filter(
      (route) => !documentedRoutes.includes(route),
    );
    const staleInSpec = documentedRoutes.filter(
      (route) => !actualRoutes.includes(route),
    );

    expect(missingFromSpec).toEqual([]);
    expect(staleInSpec).toEqual([]);
  });

  it("serves the generated OpenAPI document from /api/docs.json", async () => {
    const res = await request(app).get("/api/docs.json");

    expect(res.status).toBe(200);
    expect(res.body?.openapi).toBe("3.0.3");
    expect(res.body?.paths?.["/api/manager/pending"]?.get).toBeDefined();
    expect(
      res.body?.paths?.["/api/owner/sponsorships/purchase"]?.post?.responses?.[
        "200"
      ],
    ).toBeDefined();
  });
});
