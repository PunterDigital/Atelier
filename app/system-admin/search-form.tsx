import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// A plain GET form - no client JS needed, consistent with the searchParams-
// driven filtering used across the app (see app/(app)/expenses/page.tsx).
export function SearchForm({
  action,
  defaultValue,
  placeholder,
}: {
  action: string;
  defaultValue?: string;
  placeholder: string;
}) {
  return (
    <form action={action} className="flex gap-2">
      <Input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={placeholder}
        className="max-w-xs"
      />
      <Button type="submit" variant="outline">
        Search
      </Button>
    </form>
  );
}
