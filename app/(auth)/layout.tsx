// Passthrough layout. The sign-in/sign-up routes render their own full-bleed
// two-panel design (see auth-shell), and the consent route centres its own
// card, so this group layout no longer imposes shared chrome.
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
