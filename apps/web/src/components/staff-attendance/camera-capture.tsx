"use client";

import { useEffect, useRef, useState } from "react";
import { Camera as CameraIcon, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CameraCapture({
  actionLabel,
  submitting,
  onCapture,
}: {
  actionLabel: string;
  submitting: boolean;
  onCapture: (data: { blob: Blob; lat: number; lng: number }) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        setError("Camera access is required to check in/out — please allow camera permission and reload.");
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function takePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPhotoDataUrl(canvas.toDataURL("image/jpeg", 0.85));
    canvas.toBlob((blob) => setPhotoBlob(blob), "image/jpeg", 0.85);
  }

  function retake() {
    setPhotoDataUrl(null);
    setPhotoBlob(null);
  }

  function confirm() {
    if (!photoBlob) return;
    if (!("geolocation" in navigator)) {
      setError("Geolocation is required to check in/out — this browser doesn't support it.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onCapture({ blob: photoBlob, lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setLocating(false);
        setError("Location access is required to check in/out — please allow location permission.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative aspect-square w-full max-w-xs overflow-hidden rounded-md border bg-black">
        {photoDataUrl ? (
          // Just-captured local blob preview — a plain img is fine here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoDataUrl} alt="Captured selfie" className="h-full w-full object-cover" />
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      {photoDataUrl ? (
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={retake} disabled={submitting || locating}>
            <RotateCcw className="size-4" />
            Retake
          </Button>
          <Button type="button" onClick={confirm} disabled={submitting || locating}>
            {locating ? "Getting location…" : submitting ? "Submitting…" : actionLabel}
          </Button>
        </div>
      ) : (
        <Button type="button" onClick={takePhoto}>
          <CameraIcon className="size-4" />
          Take photo
        </Button>
      )}
    </div>
  );
}
