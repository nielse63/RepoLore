/**
 * Fixed page size for Major Areas (Overview, Architecture, Systems) — unlike
 * the other paginated lists, Major Areas paginates at a fixed threshold
 * rather than however many rows fit the screen, since Overview renders it as
 * a 2-column grid of variable-height cards that fit-to-screen measurement
 * (see `useFitPageSize`) can't size correctly.
 *
 * Its own module rather than exported from `PaginatedList` because that's a
 * `"use client"` module: a Server Component (Overview, which slices its
 * grid on the server) importing a value from it gets a client reference,
 * not the number.
 */
export const MAJOR_AREAS_PAGE_SIZE = 6;
