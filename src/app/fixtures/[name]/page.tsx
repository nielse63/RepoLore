import path from "node:path";
import { notFound } from "next/navigation";
import { deriveJsTsViews } from "@/analysis/js-ts/derive-views";
import { extractJsTsProject } from "@/analysis/js-ts/extract-project";

/**
 * Plain, unstyled proof-of-concept page rendering derived views (Start Here,
 * major areas, entry points, direct relationships) against a local JS/TS
 * fixture. This exists to prove or disprove the core "wow moment" before any
 * styling, acquisition, or persistence work — see implementation-plan.md
 * session 5. Only the two JS/TS fixtures built so far are wired up; Python
 * and mixed-language fixtures are later sessions.
 */
const FIXTURE_NAMES = ["ts-react-app", "ts-library"] as const;
type FixtureName = (typeof FIXTURE_NAMES)[number];

function isFixtureName(value: string): value is FixtureName {
  return (FIXTURE_NAMES as readonly string[]).includes(value);
}

export function generateStaticParams() {
  return FIXTURE_NAMES.map((name) => ({ name }));
}

export default async function FixturePage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  if (!isFixtureName(name)) notFound();

  const fixtureRoot = path.join(process.cwd(), "fixtures", name);
  const extraction = extractJsTsProject(fixtureRoot);
  const { structuralAreas, startHere } = deriveJsTsViews({
    projectId: extraction.project.id,
    ...extraction,
  });

  const { project, entryPoints, relationships, testRelationships, gaps } = extraction;

  return (
    <main>
      <h1>{project.name}</h1>

      <section>
        <h2>What Is This?</h2>
        <ul>
          <li>Kind: {project.kind}</li>
          <li>Languages: {project.languages.join(", ") || "none detected"}</li>
          <li>Frameworks: {project.frameworks.join(", ") || "none detected"}</li>
        </ul>
      </section>

      <section>
        <h2>Start Here</h2>
        <ol>
          {startHere.map((item) => (
            <li key={item.id}>
              <p>
                <code>{item.location.filePath}</code> — {item.whatItRepresents} (
                {item.certainty})
              </p>
              <p>{item.rationale}</p>
              <ul>
                {item.evidence.map((e, i) => (
                  <li key={i}>
                    [{e.certainty}] {e.description}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2>Major Areas</h2>
        <table>
          <thead>
            <tr>
              <th>Area</th>
              <th>Responsibility</th>
              <th>Rationale</th>
              <th>Entry points</th>
              <th>Depends on</th>
              <th>Depended on by</th>
              <th>Tests</th>
              <th>Gaps</th>
            </tr>
          </thead>
          <tbody>
            {structuralAreas.map((area) => (
              <tr key={area.id}>
                <td>{area.name}</td>
                <td>{area.responsibility ?? "—"}</td>
                <td>{area.rationale}</td>
                <td>{area.entryPointIds.length}</td>
                <td>{area.directDependencyIds.length}</td>
                <td>{area.directDependentIds.length}</td>
                <td>{area.testRelationshipIds.length}</td>
                <td>{area.gaps.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Entry Points</h2>
        <ul>
          {entryPoints.map((ep) => (
            <li key={ep.id}>
              [{ep.certainty}] {ep.kind}: <code>{ep.location.filePath}</code>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Direct Relationships</h2>
        <table>
          <thead>
            <tr>
              <th>From</th>
              <th>Kind</th>
              <th>To</th>
              <th>Certainty</th>
            </tr>
          </thead>
          <tbody>
            {relationships.map((rel) => (
              <tr key={rel.id}>
                <td>{rel.fromId}</td>
                <td>{rel.kind}</td>
                <td>{rel.toId}</td>
                <td>{rel.certainty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Test Relationships</h2>
        <ul>
          {testRelationships.map((tr) => (
            <li key={tr.id}>
              [{tr.certainty}] <code>{tr.testLocation.filePath}</code> →{" "}
              <code>{tr.implementationLocation.filePath}</code>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Gaps</h2>
        <ul>
          {gaps.map((gap, i) => (
            <li key={i}>
              [{gap.certainty}] {gap.description}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
