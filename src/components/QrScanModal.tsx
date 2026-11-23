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

const MAX_DECODE_WIDTH = 960; // frames are downscaled before decoding: faster and just as readable
const DECODE_INTERVAL_MS = 120; // ~8 reads per second is plenty for a QR held up to the camera

/**
 * Camera QR scanner. Uses the browser's native BarcodeDetector when it exists (Chrome on Android and
 * desktop) and falls back to jsQR everywhere else — iPhone/iPad Safari and Chrome, Firefox, tablets —
 * so it works on any device with a camera. Manual entry stays available if the camera can't be used.
 */
export default function QrScanModal({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualValue, setManualValue] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [struggling, setStruggling] = useState(false);

  // Keep the latest callback in a ref: the camera must not restart every time the parent re-renders.
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function fail(message: string) {
      setError(message);
      setShowManual(true);
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        fail('Este navegador no permite usar la cámara en esta página (hace falta abrirla con https). Escribe el código a mano.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        fail('No se pudo acceder a la cámara. Permite el acceso a la cámara en el navegador, o escribe el código a mano.');
        return;
      }
      const video = videoRef.current;
      if (stopped || !video) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        fail('No se pudo iniciar la cámara. Escribe el código a mano.');
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      // Some browsers expose BarcodeDetector without QR support (or throw): then jsQR does the work.
      let native: InstanceType<NonNullable<Window['BarcodeDetector']>> | null = null;
      try {
        const Native = window.BarcodeDetector as (Window['BarcodeDetector'] & { getSupportedFormats?: () => Promise<string[]> }) | undefined;
        if (Native) {
          const formats = (await Native.getSupportedFormats?.()) ?? ['qr_code'];
          if (formats.includes('qr_code')) native = new Native({ formats: ['qr_code'] });
        }
      } catch {
        native = null;
      }
      let jsQR: typeof import('jsqr').default | null = null;
      try {
        jsQR = (await import('jsqr')).default;
      } catch {
        if (!native) {
          fail('No se pudo cargar el lector de códigos. Recarga la página o escribe el código a mano.');
          return;
        }
      }
      const startedAt = Date.now();

      const found = (value: string) => {
        if (stopped || !value) return;
        stopped = true;
        navigator.vibrate?.(60);
        onDetectedRef.current(value);
      };

      const tick = async () => {
        if (stopped) return;
        if (Date.now() - startedAt > 8000) setStruggling(true);
        try {
          if (video.readyState >= 2 && video.videoWidth > 0) {
            if (native) {
              try {
                const codes = await native.detect(video);
                if (codes.length > 0) return found(codes[0].rawValue);
              } catch {
                // the native detector can fail on single frames: jsQR below still tries
              }
            }
            if (jsQR && ctx) {
              const scale = Math.min(1, MAX_DECODE_WIDTH / video.videoWidth);
              canvas.width = Math.round(video.videoWidth * scale);
              canvas.height = Math.round(video.videoHeight * scale);
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const result = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
              if (result?.data) return found(result.data);
            }
          }
        } catch {
          // transient decode errors are expected between frames
        }
        timer = setTimeout(tick, DECODE_INTERVAL_MS);
      };
      tick();
    }

    start();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function submitManual() {
    const value = manualValue.trim();
    if (value) onDetectedRef.current(value);
  }

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
          <button onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            ✕
          </button>
        </div>

        <video
          ref={videoRef}
          style={{ width: '100%', borderRadius: 10, background: '#000', display: error ? 'none' : 'block' }}
          muted
          playsInline
          autoPlay
        />
        {!error && (
          <div style={{ fontSize: 12, color: struggling ? 'var(--gold)' : 'var(--text-muted)', marginTop: 8 }}>
            {struggling
              ? 'No logro leerlo. Acerca el QR, súbele el brillo a la pantalla del cliente y evita reflejos; o escribe el código a mano.'
              : 'Apunta la cámara al QR de la tarjeta del cliente.'}
          </div>
        )}
        {error && <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>}

        {showManual ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
            <input
              className="input"
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitManual()}
              placeholder="Código del pase"
              autoFocus
            />
            <button className="btn btn-primary" onClick={submitManual}>
              Buscar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowManual(true)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, marginTop: 10, padding: 0, textDecoration: 'underline' }}
          >
            ¿No lee? Escribir el código a mano
          </button>
        )}
      </div>
    </div>
  );
}
