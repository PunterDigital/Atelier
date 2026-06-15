import Image from "next/image";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4 py-12">
      <Image
        src="/brand/clerq-logo.svg"
        alt="Clerq"
        width={132}
        height={36}
        priority
      />
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
