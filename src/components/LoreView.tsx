import type { CertaintyCategory, Lore, SourceLocation } from '@/lore/model';

/**
 * Plain, unstyled rendering of a full `Lore` — shared by the real
 * `/lore/{owner}/{repo}` page (session 10) and the local `/fixtures/{name}`
 * pages, so both stay in sync as the model grows instead of drifting apart.
 * `sourceUrl` is optional and omitted for fixtures, which have no real
 * GitHub commit to link back to; every location still renders, just as
 * plain text instead of a link, rather than fabricating one.
 */

function certaintyLabel(certainty: CertaintyCategory): string {
  return certainty.charAt(0).toUpperCase() + certainty.slice(1);
}

function Loc({
  location,
  sourceUrl,
  children,
}: {
  location: SourceLocation;
  sourceUrl?: (location: SourceLocation) => string;
  children?: React.ReactNode;
}) {
  const label = children ?? location.filePath;
  if (!sourceUrl) return <code>{label}</code>;
  return (
    <a href={sourceUrl(location)} target="_blank" rel="noopener noreferrer">
      <code>{label}</code>
    </a>
  );
}

export interface LoreViewProps {
  lore: Lore;
  /** Builds a GitHub blob (file) URL for a source location; omit when there's no real repository to link to. */
  sourceUrl?: (location: SourceLocation) => string;
  /** Builds a GitHub tree (directory) URL for a structural area's location. Defaults to `sourceUrl` if omitted. */
  areaUrl?: (location: SourceLocation) => string;
}

export function LoreView({
  lore,
  sourceUrl,
  areaUrl = sourceUrl,
}: LoreViewProps) {
  const { snapshot } = lore;
  const project = lore.projects[0];

  // Start Here can seed an item directly from a structural area's location
  // (a directory) rather than a file — recognized by matching a known area,
  // not by guessing from the path shape, so it still needs the tree URL.
  const areaFilePaths = new Set(
    lore.structuralAreas.map((area) => area.location.filePath)
  );
  const startHereUrl = (location: SourceLocation) =>
    areaFilePaths.has(location.filePath) ? areaUrl : sourceUrl;

  return (
    <main>
      <h1>
        {snapshot.repository.owner}/{snapshot.repository.name}
      </h1>
      {snapshot.repository.description && (
        <p>{snapshot.repository.description}</p>
      )}

      <section>
        <h2>Analysis</h2>
        <ul>
          <li>Status: {snapshot.status}</li>
          <li>
            Commit: <code>{snapshot.commitSha}</code>
          </li>
          <li>Analyzed: {new Date(snapshot.analyzedAt).toLocaleString()}</li>
          <li>Analyzer version: {snapshot.analyzerVersion}</li>
        </ul>
      </section>

      {project && (
        <section>
          <h2>What Is This?</h2>
          <ul>
            <li>Kind: {project.kind}</li>
            <li>
              Languages: {project.languages.join(', ') || 'none detected'}
            </li>
            <li>
              Frameworks: {project.frameworks.join(', ') || 'none detected'}
            </li>
          </ul>
        </section>
      )}

      <section>
        <h2>Start Here</h2>
        {lore.startHere.length === 0 ? (
          <p>No Start Here path could be established.</p>
        ) : (
          <ol>
            {lore.startHere.map((item) => (
              <li key={item.id}>
                <p>
                  <Loc
                    location={item.location}
                    sourceUrl={startHereUrl(item.location)}
                  />{' '}
                  — {item.whatItRepresents} ({certaintyLabel(item.certainty)})
                </p>
                <p>{item.rationale}</p>
                <ul>
                  {item.evidence.map((e, i) => (
                    <li key={i}>
                      [{certaintyLabel(e.certainty)}] {e.description}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
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
            {lore.structuralAreas.map((area) => (
              <tr key={area.id}>
                <td>
                  <Loc location={area.location} sourceUrl={areaUrl}>
                    {area.name}
                  </Loc>
                </td>
                <td>{area.responsibility ?? '—'}</td>
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
          {lore.entryPoints.map((ep) => (
            <li key={ep.id}>
              [{certaintyLabel(ep.certainty)}] {ep.kind}:{' '}
              <Loc location={ep.location} sourceUrl={sourceUrl} />
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
            {lore.relationships.map((rel) => (
              <tr key={rel.id}>
                {/* fromId/toId are file paths for the JS/TS extractor specifically, not a
                    shared-model guarantee — revisit if a future extractor uses synthetic ids. */}
                <td>
                  <Loc
                    location={{ filePath: rel.fromId }}
                    sourceUrl={sourceUrl}
                  />
                </td>
                <td>{rel.kind}</td>
                <td>
                  <Loc
                    location={{ filePath: rel.toId }}
                    sourceUrl={sourceUrl}
                  />
                </td>
                <td>{certaintyLabel(rel.certainty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Test Relationships</h2>
        <ul>
          {lore.testRelationships.map((tr) => (
            <li key={tr.id}>
              [{certaintyLabel(tr.certainty)}]{' '}
              <Loc location={tr.testLocation} sourceUrl={sourceUrl} /> →{' '}
              <Loc location={tr.implementationLocation} sourceUrl={sourceUrl} />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Gaps</h2>
        {lore.gaps.length === 0 ? (
          <p>None.</p>
        ) : (
          <ul>
            {lore.gaps.map((gap, i) => (
              <li key={i}>
                [{certaintyLabel(gap.certainty)}] {gap.description}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
