'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  onDetected: (value: string) => void;
  onClose: () => void;
}

// `BarcodeDetector` isn't in lib.dom.d.ts yet in every TS/Next version — declare it loosely.
declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => {
      detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
    };
  }
}

export default function QrScanModal({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualValue, setManualValue] = useState('');
  const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  useEffect(() => {
    if (!supported) return;
    let stream: MediaStream | null = null;
    let stop = false;
    let rafId: number;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const Detector = window.BarcodeDetector!;
        const detector = new Detector({ formats: ['qr_code'] });

        const tick = async () => {
          if (stop || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              onDetected(codes[0].rawValue);
              return;
            }
          } catch {
            // transient decode errors are expected between frames
          }
          rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
      } catch (err) {
        setError('No se pudo acceder a la cámara. Revisa los permisos del navegador.');
      }
    }

    start();
    return () => {
      stop = true;
      if (rafId) cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [supported, onDetected]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div className="panel" style={{ padding: 22, maxWidth: 420, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          <div className="font-display" style={{ fontSize: 16 }}>Escanear código QR</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            ✕
          </button>
        </div>

        {supported ? (
          <>
            <video ref={videoRef} style={{ width: '100%', borderRadius: 10, background: '#000' }} muted playsInline />
            {error && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{error}</div>}
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Tu navegador no soporta el escaneo nativo de códigos QR (disponible en Chrome/Edge en Android y desktop). Pega el
              código del pase manualmente:
            </div>
            <input className="input" value={manualValue} onChange={(e) => setManualValue(e.target.value)} placeholder="Código del pase" />
            <button className="btn btn-primary" onClick={() => manualValue.trim() && onDetected(manualValue.trim())}>
              Buscar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
