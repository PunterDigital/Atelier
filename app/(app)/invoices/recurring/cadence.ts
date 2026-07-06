// Human cadence labels for schedules. Display only - the authoritative cadence
// is the (frequency, interval) pair on the schedule row.

type Frequency = "weekly" | "monthly" | "quarterly" | "yearly";

const singular: Record<Frequency, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

const plural: Record<Frequency, string> = {
  weekly: "weeks",
  monthly: "months",
  quarterly: "quarters",
  yearly: "years",
};

export function cadenceLabel(frequency: Frequency, interval: number): string {
  return interval === 1
    ? singular[frequency]
    : `Every ${interval} ${plural[frequency]}`;
}
