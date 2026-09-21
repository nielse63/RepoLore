import { Project, ScriptTarget, ts } from "ts-morph";
import { detectNextjsConventions } from "../nextjs-conventions";

function makeProject() {
  return new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      allowJs: true,
      target: ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
}

describe("detectNextjsConventions", () => {
  it("recognizes a page.tsx default export as a detected route entry point", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/app/dashboard/page.tsx",
      `export default function Dashboard() { return null; }`
    );
    const entryPoints = detectNextjsConventions(
      project.getSourceFiles(),
      "/root"
    );

    expect(entryPoints).toHaveLength(1);
    expect(entryPoints[0]).toMatchObject({
      kind: "route",
      certainty: "detected",
      location: {
        filePath: "app/dashboard/page.tsx",
        symbolName: "Dashboard",
      },
    });
  });

  it("recognizes a page.tsx default-exported via a separate 'export default' assignment", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/app/dashboard/page.tsx",
      `const Dashboard = () => null;
       export default Dashboard;`
    );
    const entryPoints = detectNextjsConventions(
      project.getSourceFiles(),
      "/root"
    );

    expect(entryPoints).toHaveLength(1);
    expect(entryPoints[0]).toMatchObject({
      kind: "route",
      certainty: "detected",
      location: { symbolName: "Dashboard" },
    });
  });

  it("marks a page.tsx with no default export as inferred, with no symbol name", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/app/dashboard/page.tsx",
      `export function Dashboard() { return null; }`
    );
    const entryPoints = detectNextjsConventions(
      project.getSourceFiles(),
      "/root"
    );

    expect(entryPoints).toHaveLength(1);
    expect(entryPoints[0]).toMatchObject({
      kind: "route",
      certainty: "inferred",
    });
    expect(entryPoints[0].location.symbolName).toBeUndefined();
  });

  it("recognizes generateMetadata alongside a layout.tsx as a framework entry point", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/app/layout.tsx",
      `export default function RootLayout() { return null; }
       export function generateMetadata() { return {}; }`
    );
    const entryPoints = detectNextjsConventions(
      project.getSourceFiles(),
      "/root"
    );

    expect(entryPoints).toHaveLength(2);
    expect(entryPoints).toContainEqual(
      expect.objectContaining({
        kind: "framework",
        certainty: "detected",
        location: expect.objectContaining({ symbolName: "generateMetadata" }),
      })
    );
  });

  it("recognizes exported HTTP method handlers in a route.ts file", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/app/api/users/route.ts",
      `export async function GET() { return new Response(); }
       export async function POST() { return new Response(); }`
    );
    const entryPoints = detectNextjsConventions(
      project.getSourceFiles(),
      "/root"
    );

    expect(entryPoints).toHaveLength(2);
    expect(entryPoints.map((e) => e.location.symbolName).sort()).toEqual([
      "GET",
      "POST",
    ]);
    for (const entry of entryPoints) {
      expect(entry).toMatchObject({
        kind: "http-handler",
        certainty: "detected",
      });
    }
  });

  it("marks a route.ts with no recognized handler export as inferred", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/app/api/users/route.ts",
      `export function helper() { return null; }`
    );
    const entryPoints = detectNextjsConventions(
      project.getSourceFiles(),
      "/root"
    );

    expect(entryPoints).toHaveLength(1);
    expect(entryPoints[0]).toMatchObject({
      kind: "http-handler",
      certainty: "inferred",
    });
  });

  it("recognizes a middleware.ts default export as detected", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/middleware.ts",
      `export default function middleware() { return null; }`
    );
    const entryPoints = detectNextjsConventions(
      project.getSourceFiles(),
      "/root"
    );

    expect(entryPoints).toHaveLength(1);
    expect(entryPoints[0]).toMatchObject({
      kind: "middleware",
      certainty: "detected",
      location: { symbolName: "middleware" },
    });
  });

  it("marks a middleware.ts with no recognized export as inferred", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/middleware.ts",
      `export function helper() { return null; }`
    );
    const entryPoints = detectNextjsConventions(
      project.getSourceFiles(),
      "/root"
    );

    expect(entryPoints).toHaveLength(1);
    expect(entryPoints[0]).toMatchObject({
      kind: "middleware",
      certainty: "inferred",
    });
  });

  it("recognizes an exported async function under a 'use server' directive as a server action", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/app/actions.ts",
      `"use server";
       export async function createUser() {}
       function helper() {}
       export function notAsync() {}`
    );
    const entryPoints = detectNextjsConventions(
      project.getSourceFiles(),
      "/root"
    );

    expect(entryPoints).toHaveLength(1);
    expect(entryPoints[0]).toMatchObject({
      kind: "server-action",
      certainty: "detected",
      location: { symbolName: "createUser" },
    });
  });

  it("produces no entry points for a file matching no convention", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/utils.ts",
      `export function helper() { return 1; }`
    );
    const entryPoints = detectNextjsConventions(
      project.getSourceFiles(),
      "/root"
    );

    expect(entryPoints).toHaveLength(0);
  });
});
