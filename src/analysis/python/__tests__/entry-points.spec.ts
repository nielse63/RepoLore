import type { Parser } from "web-tree-sitter";
import type { Relationship } from "@/lore/model";
import type { PythonSourceFile } from "../discovery";
import { createPythonParser, parsePythonSource } from "../parser";
import { extractEntryPoints } from "../entry-points";
import type { PythonProjectConfig } from "../project-config";

let parser: Parser;

beforeAll(async () => {
  parser = await createPythonParser();
});

function file(relativePath: string, sourceText: string): PythonSourceFile {
  return {
    absolutePath: `/root/${relativePath}`,
    relativePath,
    sourceText,
    tree: parsePythonSource(parser, sourceText),
  };
}

function emptyConfig(): PythonProjectConfig {
  return { consoleScripts: [], dependencies: [] };
}

describe("extractEntryPoints", () => {
  it("resolves a declared console script to its module file", () => {
    const files = [file("pkg/cli.py", "def main():\n    pass\n")];
    const config: PythonProjectConfig = {
      consoleScripts: [
        {
          name: "mycli",
          target: "pkg.cli:main",
          sourceFile: "pyproject.toml",
          configKey: "project.scripts.mycli",
        },
      ],
      dependencies: [],
    };

    const entryPoints = extractEntryPoints(files, "/root", config);

    expect(entryPoints).toHaveLength(1);
    expect(entryPoints[0]).toMatchObject({
      kind: "cli",
      id: "python-entry-console-script-mycli",
      location: { filePath: "pkg/cli.py" },
      certainty: "detected",
    });
  });

  it("detects a __main__.py entry point", () => {
    const files = [file("pkg/__main__.py", "")];
    const entryPoints = extractEntryPoints(files, "/root", emptyConfig());

    expect(entryPoints).toHaveLength(1);
    expect(entryPoints[0]).toMatchObject({
      kind: "cli",
      location: { filePath: "pkg/__main__.py" },
    });
  });

  it('detects a top-level if __name__ == "__main__" bootstrap guard', () => {
    const files = [
      file("app.py", 'if __name__ == "__main__":\n    print("hi")\n'),
    ];
    const entryPoints = extractEntryPoints(files, "/root", emptyConfig());

    expect(entryPoints).toHaveLength(1);
    expect(entryPoints[0]).toMatchObject({
      kind: "bootstrap",
      location: { filePath: "app.py" },
    });
  });

  it('detects the bootstrap guard with operands reversed ("__main__" == __name__)', () => {
    const files = [
      file("app.py", 'if "__main__" == __name__:\n    print("hi")\n'),
    ];
    const entryPoints = extractEntryPoints(files, "/root", emptyConfig());
    expect(entryPoints).toHaveLength(1);
  });

  it("does not treat a bootstrap guard in a test file as an entry point", () => {
    const files = [
      file("test_app.py", 'if __name__ == "__main__":\n    unittest.main()\n'),
    ];
    const entryPoints = extractEntryPoints(files, "/root", emptyConfig());
    expect(entryPoints).toEqual([]);
  });

  it("does not treat a bootstrap guard under a nested test directory as an entry point (GitHub issue #65)", () => {
    const files = [
      file(
        "pkg/tests/run_all.py",
        'if __name__ == "__main__":\n    unittest.main()\n'
      ),
    ];
    const entryPoints = extractEntryPoints(files, "/root", emptyConfig());
    expect(entryPoints).toEqual([]);
  });

  it("does not treat a test suite's __main__.py as a cli entry point (GitHub issue #65)", () => {
    // `python -m pkg.tests` runs the suite; a cli entry point here would
    // also contradict the directory and re-admit run_all.py's guard.
    const files = [
      file("pkg/tests/__main__.py", "run_tests()\n"),
      file(
        "pkg/tests/run_all.py",
        'if __name__ == "__main__":\n    unittest.main()\n'
      ),
      file("tests/__main__.py", "run_tests()\n"),
    ];
    const entryPoints = extractEntryPoints(files, "/root", emptyConfig());
    expect(entryPoints).toEqual([]);
  });

  it("still detects that guard when production code imports from the directory", () => {
    // A test-named package production code imports isn't a test suite
    // (e.g. Django's shipped `django/test/`).
    const files = [
      file("django/test/runner.py", 'if __name__ == "__main__":\n    run()\n'),
    ];
    const productionImport: Relationship = {
      id: "rel",
      kind: "depends-on",
      fromId: "django/core/handlers.py",
      toId: "django/test/runner.py",
      certainty: "detected",
      evidence: [],
    };
    const entryPoints = extractEntryPoints(files, "/root", emptyConfig(), [
      productionImport,
    ]);
    expect(entryPoints).toEqual([
      expect.objectContaining({
        kind: "bootstrap",
        location: { filePath: "django/test/runner.py" },
      }),
    ]);
  });

  it("resolves the package name to its __init__.py as a library entry point", () => {
    const files = [file("myapp/__init__.py", "")];
    const config: PythonProjectConfig = {
      name: "myapp",
      consoleScripts: [],
      dependencies: [],
    };

    const entryPoints = extractEntryPoints(files, "/root", config);

    expect(entryPoints).toHaveLength(1);
    expect(entryPoints[0]).toMatchObject({
      kind: "library",
      id: "python-entry-package-init",
      location: { filePath: "myapp/__init__.py" },
    });
  });

  it("normalizes hyphens to underscores when resolving the package name", () => {
    const files = [file("my_app/__init__.py", "")];
    const config: PythonProjectConfig = {
      name: "my-app",
      consoleScripts: [],
      dependencies: [],
    };

    const entryPoints = extractEntryPoints(files, "/root", config);
    expect(entryPoints).toHaveLength(1);
  });

  it("falls back to a conventional main.py when nothing else matches", () => {
    const files = [file("main.py", "")];
    const entryPoints = extractEntryPoints(files, "/root", emptyConfig());

    expect(entryPoints).toHaveLength(1);
    expect(entryPoints[0]).toMatchObject({
      kind: "runtime",
      certainty: "inferred",
      location: { filePath: "main.py" },
    });
  });

  it("words the main.py fallback's evidence so an excluded test-suite __main__.py isn't denied", () => {
    const files = [
      file("main.py", ""),
      file("pkg/tests/__main__.py", "run_tests()\n"),
    ];
    const entryPoints = extractEntryPoints(files, "/root", emptyConfig());

    expect(entryPoints).toEqual([
      expect.objectContaining({ location: { filePath: "main.py" } }),
    ]);
    expect(entryPoints[0].evidence[0].description).toBe(
      "No console-script or __main__.py entry outside a test suite was found; 'main.py' matches the conventional main-file location."
    );
  });

  it("returns no entry points when nothing matches any heuristic", () => {
    const files = [file("util.py", "def helper():\n    pass\n")];
    const entryPoints = extractEntryPoints(files, "/root", emptyConfig());
    expect(entryPoints).toEqual([]);
  });

  it("does not double-claim a file across heuristics", () => {
    const files = [
      file("pkg/cli.py", 'if __name__ == "__main__":\n    pass\n'),
    ];
    const config: PythonProjectConfig = {
      consoleScripts: [
        {
          name: "mycli",
          target: "pkg.cli:main",
          sourceFile: "pyproject.toml",
          configKey: "project.scripts.mycli",
        },
      ],
      dependencies: [],
    };

    const entryPoints = extractEntryPoints(files, "/root", config);
    expect(entryPoints).toHaveLength(1);
    expect(entryPoints[0].kind).toBe("cli");
    expect(entryPoints[0].id).toBe("python-entry-console-script-mycli");
  });
});
