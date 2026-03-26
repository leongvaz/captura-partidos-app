import { useEffect, useMemo, useRef, useState } from 'react';
import { usePartidoStore } from '@/store/partidoStore';

function Icon({ name, className }: { name: 'play-fill' | 'pause-fill' | 'gear-fill'; className?: string }) {
  const common = {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 16 16',
    fill: 'currentColor',
    className,
    'aria-hidden': true as const,
    focusable: false as const,
  };

  if (name === 'play-fill') {
    return (
      <svg {...common}>
        <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393" />
      </svg>
    );
  }

  if (name === 'pause-fill') {
    return (
      <svg {...common}>
        <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5" />
        <path d="M10.5 3.5A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5" />
      </svg>
    );
  }

  // gear-fill
  return (
    <svg {...common}>
      <path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z" />
    </svg>
  );
}

function formatMMSS(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = Math.floor(segundos % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

interface CronometroPartidoProps {
  partidoId: string;
}

function labelPeriodo(cuarto: number): string {
  if (cuarto <= 4) return `Q${cuarto}`;
  return `OT${cuarto - 4}`;
}

export default function CronometroPartido({ partidoId }: CronometroPartidoProps) {
  const {
    partidoActual,
    plantilla,
    getPuntosJugador,
    cuartoActual,
    segundosRestantesCuarto,
    cronoRunning,
    toggleCrono,
    pausarCronoSiCorriendo,
    persistirCronoEnPartidoLocal,
    lastTickAt,
    cambiarCuarto,
    editarTiempoManual,
  } = usePartidoStore();

  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [editMin, setEditMin] = useState(0);
  const [editSeg, setEditSeg] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevSegRef = useRef<number>(segundosRestantesCuarto);
  const warned10Ref = useRef<string>(''); // key por periodo
  const endedRef = useRef<string>(''); // key por periodo

  const ensureAudio = async () => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume();
    } catch {
      // si el navegador bloquea audio, simplemente no sonará
    }
  };

  const beep = async (freq = 880, ms = 120, gainValue = 0.08) => {
    await ensureAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.value = gainValue;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    osc.start(now);
    osc.stop(now + ms / 1000);
  };

  useEffect(() => {
    if (!cronoRunning) return;
    let raf = 0;
    const loop = () => {
      setNowMs(Date.now());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [cronoRunning]);

  const segundosRestantesActual = useMemo(() => {
    if (!cronoRunning || !lastTickAt) return segundosRestantesCuarto;
    const startedAtMs = new Date(lastTickAt).getTime();
    const elapsed = Math.floor((nowMs - startedAtMs) / 1000);
    return Math.max(0, segundosRestantesCuarto - Math.max(0, elapsed));
  }, [cronoRunning, lastTickAt, nowMs, segundosRestantesCuarto]);

  const esEmpate = useMemo(() => {
    if (!partidoActual) return false;
    const localId = partidoActual.localEquipoId;
    const visitId = partidoActual.visitanteEquipoId;
    const puntosLocal = plantilla.filter((p) => p.equipoId === localId).reduce((s, p) => s + getPuntosJugador(p.jugadorId), 0);
    const puntosVisit = plantilla.filter((p) => p.equipoId === visitId).reduce((s, p) => s + getPuntosJugador(p.jugadorId), 0);
    return puntosLocal === puntosVisit;
  }, [partidoActual, plantilla, getPuntosJugador]);

  useEffect(() => {
    if (!cronoRunning) return;
    const prev = prevSegRef.current;
    const key = `p${cuartoActual}`;

    // aviso 10 segundos (solo una vez por periodo)
    if (prev > 10 && segundosRestantesActual === 10 && warned10Ref.current !== key) {
      warned10Ref.current = key;
      beep(988, 140).catch(() => {});
    }

    // fin de periodo (solo una vez por periodo)
    if (prev > 0 && segundosRestantesActual === 0 && endedRef.current !== key) {
      endedRef.current = key;
      // beep doble al terminar
      beep(740, 160).catch(() => {});
      setTimeout(() => beep(740, 160).catch(() => {}), 220);

      // Pausar y persistir
      pausarCronoSiCorriendo();

      // Auto-avance:
      // - Q1->Q2->Q3->Q4 en pausa
      // - OTn -> OT(n+1) solo si el marcador sigue empatado
      if (cuartoActual >= 1 && cuartoActual < 4) {
        cambiarCuarto(cuartoActual + 1);
      } else if (cuartoActual >= 4 && esEmpate) {
        cambiarCuarto(Math.max(5, cuartoActual + 1));
      }

      persistirCronoEnPartidoLocal(partidoId).catch(() => {});
    }

    prevSegRef.current = segundosRestantesActual;
  }, [
    cronoRunning,
    segundosRestantesActual,
    cuartoActual,
    pausarCronoSiCorriendo,
    persistirCronoEnPartidoLocal,
    partidoId,
    cambiarCuarto,
  ]);

  useEffect(() => {
    return () => {
      persistirCronoEnPartidoLocal(partidoId).catch(() => {});
    };
  }, [partidoId, pausarCronoSiCorriendo, persistirCronoEnPartidoLocal]);

  const handlePlayPause = () => {
    toggleCrono();
    persistirCronoEnPartidoLocal(partidoId).catch(() => {});
    // habilita audio en una interacción del usuario
    ensureAudio().catch(() => {});
  };

  const handleConfig = () => {
    pausarCronoSiCorriendo();
    setEditMin(Math.floor(segundosRestantesActual / 60));
    setEditSeg(Math.floor(segundosRestantesActual % 60));
    setShowConfigPanel((v) => !v);
  };

  const handleGuardarTiempo = () => {
    editarTiempoManual(editMin, editSeg);
    persistirCronoEnPartidoLocal(partidoId).catch(() => {});
    setShowConfigPanel(false);
  };

  const handleCambiarCuarto = (nuevo: number) => {
    if (segundosRestantesActual > 0 && nuevo !== cuartoActual) {
      if (!window.confirm('El cuarto actual aún no está en 0:00. ¿Cambiar de todos modos?')) return;
    }
    cambiarCuarto(nuevo);
    persistirCronoEnPartidoLocal(partidoId).catch(() => {});
    setShowConfigPanel(false);
  };

  const handleAgregarOT = () => {
    if (segundosRestantesActual > 0) {
      if (!window.confirm('El periodo actual aún no está en 0:00. ¿Agregar tiempo extra de todos modos?')) return;
    }
    cambiarCuarto(Math.max(5, cuartoActual + 1));
    persistirCronoEnPartidoLocal(partidoId).catch(() => {});
    setShowConfigPanel(false);
  };

  const periodos: number[] = [1, 2, 3, 4];
  const otCount = Math.max(0, cuartoActual - 4);
  for (let i = 1; i <= otCount; i++) periodos.push(4 + i);

  return (
    <div className="rounded-xl bg-slate-800 border border-slate-700 p-3 mb-4">
      <div className="flex items-center justify-center gap-4">
        <div className="flex items-center gap-2">
          <div className="text-[1.75rem] leading-none font-mono font-bold text-slate-100">
            {formatMMSS(segundosRestantesActual)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-base text-slate-200 font-semibold">{labelPeriodo(cuartoActual)}</div>
        </div>
        <button
          type="button"
          onClick={handlePlayPause}
          className="w-11 h-11 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 border border-slate-600 inline-flex items-center justify-center"
          title={cronoRunning ? 'Pausar cronómetro' : 'Iniciar cronómetro'}
          aria-label={cronoRunning ? 'Pausar cronómetro' : 'Iniciar cronómetro'}
          aria-pressed={cronoRunning}
        >
          <Icon name={cronoRunning ? 'pause-fill' : 'play-fill'} className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={handleConfig}
          className="w-11 h-11 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 border border-slate-600 inline-flex items-center justify-center"
          title="Configurar tiempo y cuarto"
          aria-label="Configurar tiempo y cuarto"
        >
          <Icon name="gear-fill" className="w-5 h-5" />
        </button>
      </div>

      {showConfigPanel && (
        <div className="mt-3 pt-3 border-t border-slate-600">
          <div className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
            Cuarto
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {periodos.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleCambiarCuarto(q)}
                className={`px-3 py-2 rounded-lg text-sm font-bold ${cuartoActual === q ? 'bg-primary-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
              >
                {q <= 4 ? `Q${q}` : `OT${q - 4}`}
              </button>
            ))}
            <button
              type="button"
              onClick={handleAgregarOT}
              className="px-3 py-2 rounded-lg text-sm font-bold bg-amber-800 text-amber-100 hover:bg-amber-700"
              title="Agregar tiempo extra (5 min)"
            >
              +OT
            </button>
          </div>
          <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
            <label className="text-slate-400 text-sm">Min</label>
            <input
              type="number"
              min={0}
              max={cuartoActual <= 4 ? 10 : 5}
              value={editMin}
              onChange={(e) => setEditMin(clamp(parseInt(e.target.value, 10) || 0, 0, cuartoActual <= 4 ? 10 : 5))}
              className="w-14 rounded bg-slate-700 border border-slate-600 text-slate-100 px-2 py-1 text-sm"
            />
            <label className="text-slate-400 text-sm">Seg</label>
            <input
              type="number"
              min={0}
              max={59}
              value={editSeg}
              onChange={(e) => setEditSeg(clamp(parseInt(e.target.value, 10) || 0, 0, 59))}
              className="w-14 rounded bg-slate-700 border border-slate-600 text-slate-100 px-2 py-1 text-sm"
            />
            <button type="button" onClick={handleGuardarTiempo} className="px-3 py-1 rounded bg-emerald-600 text-white text-sm">
              Guardar tiempo
            </button>
            <button type="button" onClick={() => setShowConfigPanel(false)} className="px-3 py-1 rounded bg-slate-600 text-slate-200 text-sm">
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
