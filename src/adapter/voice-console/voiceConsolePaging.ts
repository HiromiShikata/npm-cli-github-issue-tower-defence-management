export const PAGE_CHARACTER_LIMIT = 3000;

export type PaginatedTextResult =
  | { ok: true; page: number; pageCount: number; text: string }
  | { ok: false; error: 'page_out_of_range'; pageCount: number };

const countPages = (characters: string[]): number =>
  Math.max(1, Math.ceil(characters.length / PAGE_CHARACTER_LIMIT));

export const paginateText = (
  text: string,
  page: number | undefined,
): PaginatedTextResult => {
  const characters = Array.from(text);
  const pageCount = countPages(characters);
  const requestedPage = page ?? 1;
  if (!Number.isInteger(requestedPage) || requestedPage < 1) {
    return { ok: false, error: 'page_out_of_range', pageCount };
  }
  if (requestedPage > pageCount) {
    return { ok: false, error: 'page_out_of_range', pageCount };
  }
  const start = (requestedPage - 1) * PAGE_CHARACTER_LIMIT;
  return {
    ok: true,
    page: requestedPage,
    pageCount,
    text: characters.slice(start, start + PAGE_CHARACTER_LIMIT).join(''),
  };
};
