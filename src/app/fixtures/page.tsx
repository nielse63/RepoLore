import Link from "next/link";

/** Plain, unstyled index of the fixtures with derived-view pages (see `[name]/page.tsx`). */
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
        <li>
          <Link href="/fixtures/python-app">python-app</Link>
        </li>
        <li>
          <Link href="/fixtures/python-library">python-library</Link>
        </li>
      </ul>
    </main>
  );
}
