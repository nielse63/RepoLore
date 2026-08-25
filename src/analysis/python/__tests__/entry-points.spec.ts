import type { Parser } from "web-tree-sitter";
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
