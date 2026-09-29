"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import { AtSign, CalendarDays, Fingerprint, Loader2, Lock, Trash2, UploadCloud, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import { Avatar } from "@/components/ui/Avatar";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/AuthContext";
import { profileApi } from "@/lib/resources";
import { validateName } from "@/lib/validation";
import { cn } from "@/lib/utils";

const BIO_MAX = 280;
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="glass glass-sheen relative rounded-2xl p-5 sm:p-6">
      <h2 className="text-sm font-semibold text-slate-50">{title}</h2>
      {description && <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** A value the user cannot change here, shown so the account still reads as
 *  complete. Rendered as text rather than a disabled input: a greyed-out box
 *  invites clicking and then explains nothing. */
function ReadOnlyRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof AtSign;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-white/[0.07] py-3 last:border-0">
      <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
        <p className={cn("mt-0.5 break-all text-sm text-slate-200", mono && "font-mono text-xs")}>
          {value}
        </p>
      </div>
      <Lock aria-label="Read only" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" />
    </div>
  );
}

function ProfileContent() {
  const { user, applyUser } = useAuth();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Seed from the account, then leave the fields alone. Keying this on the
  // whole user would re-seed after an avatar upload too, silently throwing
  // away name or bio edits the user had typed but not yet saved.
  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setBio(user.bio ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const dirty = useMemo(
    () => !!user && (name !== user.name || bio !== (user.bio ?? "")),
    [user, name, bio]
  );

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const error = validateName(name);
    setNameError(error);
    if (error) return;

    setSaving(true);
    try {
      applyUser(await profileApi.update({ name: name.trim(), bio: bio.trim() }));
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarPicked(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Let the same file be picked again after a failure.
    e.target.value = "";
    if (!file) return;

    if (!AVATAR_TYPES.includes(file.type)) {
      toast.error("Choose a PNG, JPEG, WebP or GIF image.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error("That image is over 5 MB. Pick a smaller one.");
      return;
    }

    setUploading(true);
    try {
      applyUser(await profileApi.uploadAvatar(file));
      toast.success("Profile picture updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload that image");
    } finally {
      setUploading(false);
    }
  }

  async function handleAvatarRemove() {
    setUploading(true);
    try {
      applyUser(await profileApi.removeAvatar());
      toast.success("Profile picture removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove your picture");
    } finally {
      setUploading(false);
    }
  }

  const memberSince = user
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="mx-auto max-w-3xl px-5 py-9">
        <PageHeader title="Profile" description="How you appear across TensorNest." />

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-5"
        >
          <Card
            title="Profile picture"
            description="PNG, JPEG, WebP or GIF, up to 5 MB. Shown in the header and on your account."
          >
            <div className="flex flex-wrap items-center gap-5">
              <Avatar src={user?.avatar_url} name={user?.name} email={user?.email} size="lg" />
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept={AVATAR_TYPES.join(",")}
                  onChange={handleAvatarPicked}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="btn-accent"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UploadCloud className="h-4 w-4" />
                  )}
                  {user?.avatar_url ? "Replace" : "Upload photo"}
                </button>
                {user?.avatar_url && (
                  <button
                    type="button"
                    onClick={handleAvatarRemove}
                    disabled={uploading}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/12 px-3.5 py-2 text-sm text-slate-300 transition hover:bg-rose-500/12 hover:text-rose-200 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </button>
                )}
              </div>
            </div>
          </Card>

          <form onSubmit={handleSave} noValidate>
            <Card title="Details" description="Only your display name is shown to anyone else.">
              <div className="space-y-5">
                <Field
                  id="profile-name"
                  label="Display name"
                  icon={UserIcon}
                  value={name}
                  onChange={(v) => {
                    setName(v);
                    if (nameError) setNameError(null);
                  }}
                  onBlur={() => setNameError(validateName(name))}
                  error={nameError}
                  autoComplete="name"
                  maxLength={255}
                />

                <div className="space-y-1.5">
                  <label
                    htmlFor="profile-bio"
                    className="block text-xs font-medium uppercase tracking-wide text-muted"
                  >
                    Bio
                  </label>
                  <textarea
                    id="profile-bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
                    rows={3}
                    placeholder="What are you training?"
                    className="glass-input resize-y"
                  />
                  <p className="text-right text-xs text-muted">
                    {bio.length}/{BIO_MAX}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                {dirty && <span className="text-xs text-muted">Unsaved changes</span>}
                <button type="submit" disabled={!dirty || saving} className="btn-accent">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save changes
                </button>
              </div>
            </Card>
          </form>

          <Card
            title="Account"
            description="Fixed for now. Your email is both your sign-in and where job notifications are sent, so changing it needs a verification step."
          >
            <div className="-my-3">
              <ReadOnlyRow icon={AtSign} label="Email" value={user?.email ?? ""} />
              <ReadOnlyRow icon={CalendarDays} label="Member since" value={memberSince} />
              <ReadOnlyRow icon={Fingerprint} label="Account ID" value={user?.id ?? ""} mono />
            </div>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfileContent />
    </AuthGuard>
  );
}
