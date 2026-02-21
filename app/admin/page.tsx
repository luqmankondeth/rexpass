import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminPage() {
  const links = [
    { href: "/admin/gyms", label: "Gyms", desc: "Create / edit gyms and assign staff" },
    { href: "/admin/settlements", label: "Settlements", desc: "Run weekly batch · download CSV" },
    { href: "/admin/refunds", label: "Refunds", desc: "Issue refunds via Razorpay" },
  ];

  return (
    <div className="mx-auto max-w-md px-6 py-12">
      <h1 className="mb-6 text-2xl font-bold">Admin portal</h1>
      <div className="flex flex-col gap-3">
        {links.map((l) => (
          <Card key={l.href}>
            <CardHeader className="pb-1">
              <CardTitle className="text-base">{l.label}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between pt-0">
              <p className="text-sm text-gray-500">{l.desc}</p>
              <Link href={l.href}>
                <Button size="sm" variant="outline">Open</Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
