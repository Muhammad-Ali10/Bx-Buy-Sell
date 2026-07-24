const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const backendSrcRoot = path.join(repoRoot, "Backend", "src");
const outFile = path.join(repoRoot, "EX_Backend_API.postman_collection.json");

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else if (ent.isFile() && p.endsWith(".controller.ts")) out.push(p);
  }
  return out;
}

function cleanDecoratorArg(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
    return s.slice(1, -1);
  }
  return s;
}

function extractControllerBase(src) {
  // Robust: controller decorators often have @Roles/@ApiTags between @Controller and export class
  const ctrlRe = /@Controller\(([^)]*)\)/g;
  const classRe = /export class\s+([A-Za-z0-9_]+)/g;

  const ctrlMatches = [];
  let m;
  while ((m = ctrlRe.exec(src))) {
    ctrlMatches.push({ base: cleanDecoratorArg(m[1]), at: m.index });
  }
  if (ctrlMatches.length === 0) return null;

  const classMatches = [];
  while ((m = classRe.exec(src))) {
    classMatches.push({ className: m[1], at: m.index });
  }
  if (classMatches.length === 0) return null;

  // Pair the last @Controller before the first export class after it.
  // (Assumes one controller per file, which matches this repo layout.)
  let chosenCtrl = ctrlMatches[ctrlMatches.length - 1];
  let chosenClass = classMatches.find((c) => c.at > chosenCtrl.at) || classMatches[classMatches.length - 1];

  return { base: chosenCtrl.base, className: chosenClass.className };
}

function extractRoutes(src) {
  // Matches: @Get('x') ... methodName(
  const re = /@(Get|Post|Put|Patch|Delete)\(([^)]*)\)[\s\S]*?\n\s*(?:async\s+)?([A-Za-z0-9_]+)\s*\(/g;
  const routes = [];
  let m;
  while ((m = re.exec(src))) {
    routes.push({
      method: m[1].toUpperCase(),
      path: cleanDecoratorArg(m[2]),
      handler: m[3],
      at: m.index,
    });
  }
  return routes;
}

function isFilePublic(src) {
  // If @Public is applied to controller class, all routes are public by default.
  return /@Public\(\)\s*@Controller\(/.test(src) || /@Controller\([\s\S]*?\)\s*@Public\(\)/.test(src);
}

function isHandlerPublic(src, handlerName) {
  // Look back a small window above the handler definition.
  const idx = src.indexOf(`${handlerName}(`);
  if (idx < 0) return false;
  const pre = src.slice(Math.max(0, idx - 300), idx);
  return /@Public\(\)/.test(pre);
}

function normalizePath(base, routePath) {
  const b = base ? `/${String(base).replace(/^\/+/, "")}` : "";
  const r = routePath ? `/${String(routePath).replace(/^\/+/, "")}` : "";
  const full = `${b}${r}`.replace(/\/+/g, "/");
  return full === "" ? "/" : full;
}

function makeRequestItem({ name, method, urlPath, description, auth, body }) {
  const item = {
    name,
    request: {
      method,
      header: [],
      url: {
        raw: `{{baseUrl}}${urlPath}`,
        host: ["{{baseUrl}}"],
        path: urlPath.replace(/^\/+/, "").split("/").filter(Boolean),
      },
      description: description || "",
    },
  };

  if (auth) {
    item.request.header.push({ key: "Authorization", value: "Bearer {{bearerToken}}" });
  }

  if (body !== undefined) {
    item.request.header.push({ key: "Content-Type", value: "application/json" });
    item.request.body = { mode: "raw", raw: JSON.stringify(body, null, 2) };
  }

  return item;
}

function main() {
  const controllerFiles = walk(backendSrcRoot);

  const collection = {
    info: {
      name: "EX Backend API (auto-generated)",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    variable: [
      { key: "baseUrl", value: "http://localhost:3000" },
      { key: "bearerToken", value: "" },
    ],
    item: [],
  };

  let totalRequests = 0;

  for (const file of controllerFiles) {
    const src = fs.readFileSync(file, "utf8");
    const ctrl = extractControllerBase(src);
    if (!ctrl) continue;

    const base = ctrl.base;
    const routes = extractRoutes(src);
    const filePublic = isFilePublic(src);
    const folderName = base || "root";

    const folder = { name: folderName, item: [] };
    for (const r of routes) {
      const urlPath = normalizePath(base, r.path);
      const auth = !(filePublic || isHandlerPublic(src, r.handler));

      const needsBody = ["POST", "PUT", "PATCH"].includes(r.method);
      const body = needsBody ? {} : undefined;

      folder.item.push(
        makeRequestItem({
          name: `${r.method} ${urlPath}`,
          method: r.method,
          urlPath,
          description: path.relative(backendSrcRoot, file).replace(/\\/g, "/"),
          auth,
          body,
        }),
      );
      totalRequests += 1;
    }

    // stable sort for readability
    folder.item.sort((a, b) => a.name.localeCompare(b.name));
    collection.item.push(folder);
  }

  collection.item.sort((a, b) => a.name.localeCompare(b.name));

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(collection, null, 2));

  console.log(`Wrote ${outFile}`);
  console.log(`Controllers: ${collection.item.length}`);
  console.log(`Requests: ${totalRequests}`);
}

main();

