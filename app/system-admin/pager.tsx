import Link from "next/link";

// Search-params-driven pagination, no client JS - mirrors the filter tabs on
// app/(app)/expenses/page.tsx. Shared by the users and businesses lists,
// the only two paginated lists in the app.
export function Pager({
  page,
  pageSize,
  total,
  basePath,
  q,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  q?: string;
}) {
  if (total <= pageSize && page === 1) return null;

  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const hrefFor = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>
        Showing {from}-{to} of {total}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={hrefFor(page - 1)}
            className="rounded-md px-2.5 py-1 font-medium hover:bg-muted hover:text-foreground"
          >
            Previous
          </Link>
        ) : (
          <span className="rounded-md px-2.5 py-1 font-medium opacity-40">Previous</span>
        )}
        {page < lastPage ? (
          <Link
            href={hrefFor(page + 1)}
            className="rounded-md px-2.5 py-1 font-medium hover:bg-muted hover:text-foreground"
          >
            Next
          </Link>
        ) : (
          <span className="rounded-md px-2.5 py-1 font-medium opacity-40">Next</span>
        )}
      </div>
    </div>
  );
}
