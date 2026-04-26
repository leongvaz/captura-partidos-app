import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { db } from '@/lib/db';
import type { Cancha, Equipo, Jugador, Partido, PlantillaPartido } from '@/types/entities';

function parseJugadores(text: string): { numero: number; nombre: string; apellido: string }[] {
  const lines = (text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const out: { numero: number; nombre: string; apellido: string }[] = [];
  for (const line of lines) {
    // formatos aceptados:
    //  - "7 Juan Hernández"
    //  - "7,Juan,Hernández"
    const raw = line.includes(',') ? line.split(',').map((s) => s.trim()) : line.split(/\s+/g);
    const n = parseInt(raw[0] ?? '', 10);
    if (!Number.isFinite(n)) continue;
    const nombre = raw[1] ?? '';
    const apellido = raw.slice(2).join(' ') || '';
    if (!nombre || !apellido) continue;
    out.push({ numero: n, nombre, apellido });
  }
  return out;
}

type AltaRapidaResponse = {
  partido: Partido;
  equipos: Equipo[];
  cancha: Cancha;
  jugadores: Jugador[];
  plantilla: PlantillaPartido[];
};

export default function AltaPartidoPruebas() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const ligaId = useAuthStore((s) => s.liga?.id) || '';
  const usuarioId = useAuthStore((s) => s.usuario?.id) || '';

  const hoy = new Date().toISOString().slice(0, 10);
  const [fecha, setFecha] = useState(searchParams.get('fecha') || hoy);
  const [horaInicio, setHoraInicio] = useState('10:00');
  const [rama, setRama] = useState(searchParams.get('rama') || 'varonil');
  const [fuerza, setFuerza] = useState(searchParams.get('fuerza') || 'primera');

  const [equipoA, setEquipoA] = useState('');
  const [equipoB, setEquipoB] = useState('');
  const [sede, setSede] = useState('');
  const [cancha, setCancha] = useState('');

  const [jugadoresA, setJugadoresA] = useState('');
  const [jugadoresB, setJugadoresB] = useState('');
  const [saving, setSaving] = useState(false);
  const categoria = useMemo(() => `${rama}:${fuerza}`, [rama, fuerza]);

  const handleCrear = async () => {
    if (!ligaId || !usuarioId) {
      alert('No hay sesión activa.');
      return;
    }
    if (!equipoA.trim() || !equipoB.trim()) {
      alert('Escribe el nombre de Equipo A y Equipo B.');
      return;
    }

    const parsedA = parseJugadores(jugadoresA);
    const parsedB = parseJugadores(jugadoresB);
    if (parsedA.length < 5 || parsedB.length < 5) {
      alert('Agrega al menos 5 jugadores por equipo. Formato: "7 Juan Hernández" (uno por línea).');
      return;
    }

    setSaving(true);
    try {
      const res = await api<AltaRapidaResponse>('/partidos/alta-rapida', {
        method: 'POST',
        body: {
          fecha,
          horaInicio,
          categoria,
          equipoA: equipoA.trim(),
          equipoB: equipoB.trim(),
          cancha: (cancha || sede || 'Cancha pruebas').trim(),
          jugadoresA: parsedA,
          jugadoresB: parsedB,
        },
      });

      for (const equipo of res.equipos) {
        await db.equipos.put(equipo);
      }
      await db.canchas.put(res.cancha);
      await db.partidos.put({ ...res.partido, synced: true });
      await db.jugadores.bulkPut(res.jugadores);
      await db.plantilla.bulkPut(res.plantilla);

      navigate(`/partido/${res.partido.id}/config`, { replace: true });
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'No se pudo crear el partido persistido.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-slate-100">Alta rápida de partido</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-sm text-slate-300">
          Fecha
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="mt-1 w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2"
          />
        </label>
        <label className="text-sm text-slate-300">
          Hora
          <input
            type="time"
            value={horaInicio}
            onChange={(e) => setHoraInicio(e.target.value)}
            className="mt-1 w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2"
          />
        </label>
        <label className="text-sm text-slate-300">
          Rama
          <select
            value={rama}
            onChange={(e) => setRama(e.target.value)}
            className="mt-1 w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2"
          >
            <option value="varonil">varonil</option>
            <option value="femenil">femenil</option>
            <option value="mixta">mixta</option>
            <option value="veteranos">veteranos</option>
            <option value="infantil">infantil</option>
          </select>
        </label>
        <label className="text-sm text-slate-300">
          Fuerza
          <select
            value={fuerza}
            onChange={(e) => setFuerza(e.target.value)}
            className="mt-1 w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2"
          >
            <option value="primera">primera</option>
            <option value="segunda">segunda</option>
            <option value="tercera">tercera</option>
            <option value="intermedia">intermedia</option>
            <option value="especial">especial</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-sm text-slate-300">
          Equipo A
          <input
            value={equipoA}
            onChange={(e) => setEquipoA(e.target.value)}
            placeholder="Ej. EPT"
            className="mt-1 w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2"
          />
        </label>
        <label className="text-sm text-slate-300">
          Equipo B
          <input
            value={equipoB}
            onChange={(e) => setEquipoB(e.target.value)}
            placeholder="Ej. Hawks"
            className="mt-1 w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2"
          />
        </label>
        <label className="text-sm text-slate-300">
          Sede (opcional)
          <input
            value={sede}
            onChange={(e) => setSede(e.target.value)}
            placeholder="Ej. Polideportivo"
            className="mt-1 w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2"
          />
        </label>
        <label className="text-sm text-slate-300">
          Cancha (opcional)
          <input
            value={cancha}
            onChange={(e) => setCancha(e.target.value)}
            placeholder="Ej. Techada 1"
            className="mt-1 w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-sm text-slate-300">
          Jugadores Equipo A (uno por línea)
          <textarea
            value={jugadoresA}
            onChange={(e) => setJugadoresA(e.target.value)}
            placeholder={'7 Juan Hernández\n10 Carlos García'}
            rows={10}
            className="mt-1 w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 font-mono text-sm"
          />
        </label>
        <label className="text-sm text-slate-300">
          Jugadores Equipo B (uno por línea)
          <textarea
            value={jugadoresB}
            onChange={(e) => setJugadoresB(e.target.value)}
            placeholder={'23 Miguel López\n34 Luis Rodríguez'}
            rows={10}
            className="mt-1 w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 font-mono text-sm"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={handleCrear}
        disabled={saving}
        className="w-full rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium py-3"
      >
        {saving ? 'Creando…' : 'Crear partido y continuar'}
      </button>

      <p className="text-xs text-slate-400">
        Este flujo guarda el partido, los equipos auxiliares, la plantilla y la captura en la base de datos del backend.
      </p>
    </div>
  );
}

