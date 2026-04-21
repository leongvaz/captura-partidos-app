import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { db, type PartidoLocal } from '@/lib/db';
import type { Cancha, Equipo, Jugador, PlantillaPartido } from '@/types/entities';

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
    if (parsedA.length === 0 || parsedB.length === 0) {
      alert('Agrega al menos 1 jugador por equipo. Formato: "7 Juan Hernández" (uno por línea).');
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const partidoId = crypto.randomUUID();
      const equipoAId = crypto.randomUUID();
      const equipoBId = crypto.randomUUID();
      const canchaId = crypto.randomUUID();

      const eqA: Equipo = {
        id: equipoAId,
        ligaId,
        nombre: equipoA.trim(),
        categoria,
        activo: true,
        createdAt: now,
        updatedAt: now,
      };
      const eqB: Equipo = {
        id: equipoBId,
        ligaId,
        nombre: equipoB.trim(),
        categoria,
        activo: true,
        createdAt: now,
        updatedAt: now,
      };

      const ch: Cancha = {
        id: canchaId,
        ligaId,
        sedeId: null,
        nombre: (cancha || 'Cancha pruebas').trim(),
        activo: true,
      };

      const partido: PartidoLocal = {
        id: partidoId,
        ligaId,
        localEquipoId: eqA.id,
        visitanteEquipoId: eqB.id,
        canchaId: ch.id,
        categoria,
        fecha,
        horaInicio,
        estado: 'programado',
        anotadorId: usuarioId,
        localVersion: 1,
        serverVersion: 0,
        createdAt: now,
        updatedAt: now,
        synced: true,
        isTest: true,
      };

      const jugadores: Jugador[] = [];
      const plantilla: PlantillaPartido[] = [];

      const crearJugadores = (equipoId: string, list: { numero: number; nombre: string; apellido: string }[]) => {
        for (const item of list) {
          const jugadorId = crypto.randomUUID();
          jugadores.push({
            id: jugadorId,
            equipoId,
            nombre: item.nombre,
            apellido: item.apellido,
            numero: item.numero,
            invitado: false,
            activo: true,
            createdAt: now,
            updatedAt: now,
          });
          // En modo pruebas ponemos a todos "en cancha" para que Captura liste a todos.
          plantilla.push({
            id: crypto.randomUUID(),
            partidoId: partido.id,
            equipoId,
            jugadorId,
            enCanchaInicial: true,
            esCapitan: false,
            esCoach: false,
            invitado: false,
            createdAt: now,
            updatedAt: now,
          });
        }
      };

      crearJugadores(eqA.id, parsedA);
      crearJugadores(eqB.id, parsedB);

      // Guardado local (modo pruebas). No se sincroniza.
      await db.equipos.put(eqA);
      await db.equipos.put(eqB);
      await db.canchas.put(ch);
      await db.partidos.put(partido);
      await db.jugadores.bulkPut(jugadores);
      await db.plantilla.bulkPut(plantilla);

      navigate(`/partido/${partido.id}/config`, { replace: true });
    } catch (e) {
      console.error(e);
      alert('No se pudo crear el partido de pruebas.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-slate-100">Alta rápida de partido (pruebas)</h1>
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
        Nota: este modo guarda datos locales para pruebas y no intenta sincronizarlos.
      </p>
    </div>
  );
}

