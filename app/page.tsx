import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Nav */}
      <header className="flex items-center justify-between border-b px-6 py-4">
        <span className="text-xl font-bold tracking-tight">Crux Pass</span>
        <Link href="/auth">
          <Button variant="outline" size="sm">Sign in</Button>
        </Link>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center">
        <Badge variant="secondary" className="text-sm">Kerala-first · Pay per visit</Badge>
        <h1 className="max-w-xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Try gyms near you.<br />No long-term commitment.
        </h1>
        <p className="max-w-md text-lg text-gray-500">
          Pay for one entry at a time. Scan a QR code, pay securely, walk in. Weekly passes coming soon.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/gyms">
            <Button size="lg" className="w-full sm:w-auto">Find gyms near you</Button>
          </Link>
          <Link href="/auth">
            <Button size="lg" variant="outline" className="w-full sm:w-auto">Sign in</Button>
          </Link>
        </div>
      </main>

      {/* Feature strip */}
      <section className="border-t bg-gray-50 px-6 py-12">
        <div className="mx-auto grid max-w-3xl gap-8 sm:grid-cols-3">
          {[
            {
              title: "Pay per entry",
              desc: "Set by each gym. No hidden fees.",
            },
            {
              title: "QR check-in",
              desc: "Scan at reception. Staff verifies your photo.",
            },
            {
              title: "Save with Plus",
              desc: "₹49/month for a lower platform fee on every visit.",
            },
          ].map((f) => (
            <div key={f.title} className="flex flex-col gap-1">
              <p className="font-semibold text-gray-900">{f.title}</p>
              <p className="text-sm text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t px-6 py-6 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} Crux Pass · Kerala, India
      </footer>
    </div>
  );
}
