import { categorizeDependency } from "../dependency-category";

describe("categorizeDependency", () => {
  it("categorizes a known testing package", () => {
    expect(categorizeDependency({ name: "jest" })).toBe("testing");
  });

  it("categorizes a known framework package", () => {
    expect(categorizeDependency({ name: "django" })).toBe("framework");
  });

  it("categorizes a known general-purpose library package", () => {
    expect(categorizeDependency({ name: "axios" })).toBe("library");
  });

  it("categorizes a known UI component package", () => {
    expect(categorizeDependency({ name: "@radix-ui/react-tabs" })).toBe(
      "uiComponent"
    );
  });

  it("categorizes a known database package case-insensitively", () => {
    expect(categorizeDependency({ name: "SQLAlchemy" })).toBe("database");
  });

  it("categorizes any @types/ scoped package as types, regardless of the base package name", () => {
    expect(categorizeDependency({ name: "@types/react" })).toBe("types");
    expect(
      categorizeDependency({ name: "@types/some-obscure-internal-tool" })
    ).toBe("types");
  });

  it("categorizes a known dev-only formatter/linter utility", () => {
    expect(categorizeDependency({ name: "prettier" })).toBe("devTooling");
  });

  it("categorizes a known version-control package", () => {
    expect(categorizeDependency({ name: "simple-git" })).toBe("vcs");
  });

  it("categorizes a known CLI-only package", () => {
    expect(categorizeDependency({ name: "commander" })).toBe("cli");
  });

  it("categorizes a known compiler/transpiler package", () => {
    expect(categorizeDependency({ name: "typescript" })).toBe("compiler");
  });

  it("categorizes a known charting package by name", () => {
    expect(categorizeDependency({ name: "d3" })).toBe("dataViz");
  });

  it("categorizes an unlisted package as dataViz from its description", () => {
    expect(
      categorizeDependency({
        name: "some-obscure-charting-lib",
        description: "A lightweight plotting library for the browser.",
      })
    ).toBe("dataViz");
  });

  it("categorizes an unlisted package as dataViz from its keywords", () => {
    expect(
      categorizeDependency({
        name: "some-obscure-internal-tool",
        keywords: ["graphing", "svg"],
      })
    ).toBe("dataViz");
  });

  it("does not treat 'GraphQL' in a description as a data-viz signal", () => {
    expect(
      categorizeDependency({
        name: "some-obscure-internal-tool",
        description: "A spec-compliant GraphQL client.",
      })
    ).toBe("other");
  });

  it("categorizes eslint- prefixed and @eslint/ scoped packages as devTooling, same as eslint", () => {
    expect(categorizeDependency({ name: "eslint-plugin-react" })).toBe(
      "devTooling"
    );
    expect(categorizeDependency({ name: "eslint-config-airbnb" })).toBe(
      "devTooling"
    );
    expect(categorizeDependency({ name: "@eslint/js" })).toBe("devTooling");
  });

  it("categorizes prettier- prefixed and @prettier/ scoped packages as devTooling, same as prettier", () => {
    expect(categorizeDependency({ name: "prettier-plugin-tailwindcss" })).toBe(
      "devTooling"
    );
    expect(categorizeDependency({ name: "@prettier/plugin-php" })).toBe(
      "devTooling"
    );
  });

  it("categorizes jest/@jest/ and playwright/@playwright prefixed packages as testing", () => {
    expect(categorizeDependency({ name: "jest-environment-jsdom" })).toBe(
      "testing"
    );
    expect(categorizeDependency({ name: "@jest/globals" })).toBe("testing");
    expect(categorizeDependency({ name: "playwright-core" })).toBe("testing");
    expect(
      categorizeDependency({ name: "@playwright/experimental-ct-react" })
    ).toBe("testing");
  });

  it("categorizes a package with a 'cli' name token as cli", () => {
    expect(categorizeDependency({ name: "vue-cli" })).toBe("cli");
    expect(categorizeDependency({ name: "@angular/cli" })).toBe("cli");
  });

  it("does not treat 'cli' embedded in a larger word (e.g. 'client') as a CLI signal", () => {
    expect(categorizeDependency({ name: "client" })).toBe("other");
    expect(categorizeDependency({ name: "clipboard" })).toBe("other");
  });

  it("categorizes a known style/css library, framework, or tool as styling", () => {
    expect(categorizeDependency({ name: "tailwindcss" })).toBe("styling");
    expect(categorizeDependency({ name: "sass" })).toBe("styling");
    expect(categorizeDependency({ name: "bootstrap" })).toBe("styling");
    expect(categorizeDependency({ name: "stylelint" })).toBe("styling");
  });

  it("categorizes postcss-/stylelint-/@emotion/ prefixed packages as styling, same as their base tool", () => {
    expect(categorizeDependency({ name: "postcss-nested" })).toBe("styling");
    expect(categorizeDependency({ name: "stylelint-config-standard" })).toBe(
      "styling"
    );
    expect(categorizeDependency({ name: "@emotion/react" })).toBe("styling");
  });

  it("falls back to 'other' for an unrecognized package name", () => {
    expect(categorizeDependency({ name: "some-obscure-internal-tool" })).toBe(
      "other"
    );
  });
});
