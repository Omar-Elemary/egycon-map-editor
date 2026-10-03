"use client";

import { Check, Copy, Link2Off, Monitor, QrCode, Share2, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { publishShare, unpublishShare, updateShare, type ShareResponse } from "@/lib/share-api";
import { useEditorStore } from "@/store/editor-store";

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function ShareDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const project = useEditorStore((state) => state.project);
  const [status, setStatus] = useState<"idle" | "publishing" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  const [share, setShare] = useState<ShareResponse | null>(null);
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState("");
  const [expiresLocal, setExpiresLocal] = useState("");
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  useEffect(() => {
    if (!open || !project) return;
    let cancelled = false;
    setStatus("publishing");
    setError("");
    setCopied(false);
    publishShare(project)
      .then(async (payload) => {
        if (cancelled) return;
        setShare(payload);
        setExpiresLocal(toLocalInput(payload.expiresAt));
        const url = payload.phoneUrl || payload.urls[0];
        setSelectedUrl(url);
        setStatus("ready");
        setQr(
          await QRCode.toDataURL(url, {
            width: 360,
            margin: 1,
            color: { dark: "#18181b", light: "#ffffff" },
          }),
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus("error");
        setError(err instanceof Error ? err.message : "Could not publish map.");
      });
    return () => {
      cancelled = true;
    };
  }, [open, project]);

  async function copyLink() {
    if (!selectedUrl) return;
    await navigator.clipboard.writeText(selectedUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function nativeShare() {
    if (!selectedUrl || !navigator.share) return;
    await navigator.share({
      title: project?.name ?? "Event map",
      text: "Explore this venue map — zoom, pan, and click zones.",
      url: selectedUrl,
    });
  }

  async function saveExpiry() {
    if (!share) return;
    setBusy(true);
    setError("");
    try {
      setShare(await updateShare(share.id, { expiresAt: fromLocalInput(expiresLocal) }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not update expiry.");
    } finally {
      setBusy(false);
    }
  }

  async function takeDown() {
    if (!share) return;
    setBusy(true);
    setError("");
    try {
      setShare(await unpublishShare(share.id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not unpublish.");
    } finally {
      setBusy(false);
    }
  }

  async function republish() {
    if (!project) return;
    setBusy(true);
    setError("");
    try {
      const payload = await publishShare(project, { expiresAt: fromLocalInput(expiresLocal) });
      setShare(payload);
      setExpiresLocal(toLocalInput(payload.expiresAt));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not publish map.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const localhost = selectedUrl.includes("localhost") || selectedUrl.includes("127.0.0.1");
  const linkLocal = selectedUrl.includes("169.254.");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Share map</h2>
            <p className="text-xs text-zinc-500">
              Anyone with the link can explore on a computer or phone — zoom, pan, and click zones.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-zinc-100 text-zinc-500"
            aria-label="Close share"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {status === "publishing" && (
            <p className="py-10 text-center text-sm text-zinc-500">Publishing map…</p>
          )}
          {status === "error" && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          {status === "ready" && share && (
            <>
              {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <div
                className={`flex items-center justify-between rounded-2xl px-3 py-2 text-sm ${
                  share.live ? "bg-lime-50 text-lime-950" : "bg-zinc-100 text-zinc-700"
                }`}
              >
                <span className="font-medium">{share.live ? "Link is live" : "Link is unpublished"}</span>
                {share.expiresAt && share.live && (
                  <span className="text-xs">Ends {new Date(share.expiresAt).toLocaleString()}</span>
                )}
              </div>

              {share.live && (
                <>
                  <div className="flex items-start gap-2 rounded-2xl bg-lime-50 px-3 py-3 text-sm text-lime-950">
                    <Monitor className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      Open the link on a PC (scroll to zoom, drag to pan) or scan the QR code on a phone. Keep
                      this editor running if guests are on the same Wi‑Fi.
                    </p>
                  </div>

                  <div className="grid place-items-center rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    {qr ? (
                      <img src={qr} alt="QR code to open the map" className="h-52 w-52 rounded-lg bg-white" />
                    ) : (
                      <QrCode className="h-16 w-16 text-zinc-300" />
                    )}
                  </div>

                  {localhost && (
                    <p className="text-xs leading-5 text-amber-800">
                      This link uses localhost, so a phone cannot open it. Choose the Wi‑Fi address from the list
                      below (for example <span className="font-medium">http://192.168.1.7:3000</span>) and share again.
                    </p>
                  )}
                  {linkLocal && (
                    <p className="text-xs leading-5 text-amber-800">
                      This address is a Bluetooth/link-local IP. Pick the Wi‑Fi address (usually 192.168…) so the
                      phone can reach this computer.
                    </p>
                  )}

                  {share.urls.length > 1 && (
                    <label className="block text-xs font-medium text-zinc-500">
                      Link
                      <select
                        value={selectedUrl}
                        onChange={async (event) => {
                          const url = event.target.value;
                          setSelectedUrl(url);
                          setQr(
                            await QRCode.toDataURL(url, {
                              width: 360,
                              margin: 1,
                              color: { dark: "#18181b", light: "#ffffff" },
                            }),
                          );
                        }}
                        className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-2 text-sm text-zinc-900 outline-none focus:border-lime-500"
                      >
                        {share.urls.map((url) => (
                          <option key={url} value={url}>
                            {url}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {share.urls.length === 1 && (
                    <p className="break-all rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-600">{selectedUrl}</p>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={copyLink}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                    >
                      {copied ? <Check className="h-4 w-4 text-lime-600" /> : <Copy className="h-4 w-4" />}
                      {copied ? "Copied" : "Copy link"}
                    </button>
                    <a
                      href={share.path}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
                    >
                      <Monitor className="h-4 w-4" />
                      Open on this PC
                    </a>
                  </div>
                </>
              )}

              <label className="block text-xs font-medium text-zinc-500">
                Optional expiry
                <input
                  type="datetime-local"
                  value={expiresLocal}
                  onChange={(event) => setExpiresLocal(event.target.value)}
                  onBlur={saveExpiry}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-2 text-sm text-zinc-900 outline-none focus:border-lime-500"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                {share.live ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={takeDown}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 px-3 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Link2Off className="h-4 w-4" />
                    Unpublish
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={republish}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-lime-500 px-3 py-2.5 text-sm font-semibold text-lime-950 hover:bg-lime-400 disabled:opacity-50"
                  >
                    Publish again
                  </button>
                )}
                {canNativeShare && share.live && (
                  <button
                    type="button"
                    onClick={nativeShare}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                  >
                    <Share2 className="h-4 w-4" />
                    Share
                  </button>
                )}
              </div>
              {share.live && (
                <p className="flex items-center justify-center gap-1.5 text-center text-xs text-zinc-500">
                  <Smartphone className="h-3.5 w-3.5" />
                  Phones can scan the QR code above
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
