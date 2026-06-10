// Human, abbreviated dates per the design system's content rules
// ("14 Jun", "14 Jun 2026").
const sameYear = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});
const otherYear = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatDate(date: Date, now: Date = new Date()): string {
  return date.getFullYear() === now.getFullYear()
    ? sameYear.format(date)
    : otherYear.format(date);
}

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(date: Date, now: Date = new Date()): string {
  return `${formatDate(date, now)}, ${timeFormat.format(date)}`;
}
