import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ExternalLink,
  Image as ImageIcon,
  LifeBuoy,
  Send,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  Input,
  Label,
  Select,
  SelectItem,
  Textarea,
} from "./ui";
import {
  HELPDESK_CATEGORIES,
  type HelpdeskCategory,
  openHelpdeskTicket,
} from "../lib/helpdesk";
import { pb } from "../lib/pocketbase";

interface HelpdeskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCategory?: HelpdeskCategory;
  defaultSubject?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function HelpdeskModal({
  open,
  onOpenChange,
  defaultCategory = "bug_error",
  defaultSubject = "",
}: HelpdeskModalProps) {
  const [subject, setSubject] = useState(defaultSubject);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<HelpdeskCategory>(defaultCategory);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bersihkan object URL saat preview berubah atau dialog tertutup
  useEffect(() => {
    if (!photoFile) {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
        setPhotoPreview(null);
      }
      return;
    }

    const previewUrl = URL.createObjectURL(photoFile);
    setPhotoPreview(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [photoFile]);

  // Reset form saat dialog dibuka ulang
  useEffect(() => {
    if (open) {
      setSubject(defaultSubject);
      setDescription("");
      setCategory(defaultCategory);
      setPhotoFile(null);
      setIsDragging(false);
      setSubmitting(false);
    }
  }, [open, defaultSubject, defaultCategory]);

  const handleSelectFile = useCallback((file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Mohon pilih berkas gambar (JPG, PNG, atau WEBP).");
      return;
    }
    // Batas 15 MB
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Ukuran gambar terlalu besar (maksimal 15 MB).");
      return;
    }
    setPhotoFile(file);
    try {
      navigator.vibrate?.(10);
    } catch {}
  }, []);

  // Tangkap paste event (Ctrl+V) saat pengguna menempelkan screenshot langsung
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            handleSelectFile(file);
            toast.info("Tangkapan layar dari clipboard berhasil dilampirkan.");
            break;
          }
        }
      }
    },
    [handleSelectFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files?.[0];
      handleSelectFile(droppedFile);
    },
    [handleSelectFile],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedDesc = description.trim();
    if (!trimmedDesc) {
      toast.error("Mohon jelaskan keluhan atau kendala Anda.");
      return;
    }

    setSubmitting(true);

    try {
      try {
        navigator.vibrate?.(12);
      } catch {}

      // Tentukan subjek otomatis jika pengguna mengosongkan judul
      const finalSubject =
        subject.trim() ||
        trimmedDesc.split("\n")[0].slice(0, 60).trim() ||
        "Kendala Aplikasi LifePlanner";

      // Jika ada file foto, coba salin gambar ke clipboard agar mudah ditempel di Helpdesk
      if (photoFile && typeof navigator !== "undefined" && navigator.clipboard?.write) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ [photoFile.type]: photoFile }),
          ]);
        } catch {
          // Clipboard write izin opsional
        }
      }

      // Format deskripsi lengkap dengan informasi konteks dan indikator lampiran foto
      const fromUrl =
        typeof window !== "undefined" ? window.location.href : "";

      let formattedDescription = trimmedDesc;
      if (photoFile) {
        formattedDescription += `\n\n---\n📎 Lampiran Foto Masalah: ${photoFile.name} (${formatFileSize(photoFile.size)})`;
      }
      if (fromUrl) {
        formattedDescription += `\n🌐 Halaman saat kendala: ${fromUrl}`;
      }

      // Buka handoff Helpdesk di tab baru
      openHelpdeskTicket({
        subject: finalSubject,
        description: formattedDescription,
        category,
        fromUrl,
        photoName: photoFile?.name,
        photoSize: photoFile?.size,
      });

      toast.success("Laporan dialihkan ke formulir VPS Helpdesk di tab baru.");
      if (photoFile) {
        toast.info(
          "Foto kendala telah disalin ke clipboard — Anda juga dapat menempelkannya (Ctrl+V) di formulir Helpdesk.",
          { duration: 4500 },
        );
      }

      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal membuka VPS Helpdesk.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const user = pb.authStore.record as any;
  const userName = user?.name || user?.email || "Pengguna";
  const userRole = user?.role === "superadmin" ? "Admin" : "Member";

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent/10 text-accent">
            <LifeBuoy size={18} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-ink">Bantuan & Laporkan Kendala</h2>
            <p className="text-xs text-ink-soft font-normal">
              Kirimkan keluhan langsung ke sistem Helpdesk terpusat.
            </p>
          </div>
        </div>
      }
      className="max-w-xl"
    >
      <form onSubmit={handleSubmit} onPaste={handlePaste} className="space-y-4 pt-1">
        {/* Kategori Kendala */}
        <div>
          <Label htmlFor="helpdesk-category">Kategori Masalah</Label>
          <Select
            id="helpdesk-category"
            value={category}
            onValueChange={(val) => setCategory(val as HelpdeskCategory)}
          >
            {HELPDESK_CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                <span className="mr-2">{cat.icon}</span>
                {cat.label}
              </SelectItem>
            ))}
          </Select>
        </div>

        {/* Judul Singkat */}
        <div>
          <Label htmlFor="helpdesk-subject">
            Judul / Ringkasan Kendala <span className="text-ink-faint">(Opsional)</span>
          </Label>
          <Input
            id="helpdesk-subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Contoh: Saldo rekening tidak berkurang setelah transaksi"
            maxLength={180}
          />
        </div>

        {/* Deskripsi Keluhan (Wajib) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <Label htmlFor="helpdesk-desc" className="mb-0">
              Keluhan & Kronologi Masalah <span className="text-negative">*</span>
            </Label>
            <span className="text-[11px] text-ink-faint">
              {description.length}/4000
            </span>
          </div>
          <Textarea
            id="helpdesk-desc"
            required
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ceritakan apa yang sedang Anda lakukan, langkah sebelum masalah muncul, atau pesan error yang tampil..."
            maxLength={4000}
            className="min-h-24 text-sm"
          />
        </div>

        {/* Unggah Foto / Screenshot Kendala (Tidak Mandatory) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <Label className="mb-0">
              Foto Masalah / Tangkapan Layar{" "}
              <span className="text-ink-faint font-normal">(Tidak Wajib)</span>
            </Label>
            {photoFile && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={12} />
                Foto Terlampir
              </span>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleSelectFile(e.target.files?.[0])}
          />

          {photoFile && photoPreview ? (
            <div className="relative flex items-center gap-3 rounded-xl border border-line/20 bg-muted/30 p-2.5 transition">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-line/15 bg-surface">
                <img
                  src={photoPreview}
                  alt="Preview screenshot kendala"
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-ink">
                  {photoFile.name}
                </p>
                <p className="text-[11px] text-ink-soft">
                  {formatFileSize(photoFile.size)} • Siap diteruskan
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-1 text-[11px] text-accent hover:underline font-medium"
                >
                  Ganti gambar lain
                </button>
              </div>

              <button
                type="button"
                onClick={() => setPhotoFile(null)}
                aria-label="Hapus foto kendala"
                title="Hapus foto ini"
                className="grid h-8 w-8 place-items-center rounded-lg text-ink-faint hover:bg-line/[.08] hover:text-negative transition"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`group flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-4 text-center transition ${
                isDragging
                  ? "border-accent bg-accent/5"
                  : "border-line/20 bg-surface hover:border-line/40 hover:bg-muted/40"
              }`}
            >
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-ink-soft transition group-hover:scale-105 group-hover:text-ink">
                <Camera size={18} />
              </div>
              <p className="mt-2 text-xs font-medium text-ink">
                Pilih foto atau seret berkas ke sini
              </p>
              <p className="mt-0.5 text-[11px] text-ink-faint">
                Bisa juga tekan <kbd className="rounded border border-line/20 bg-muted px-1 py-0.5 font-mono text-[10px]">Ctrl+V</kbd> untuk menempelkan screenshot
              </p>
            </div>
          )}
        </div>

        {/* Info Konteks Otomatis */}
        <div className="rounded-xl border border-line/10 bg-muted/30 px-3.5 py-2.5 text-[11px] leading-5 text-ink-soft space-y-1">
          <div className="flex items-center justify-between">
            <span>Pelapor:</span>
            <span className="font-medium text-ink">
              {userName} ({userRole})
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Tujuan:</span>
            <span className="font-mono text-ink">VPS Helpdesk (life-planner)</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-line/10">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Batal
          </Button>

          <Button
            type="submit"
            variant="primary"
            disabled={submitting || !description.trim()}
            className="gap-2"
          >
            {submitting ? (
              <span>Mengirim...</span>
            ) : (
              <>
                <Send size={14} />
                <span>Kirim ke Helpdesk</span>
                <ExternalLink size={12} className="opacity-70" />
              </>
            )}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
