// src/components/scan/BarcodeScannerModal.tsx
import React, { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { DecodeHintType, BarcodeFormat, NotFoundException } from "@zxing/library";

type Props = {
  open: boolean;
  onClose: () => void;
  onResult: (text: string) => void;
};

const formats: BarcodeFormat[] = [
  BarcodeFormat.QR_CODE,
  BarcodeFormat.DATA_MATRIX,
  BarcodeFormat.PDF_417,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.ITF,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
];

const BarcodeScannerModal: React.FC<Props> = ({ open, onClose, onResult }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  // ZXing controls (varsa)
  const controlsRef = useRef<{ stop?: () => void } | null>(null);

  // Modal yeniden açıldığında ilk frame kapanmasını engelle
  const readyAtRef = useRef<number>(0);
  // Duplicate guard
  const lastResultRef = useRef<{ text: string; ts: number } | null>(null);

  // Beep için AudioContext (kullanıcı etkileşimi sonrası çalışır)
  const audioCtxRef = useRef<AudioContext | null>(null);

  const [torchOn, setTorchOn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ OK görsel efekti
  const [flashOk, setFlashOk] = useState(false);

  useEffect(() => {
    if (!open) {
      stop();
      return;
    }
    start();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const start = async () => {
    try {
      setError(null);
      setTorchOn(false);
      readyAtRef.current = Date.now() + 300;

      const hints = new Map<DecodeHintType, any>();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
      hints.set(DecodeHintType.TRY_HARDER, true);
      const ALSO_INV = (DecodeHintType as any)?.ALSO_INVERTED;
      if (ALSO_INV !== undefined) hints.set(ALSO_INV, true);

      // Daha sık deneme
      const reader = new BrowserMultiFormatReader(hints as any, 120 as any);
      readerRef.current = reader;

      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { min: 1024, ideal: 1920, max: 2560 },
          height: { min: 576, ideal: 1080, max: 1440 },
          frameRate: { ideal: 30, min: 15 },
          ...( { advanced: [{ focusMode: "continuous" }] } as any ),
        } as any,
      };

      const controls: any = await reader.decodeFromConstraints(
        constraints,
        videoRef.current!,
        (result, err) => {
          if (result) {
            if (Date.now() < readyAtRef.current) return;

            const text = result.getText?.() ?? "";
            if (text) {
              // duplicate guard
              const now = Date.now();
              const last = lastResultRef.current;
              if (last && last.text === text && now - last.ts < 800) return;
              lastResultRef.current = { text, ts: now };

              // 🔔 bip + titreşim + yeşil çerçeve
              try { playBeep(); } catch {}
              try { (navigator as any)?.vibrate?.(100); } catch {}
              setFlashOk(true);
              setTimeout(() => setFlashOk(false), 200);

              safeStop();
              onResult(text);
              onClose();
            }
            return;
          }
          if (err && !(err instanceof NotFoundException)) {
            // console.debug(err);
          }
        }
      );

      controlsRef.current = controls || null;

      // Donanım destekliyorsa zoom ve auto ayarlar
      try {
        const v = videoRef.current!;
        const stream = v.srcObject as MediaStream | null;
        const track = stream?.getVideoTracks?.()[0];
        const caps: any = track?.getCapabilities?.() || {};
        if (caps.zoom) {
          const targetZoom =
            Math.min(caps.max ?? 2.0, Math.max(caps.min ?? 1.0, (caps.default ?? 1.0) * 2.0));
          await (track as any).applyConstraints({ advanced: [{ zoom: targetZoom }] });
        }
        await (track as any)?.applyConstraints?.({
          advanced: [{ exposureMode: "continuous", whiteBalanceMode: "continuous" }],
        });
      } catch {}
    } catch (e: any) {
      setError(
        e?.name === "NotAllowedError"
          ? "Kamera izni gerekli. Lütfen tarayıcı izinlerini verin."
          : "Kamera başlatılamadı."
      );
    }
  };

  // WebAudio ile çok kısa bir bip üret
  const playBeep = () => {
    // Bazı tarayıcılarda ilk etkileşim sonrası lazımdır; varsa kullan, yoksa oluştur.
    const ctx = audioCtxRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtxRef.current = ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.value = 880; // A5, net bir bip
    g.gain.value = 0.001;    // başlangıç düşük
    o.connect(g).connect(ctx.destination);

    const now = ctx.currentTime;
    // hızlı atak + hızlı decay (≈120ms)
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.02, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    o.start(now);
    o.stop(now + 0.14);
  };

  // ZXing ve stream'i kontrollü kapat
  const safeStop = () => {
    try { controlsRef.current?.stop?.(); } catch {}
    controlsRef.current = null;

    readerRef.current = null;

    try {
      const v = videoRef.current as HTMLVideoElement | null;
      const s = (v?.srcObject as MediaStream | null) || null;
      if (s) s.getTracks?.().forEach(t => { try { t.stop(); } catch {} });
      if (v) v.srcObject = null;
    } catch {}

    setTorchOn(false);
  };

  const stop = () => { safeStop(); };

  // 🔦 Torch (destek varsa)
  const toggleTorch = async () => {
    const v = videoRef.current;
    const stream = (v?.srcObject as MediaStream | null) || null;
    const track = stream?.getVideoTracks?.()[0];
    if (!track) return;

    const caps = (track as any).getCapabilities?.() ?? {};
    if (!caps.torch) return;

    const next = !torchOn;
    await (track as any).applyConstraints({ advanced: [{ torch: next }] });
    setTorchOn(next);
  };

  const handleClose = () => {
    stop();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-3 text-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Barkod / QR Oku</h3>
          <button
            onClick={handleClose}
            className="rounded-md px-2 py-1 text-sm text-gray-300 hover:bg-white/10"
          >
            Kapat
          </button>
        </div>

        <div className="mt-3 overflow-hidden rounded-lg bg-black relative">
          <video
            ref={videoRef}
            className="block h-64 w-full object-cover"
            muted
            playsInline
          />
          {/* ✅ OK flash overlay */}
          {flashOk && (
            <div
              className="pointer-events-none absolute inset-0 rounded-lg"
              style={{
                boxShadow: "inset 0 0 0 16px rgba(16,185,129,0.95)", // emerald-500
                transition: "opacity 200ms",
                opacity: 1,
              }}
            />
          )}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-gray-400">Kamerayı barkod/QR’a yaklaştırın.</div>
          <button
            onClick={toggleTorch}
            className="rounded-md border border-gray-700 px-3 py-1 text-sm hover:bg-white/5 disabled:opacity-50"
            disabled={!videoRef.current || !videoRef.current.srcObject}
            title="Fener"
          >
            {torchOn ? "Fener Kapat" : "Fener Aç"}
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-md border border-error-500/30 bg-error-500/10 p-2 text-sm text-error-500">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default BarcodeScannerModal;
