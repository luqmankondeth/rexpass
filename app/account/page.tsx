"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

export default function AccountPage() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/auth"; return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, phone, photo_path")
        .eq("id", user.id)
        .single();

      if (profile) {
        setDisplayName(profile.display_name ?? "");
        setPhone(profile.phone ?? "");
        setPhotoPath(profile.photo_path);
        if (profile.photo_path) {
          const { data } = supabase.storage.from("avatars").getPublicUrl(profile.photo_path);
          setPhotoUrl(data.publicUrl);
        }
      }
      setLoading(false);
    }
    loadProfile();
  }, [supabase]);

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Please select a JPEG, PNG, or WebP image.");
      return;
    }

    setUploadingPhoto(true);
    try {
      const res = await fetch("/api/v1/profile/photo/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content_type: file.type }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error?.message ?? "Upload failed"); return; }

      const { signed_url, path } = json.upload;

      const uploadRes = await fetch(signed_url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) { toast.error("Photo upload failed. Try again."); return; }

      setPhotoPath(path);
      setPhotoUrl(URL.createObjectURL(file));
      toast.success("Photo uploaded!");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) { toast.error("Name is required"); return; }
    if (!phone.match(/^\+91[6-9]\d{9}$/)) {
      toast.error("Enter a valid Indian mobile number starting with +91");
      return;
    }
    if (!photoPath) { toast.error("Please upload a photo before saving"); return; }

    setSaving(true);
    const res = await fetch("/api/v1/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: displayName.trim(), phone }),
    });
    const json = await res.json();
    setSaving(false);

    if (!res.ok) {
      toast.error(json.error?.message ?? "Failed to save profile");
      return;
    }
    toast.success("Profile saved!");
    window.location.href = "/";
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Set up your profile</CardTitle>
          <CardDescription>
            Your photo is used only for gym check-in verification.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="flex flex-col gap-5">
            {/* Photo */}
            <div className="flex flex-col items-center gap-3">
              <Avatar className="h-20 w-20 cursor-pointer ring-2 ring-offset-2 ring-gray-200"
                onClick={() => fileInputRef.current?.click()}>
                <AvatarImage src={photoUrl ?? undefined} alt="Profile photo" />
                <AvatarFallback className="text-2xl">
                  {displayName?.[0]?.toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingPhoto}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingPhoto ? "Uploading…" : photoPath ? "Change photo" : "Upload photo"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePhotoSelect}
              />
              <p className="text-xs text-gray-400">Required for check-in verification</p>
            </div>

            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>

            {/* Phone */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Mobile number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+91 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\s/g, ""))}
                required
              />
              <p className="text-xs text-gray-400">Indian number required (+91…)</p>
            </div>

            <Button type="submit" disabled={saving} className="w-full">
              {saving ? "Saving…" : "Save profile"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
