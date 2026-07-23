import Link from 'next/link';

/** Plain, unstyled index of the JS/TS fixtures with derived-view pages (see `[name]/page.tsx`). */
export default function FixturesIndexPage() {
  return (
    <main>
      <h1>Fixtures</h1>
      <ul>
        <li>
          <Link href="/fixtures/ts-react-app">ts-react-app</Link>
        </li>
        <li>
          <Link href="/fixtures/ts-library">ts-library</Link>
        </li>
      </ul>
    </main>
  );
}
