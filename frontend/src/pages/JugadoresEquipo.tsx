import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import {
  listarJugadores,
  registrarJugador,
  actualizarJugador,
  eliminarJugador,
  listarMisEquipos,
  type Jugador,
  type Equipo,
} from '@/lib/api';

function normalizarNombrePropio(valor: string): string {
  if (!valor) return '';
  const lower = valor.toLocaleLowerCase('es-MX');
  return lower.replace(/\S+/g, (palabra) => {
    const [primera, ...resto] = palabra;
    if (!primera) return palabra;
    return primera.toLocaleUpperCase('es-MX') + resto.join('');
  });
}

export default function JugadoresEquipo() {
  const { equipoId } = useParams<{ equipoId: string }>();
  const usuario = useAuthStore((s) => s.usuario);
  const hasRole = useAuthStore((s) => s.hasRole);
  const navigate = useNavigate();

  const [equipo, setEquipo] = useState<Equipo | null>(null);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState('');
  const [apellidoPaterno, setApellidoPaterno] = useState('');
  const [apellidoMaterno, setApellidoMaterno] = useState('');
  const [numero, setNumero] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [curp, setCurp] = useState('');
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!equipoId) return;
    if (!usuario || !hasRole('capturista_roster')) {
      setError('Solo los capitanes pueden gestionar jugadores de su equipo.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [misEquipos, js] = await Promise.all([
          listarMisEquipos(),
          listarJugadores(equipoId),
        ]);
        if (cancelled) return;
        const eq = misEquipos.find((e) => e.id === equipoId) || null;
        if (!eq) {
          setError('Este equipo no pertenece a tu cuenta de capitán.');
          setEquipo(null);
          setJugadores([]);
          return;
        }
        setEquipo(eq);
        setJugadores(js);
      } catch (e: any) {
        if (!cancelled) {
          console.error(e);
          setError(e?.message || 'No se pudieron cargar los jugadores.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [equipoId, usuario, hasRole]);

  if (!equipoId) {
    return <div className="p-4 text-slate-400">Falta el identificador del equipo.</div>;
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipo) return;
    if (!numero || Number.isNaN(Number(numero)) || numero.length === 0 || numero.length > 3) {
      setError('El número de jugador debe ser un número entre 0 y 999.');
      return;
    }
    if (!curp || curp.length !== 18) {
      setError('La CURP es obligatoria y debe tener 18 caracteres.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const nombreNorm = normalizarNombrePropio(nombre);
      const apePNorm = normalizarNombrePropio(apellidoPaterno);
      const apeMNorm = normalizarNombrePropio(apellidoMaterno);
      let jugadorResp: Jugador;
      if (editingId) {
        jugadorResp = await actualizarJugador(editingId, {
          nombre: nombreNorm.trim(),
          apellidoPaterno: apePNorm.trim(),
          apellidoMaterno: apeMNorm.trim() || undefined,
          numero: Number(numero),
        });
        setJugadores((prev) =>
          prev
            .map((j) => (j.id === editingId ? jugadorResp : j))
            .sort((a, b) => a.numero - b.numero)
        );
      } else {
        jugadorResp = await registrarJugador({
          equipoId: equipo.id,
          nombre: nombreNorm.trim(),
          apellidoPaterno: apePNorm.trim(),
          apellidoMaterno: apeMNorm.trim() || undefined,
          numero: Number(numero),
        });
        setJugadores((prev) => [...prev, jugadorResp].sort((a, b) => a.numero - b.numero));
      }
      setNombre('');
      setApellidoPaterno('');
      setApellidoMaterno('');
      setNumero('');
      setCurp('');
      setFotoFile(null);
      setEditingId(null);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'No se pudo registrar al jugador.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Jugadores del equipo</h1>
        <button
          type="button"
          onClick={() => navigate('/panel-equipo')}
          className="text-sm text-slate-300 hover:text-white px-3 py-1 rounded border border-slate-600"
        >
          Volver al panel de capitán
        </button>
      </div>
      {equipo && (
        <p className="text-slate-400 text-sm">
          Equipo:{' '}
          <span className="font-medium text-slate-100">
            {equipo.nombre}
          </span>{' '}
          · Categoría {equipo.categoria}
        </p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {loading ? (
        <p className="text-slate-400">Cargando jugadores...</p>
      ) : (
        <>
          <section className="rounded-xl border border-slate-700 bg-slate-800 p-4 space-y-3">
            <h2 className="text-lg font-semibold text-slate-100">Agregar jugador</h2>
            <form className="space-y-3" onSubmit={handleAdd}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Nombre(s)</label>
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    required
                    className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Apellido paterno</label>
                  <input
                    type="text"
                    value={apellidoPaterno}
                    onChange={(e) => setApellidoPaterno(e.target.value)}
                    required
                    className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Apellido materno (opcional)</label>
                  <input
                    type="text"
                    value={apellidoMaterno}
                    onChange={(e) => setApellidoMaterno(e.target.value)}
                    className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Número</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={numero}
                    onChange={(e) => {
                      const soloDigitos = e.target.value.replace(/\D/g, '').slice(0, 3);
                      setNumero(soloDigitos);
                    }}
                    required
                    className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">CURP</label>
                  <input
                    type="text"
                    value={curp}
                    onChange={(e) => setCurp(e.target.value.toUpperCase())}
                    maxLength={18}
                    required
                    className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                    placeholder="18 caracteres en mayúsculas"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">
                    Foto (selfie, opcional)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFotoFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-slate-300"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={saving || !equipo}
                className="inline-flex items-center justify-center rounded-md bg-primary-600 hover:bg-primary-500 disabled:opacity-60 px-4 py-2 text-sm font-medium text-white"
              >
                {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Agregar jugador'}
              </button>
            </form>
          </section>

          <section className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <h2 className="text-lg font-semibold text-slate-100 mb-2">Jugadores registrados</h2>
            {jugadores.length === 0 ? (
              <p className="text-slate-400 text-sm">Todavía no hay jugadores registrados.</p>
            ) : (
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-slate-300 border-b border-slate-600">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Nombre</th>
                    <th className="px-3 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {jugadores.map((j) => (
                    <tr key={j.id} className="border-b border-slate-700 text-slate-200">
                      <td className="px-3 py-2 w-12">{j.numero}</td>
                      <td className="px-3 py-2">
                        {j.nombre} {j.apellido}
                      </td>
                      <td className="px-3 py-2 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(j.id);
                            setNombre(j.nombre);
                            const partesApellido = j.apellido.split(' ');
                            setApellidoPaterno(partesApellido[0] ?? '');
                            setApellidoMaterno(partesApellido.slice(1).join(' '));
                            setNumero(String(j.numero));
                            // La CURP no la conocemos aquí; se queda como esté el input.
                          }}
                          className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.confirm('¿Eliminar este jugador?')) return;
                            try {
                              await eliminarJugador(j.id);
                              setJugadores((prev) => prev.filter((jj) => jj.id !== j.id));
                              if (editingId === j.id) {
                                setEditingId(null);
                                setNombre('');
                                setApellidoPaterno('');
                                setApellidoMaterno('');
                                setNumero('');
                              }
                            } catch (e: any) {
                              console.error(e);
                              setError(e?.message || 'No se pudo eliminar al jugador.');
                            }
                          }}
                          className="text-xs px-2 py-1 rounded bg-red-700 hover:bg-red-600"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}

