import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import {
  listarJugadores,
  registrarJugador,
  actualizarJugador,
  eliminarJugador,
  listarMisEquipos,
  obtenerEquipo,
  lookupPersonaPorCurp,
  type Jugador,
  type Equipo,
} from '@/lib/api';
import { JugadorRow } from '@/components/jugadores/JugadorRow';

function normalizarNombrePropio(valor: string): string {
  if (!valor) return '';
  const lower = valor.toLocaleLowerCase('es-MX');
  return lower.replace(/\S+/g, (palabra) => {
    const [primera, ...resto] = palabra;
    if (!primera) return palabra;
    return primera.toLocaleUpperCase('es-MX') + resto.join('');
  });
}

function formatearCategoria(categoriaCruda: string | undefined | null): string {
  if (!categoriaCruda) return 'Sin categoría';

  const partes = categoriaCruda.split(':');
  const [a, b] = partes;

  const normalizar = (valor: string) =>
    valor.charAt(0).toUpperCase() + valor.slice(1).toLocaleLowerCase('es-MX');

  if (partes.length === 2) {
    const esPrimeraParteFuerza = ['primera', 'segunda', 'tercera', 'intermedia', 'especial'].includes(
      a.toLocaleLowerCase('es-MX')
    );

    if (esPrimeraParteFuerza) {
      return `${normalizar(a)} ${normalizar(b)}`;
    }

    return `${normalizar(b)} ${normalizar(a)}`;
  }

  return normalizar(categoriaCruda);
}

export default function JugadoresEquipo() {
  const { equipoId } = useParams<{ equipoId: string }>();
  const usuario = useAuthStore((s) => s.usuario);
  const isAdminLiga = useAuthStore((s) => s.hasRole('admin_liga'));
  const isCapitan = useAuthStore((s) => s.hasRole('capturista_roster'));
  const ligaIdStore = useAuthStore((s) => s.liga?.id);
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
  const [openSwipeJugadorId, setOpenSwipeJugadorId] = useState<string | null>(null);
  const [buscandoCurp, setBuscandoCurp] = useState(false);

  useEffect(() => {
    if (!equipoId) return;
    if (!usuario || (!isAdminLiga && !isCapitan)) {
      setError('Solo el administrador de la liga o el capitán pueden gestionar jugadores.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const eq = await obtenerEquipo(equipoId);
        if (cancelled) return;
        if (eq.ligaId !== ligaIdStore) {
          setError('Este equipo no pertenece a tu liga.');
          setEquipo(null);
          setJugadores([]);
          return;
        }
        if (!isAdminLiga) {
          const misEquipos = await listarMisEquipos();
          if (cancelled) return;
          if (!misEquipos.find((e) => e.id === equipoId)) {
            setError('Este equipo no pertenece a tu cuenta de capitán.');
            setEquipo(null);
            setJugadores([]);
            return;
          }
        }
        setEquipo(eq);
        const js = await listarJugadores(equipoId);
        if (!cancelled) setJugadores(js);
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
  }, [equipoId, usuario, isAdminLiga, isCapitan, ligaIdStore]);

  const buscarCurpEnSistema = async () => {
    if (!curp.trim() || curp.length < 4 || !ligaIdStore) return;
    setBuscandoCurp(true);
    try {
      const r = await lookupPersonaPorCurp(curp, ligaIdStore);
      if (r.sugerencia) {
        setNombre(normalizarNombrePropio(r.sugerencia.nombre));
        const apParts = r.sugerencia.apellido.trim().split(/\s+/);
        setApellidoPaterno(apParts[0] || '');
        setApellidoMaterno(apParts.slice(1).join(' ') || '');
      } else if (r.persona?.nombreDisplay || r.persona?.apellidoDisplay) {
        if (r.persona.nombreDisplay) setNombre(normalizarNombrePropio(r.persona.nombreDisplay));
        const ap = (r.persona.apellidoDisplay || '').trim().split(/\s+/);
        setApellidoPaterno(ap[0] || '');
        setApellidoMaterno(ap.slice(1).join(' ') || '');
      } else {
        window.alert('No hay datos previos para esta CURP. Completa nombre y apellidos manualmente.');
      }
    } catch (err) {
      console.error(err);
      window.alert('No se pudo consultar la CURP. Revisa la conexión.');
    } finally {
      setBuscandoCurp(false);
    }
  };

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
    if (!apellidoMaterno.trim()) {
      setError('El apellido materno es obligatorio.');
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
          apellidoMaterno: apeMNorm.trim(),
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
          apellidoMaterno: apeMNorm.trim(),
          numero: Number(numero),
          curp: curp.toUpperCase(),
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
          onClick={() => navigate(isAdminLiga ? '/administrar-equipos' : '/panel-equipo')}
          className="text-sm text-slate-300 hover:text-white px-3 py-1 rounded border border-slate-600"
        >
          {isAdminLiga ? 'Volver a administrar equipos' : 'Volver al panel de capitán'}
        </button>
      </div>
      {equipo && (
        <p className="text-slate-400 text-sm">
          Equipo:{' '}
          <span className="font-medium text-slate-100">
            {equipo.nombre}
          </span>{' '}
          · {formatearCategoria(equipo.categoria)}
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
                  <label className="block text-sm text-slate-300 mb-1">Apellido materno</label>
                  <input
                    type="text"
                    value={apellidoMaterno}
                    onChange={(e) => setApellidoMaterno(e.target.value)}
                    required
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
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={curp}
                      onChange={(e) => setCurp(e.target.value.toUpperCase())}
                      maxLength={18}
                      required
                      className="flex-1 rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                      placeholder="18 caracteres en mayúsculas"
                    />
                    <button
                      type="button"
                      onClick={buscarCurpEnSistema}
                      disabled={buscandoCurp || curp.length < 4}
                      className="shrink-0 rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-50 px-3 py-2 text-xs text-slate-100"
                    >
                      {buscandoCurp ? '…' : 'Buscar'}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Si la CURP ya existe en el sistema, puedes precargar nombre y apellidos.
                  </p>
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
                  {fotoFile && (
                    <p className="mt-1 text-xs text-slate-400">Archivo seleccionado: {fotoFile.name}</p>
                  )}
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
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-slate-100">Jugadores registrados</h2>
              <span className="text-xs text-slate-400">
                {jugadores.length} {jugadores.length === 1 ? 'jugador' : 'jugadores'}
              </span>
            </div>
            {jugadores.length === 0 ? (
              <p className="text-slate-400 text-sm">Todavía no hay jugadores registrados.</p>
            ) : (
              <div className="space-y-2">
                {jugadores.map((j) =>
                  editingId === j.id ? (
                    <div
                      key={j.id}
                      className="rounded-xl border border-amber-700/35 bg-amber-950/25 px-3 py-2 text-xs text-amber-100/95"
                    >
                      Editando en el formulario superior…
                    </div>
                  ) : (
                    <JugadorRow
                      key={j.id}
                      jugadorId={j.id}
                      numero={j.numero}
                      nombre={j.nombre}
                      apellido={j.apellido}
                      curp={j.curp}
                      openSwipeId={openSwipeJugadorId}
                      onOpenSwipeId={setOpenSwipeJugadorId}
                      onEdit={() => {
                        setOpenSwipeJugadorId(null);
                        setEditingId(j.id);
                        setNombre(j.nombre);
                        const partesApellido = j.apellido.split(' ');
                        setApellidoPaterno(partesApellido[0] ?? '');
                        setApellidoMaterno(partesApellido.slice(1).join(' '));
                        setNumero(String(j.numero));
                        setCurp(j.curp ?? '');
                      }}
                      onDelete={async () => {
                        if (!window.confirm(`¿Eliminar a ${j.nombre}?`)) return;
                        try {
                          setOpenSwipeJugadorId(null);
                          await eliminarJugador(j.id);
                          const actualizados = await listarJugadores(equipoId || '');
                          setJugadores(actualizados);
                          if (editingId === j.id) {
                            setEditingId(null);
                            setNombre('');
                            setApellidoPaterno('');
                            setApellidoMaterno('');
                            setNumero('');
                            setCurp('');
                          }
                        } catch (e: any) {
                          console.error(e);
                          setError(e?.message || 'No se pudo eliminar al jugador.');
                        }
                      }}
                    />
                  )
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

