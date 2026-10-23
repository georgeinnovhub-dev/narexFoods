"use client";

import { useEffect, useRef, useState } from "react";
import { CreditCard, Eye, ImageUp, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { apiGet, apiSend, formatGHS } from "@/lib/client";
import { apiErrorBody, apiErrorStatus, type PaymentsConfig } from "./storefront-lib";
import { StatusBadge } from "./status-badge";
import type { OrderDTO } from "@/lib/types";

/** XHR upload so we get real progress events (fetch cannot report upload progress). */
function uploadEvidence(
  reference: string,
  phone: string,
  file: File,
  onProgress: (pct: number) => void
): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/orders/${encodeURIComponent(reference)}/evidence`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      let data: { success?: boolean; message?: string; error?: string } = {};
      try {
        data = JSON.parse(xhr.responseText) as typeof data;
      } catch {
        /* non-JSON body */
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve({ success: true, message: data.message ?? "Payment evidence uploaded" });
      } else {
        reject(new Error(data.error || `Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed — please check your connection"));
    const fd = new FormData();
    fd.append("phone", phone);
    fd.append("file", file);
    xhr.send(fd);
  });
}

export function PaymentBox({ order }: { order: OrderDTO }) {
  const [config, setConfig] = useState<PaymentsConfig | null>(null);
  const [phone, setPhone] = useState(order.customerPhone);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [paying, setPaying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let alive = true;
    apiGet<PaymentsConfig>("/api/payments/config")
      .then((c) => {
        if (alive) setConfig(c);
      })
      .catch(() => {
        /* config is optional — UI degrades */
      });
    return () => {
      alive = false;
    };
  }, []);

  const paymentStatus = order.paymentStatus;
  const manual = config?.manual;
  const isPaid = paymentStatus === "paid";
  const isAwaiting = uploaded || paymentStatus === "awaiting_review";
  const canUpload = Boolean(manual?.enabled) && !isPaid && !isAwaiting;
  const canPayCard = Boolean(config?.paystack.enabled) && !isPaid && !isAwaiting;

  async function handleUpload() {
    if (!file) {
      toast.error("Choose a receipt image first");
      return;
    }
    const trimmedPhone = phone.trim() || order.customerPhone;
    if (!trimmedPhone) {
      toast.error("Enter the phone number used for the order");
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const res = await uploadEvidence(order.reference, trimmedPhone, file, setProgress);
      setUploaded(true);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success(res.message || "Payment evidence uploaded — awaiting review");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function payByCard() {
    setPaying(true);
    try {
      const res = await apiSend<{ authorizationUrl: string; providerReference: string }>(
        "/api/payments/paystack/init",
        "POST",
        { reference: order.reference }
      );
      window.location.href = res.authorizationUrl;
    } catch (err) {
      const status = apiErrorStatus(err);
      const body = apiErrorBody(err);
      toast.error(
        status === 409
          ? body?.error ?? "Card payment is not available right now — please pay by mobile money instead."
          : body?.error ?? (err instanceof Error ? err.message : "Could not start card payment")
      );
      setPaying(false);
    }
  }

  return (
    <section aria-labelledby={`payment-${order.reference}`} className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id={`payment-${order.reference}`} className="font-display text-lg font-semibold text-forest">
          Payment
        </h2>
        <StatusBadge status={paymentStatus} kind="payment" />
      </div>

      <p className="text-sm text-muted-foreground">
        Amount due: <span className="font-semibold text-foreground">{formatGHS(order.total)}</span>
      </p>

      {isPaid ? (
        <p className="rounded-2xl border border-emerald-600/30 bg-emerald-600/10 px-4 py-3 text-sm text-emerald-700">
          Payment confirmed — thank you!
        </p>
      ) : isAwaiting ? (
        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
          We&apos;ve received your payment evidence and our team is reviewing it. You&apos;ll see the status above update once verified.
        </p>
      ) : (
        <>
          {/* Manual payment details */}
          {manual?.enabled && (
            <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
              <p className="text-sm">
                <span className="text-muted-foreground">Pay to: </span>
                <span className="font-semibold">{manual.recipientName}</span>
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Method: </span>
                <span className="font-semibold">{manual.method}</span>
              </p>
              <p className="rounded-lg bg-muted px-3 py-2 font-mono text-sm">{manual.details}</p>
              <Separator />
              <p className="text-xs leading-relaxed text-muted-foreground">{manual.instructions}</p>
            </div>
          )}

          {/* Evidence upload */}
          {canUpload && (
            <div className="space-y-3 rounded-2xl border border-dashed border-gold/50 bg-gold/5 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-forest">
                <ImageUp className="size-4" aria-hidden="true" />
                Upload payment evidence
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                id={`evidence-file-${order.reference}`}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-11 rounded-xl border-forest/30 text-forest hover:bg-forest hover:text-cream"
                  aria-label="Choose receipt image"
                >
                  <Eye className="size-4" aria-hidden="true" />
                  Choose image
                </Button>
                <span className="max-w-48 truncate text-xs text-muted-foreground" aria-live="polite">
                  {file ? file.name : "No file selected yet"}
                </span>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`evidence-phone-${order.reference}`} className="text-xs text-muted-foreground">
                  Phone used for this order
                </Label>
                <Input
                  id={`evidence-phone-${order.reference}`}
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="min-h-11 rounded-xl"
                  autoComplete="tel"
                />
              </div>
              {uploading && <Progress value={progress} className="h-2" aria-label="Upload progress" />}
              <Button
                type="button"
                onClick={() => void handleUpload()}
                disabled={uploading || !file}
                className="min-h-11 w-full rounded-xl bg-forest font-semibold text-cream hover:bg-forest/90"
              >
                {uploading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Uploading… {progress}%
                  </>
                ) : (
                  <>
                    <Upload className="size-4" aria-hidden="true" />
                    Upload receipt
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Paystack */}
          {canPayCard && (
            <Button
              type="button"
              onClick={() => void payByCard()}
              disabled={paying}
              className="min-h-11 w-full gap-2 rounded-xl border border-forest/30 bg-background font-semibold text-forest hover:bg-forest hover:text-cream"
            >
              {paying ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <CreditCard className="size-4" aria-hidden="true" />}
              Pay by card
            </Button>
          )}
        </>
      )}
    </section>
  );
}
