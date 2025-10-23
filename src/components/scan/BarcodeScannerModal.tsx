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
  const [torchOn, setTorchOn] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      // Hangi formatlar
      const hints = new Map<DecodeHintType, any>();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);

      // ZXing reader — taramalar arası 500ms bekleme
      const reader = new BrowserMultiFormatReader(hints as any, 500 as any);
      readerRef.current = reader;

      // Stream’i ZXing başlatsın ve video’ya bağlasın
      reader.decodeFromVideoDevice(undefined, videoRef.current!, (result, err) => {
        if (result) {
          // önce her şeyi kapat
          stop();
          onResult(result.getText());
          onClose();
          return;
        }
        if (err && !(err instanceof NotFoundException)) {
          // NotFound sürekli akışta normal; diğerlerini sessize al
          // console.debug(err);
        }
      });
    } catch (e: any) {
      setError(
        e?.name === "NotAllowedError"
          ? "Kamera izni gerekli. Lütfen tarayıcı izinlerini verin."
          : "Kamera başlatılamadı."
      );
    }
  };

  const stop = () => {
    // 1) ZXing decode döngüsünü durdur
    try {
      (readerRef.current as any)?.stopContinuousDecode?.();
    } catch {}
    try {
      (readerRef.current as any)?.reset?.();
    } catch {}
    readerRef.current = null;

    // 2) Video üzerinde varsa stream’i kapat
    const v = videoRef.current as HTMLVideoElement | null;
    const s = (v?.srcObject as MediaStream | null) || null;
    if (s) {
      try { s.getTracks().forEach((t) => t.stop()); } catch {}
    }
    if (v) {
      try { v.srcObject = null; } catch {}
    }

    setTorchOn(false);
  };

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

        <div className="mt-3 overflow-hidden rounded-lg bg-black">
          <video
            ref={videoRef}
            className="block h-64 w-full object-cover"
            muted
            playsInline
          />
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
