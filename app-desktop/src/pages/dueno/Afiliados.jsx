// Pantalla de afiliados del dueño: solicitudes por campaña y gestión de códigos (E10 / CAM-232).
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, CircularProgress, Paper, Stack, TextField, Typography,
} from '@mui/material';
import { campanasAfiliados } from '../../services/campanasAfiliados';

// Cafetería autorizada del perfil: entero positivo, o null si la asignación no sirve.
function cafeteriaAutorizada(usuario) {
  const asignacion = usuario?.cafeteria_id;
  const id = typeof asignacion === 'number' || typeof asignacion === 'string' ? Number(asignacion) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

// Muestra un porcentaje legible o un guion cuando el servidor no lo informa.
const porcentaje = (valor) => (valor === '' || valor === null || valor === undefined ? '—' : `${Number(valor)}%`);

// Etiqueta legible de los estados devueltos por el contrato C05.
const estadoTexto = (estado) => ({
  pendiente: 'Pendiente', aprobada: 'Aprobada', rechazada: 'Rechazada',
}[estado] || estado || 'sin estado');

export default function Afiliados({ currentUser }) {
  const navigate = useNavigate();
  const cafeteriaId = cafeteriaAutorizada(currentUser);
  const claveCafeteria = cafeteriaId === null ? '' : String(cafeteriaId);
  const [campanas, setCampanas] = useState({ clave: '', datos: [], loading: true, error: '' });
  const [campanaId, setCampanaId] = useState(null);
  const [solicitudes, setSolicitudes] = useState({ clave: '', datos: [], loading: false, error: '' });
  const [filtro, setFiltro] = useState('todas');
  const [accion, setAccion] = useState(null);
  const [codigo, setCodigo] = useState('');
  const [errorAccion, setErrorAccion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [intentoCampanas, setIntentoCampanas] = useState(0);
  const [intentoSolicitudes, setIntentoSolicitudes] = useState(0);
  const campanasReq = useRef(0);
  const solicitudesReq = useRef(0);
  const decisionReq = useRef(0);
  const cafeteriaActual = useRef(cafeteriaId);
  cafeteriaActual.current = cafeteriaId;
  // La campaña vigente se lee del render actual: el cierre de resolver pertenece al render que lo inició.
  const campanaActual = useRef(campanaId);
  campanaActual.current = campanaId;
  const campanasVigentes = campanas.clave === claveCafeteria;
  const campanaActiva = campanasVigentes && campanas.datos.some(c => c.id === campanaId) ? campanaId : null;
  const claveSolicitudes = `${claveCafeteria}:${campanaActiva ?? ''}`;

  // Carga las campañas de la cafetería vigente y descarta respuestas atrasadas.
  useEffect(() => {
    const id = ++campanasReq.current;
    if (cafeteriaId === null) {
      setCampanas({ clave: '', datos: [], loading: false, error: '' });
      setCampanaId(null);
      return;
    }
    setCampanas(prev => prev.clave === claveCafeteria
      ? { ...prev, loading: true, error: '' }
      : { clave: claveCafeteria, datos: [], loading: true, error: '' });
    campanasAfiliados.listar(cafeteriaId).then(datos => {
      if (id !== campanasReq.current || cafeteriaId !== cafeteriaActual.current) return;
      setCampanas({ clave: claveCafeteria, datos, loading: false, error: '' });
      setCampanaId(actual => (datos.some(c => c.id === actual) ? actual : datos[0]?.id ?? null));
    }).catch(err => {
      if (id !== campanasReq.current || cafeteriaId !== cafeteriaActual.current) return;
      setCampanas({ clave: claveCafeteria, datos: [], loading: false, error: err.message || 'No se pudieron cargar las campañas.' });
      setCampanaId(null);
    });
  }, [cafeteriaId, claveCafeteria, intentoCampanas]);

  // Carga las solicitudes de la campaña seleccionada sin mezclar contextos.
  useEffect(() => {
    const id = ++solicitudesReq.current;
    if (cafeteriaId === null || campanaActiva === null) {
      setSolicitudes({ clave: claveSolicitudes, datos: [], loading: false, error: '' });
      return;
    }
    setSolicitudes({ clave: claveSolicitudes, datos: [], loading: true, error: '' });
    campanasAfiliados.listarSolicitudes(cafeteriaId, campanaActiva).then(datos => {
      if (id !== solicitudesReq.current || cafeteriaId !== cafeteriaActual.current) return;
      setSolicitudes({ clave: claveSolicitudes, datos, loading: false, error: '' });
    }).catch(err => {
      if (id !== solicitudesReq.current || cafeteriaId !== cafeteriaActual.current) return;
      setSolicitudes({ clave: claveSolicitudes, datos: [], loading: false, error: err.message || 'No se pudieron cargar las solicitudes.' });
    });
  }, [cafeteriaId, campanaActiva, claveSolicitudes, intentoSolicitudes]);

  // Limpia la decisión pendiente cuando cambia la cafetería o la campaña.
  useEffect(() => {
    setAccion(null);
    setCodigo('');
    setErrorAccion('');
    setGuardando(false);
  }, [claveCafeteria, campanaId]);

  // Envía la decisión y recarga la lista solo si el contexto sigue siendo el mismo.
  async function resolver(decision, solicitud) {
    const objetivo = cafeteriaId;
    const campana = campanaId;
    const id = ++decisionReq.current;
    // Cada decisión tiene su secuencia: la respuesta de una anterior no cierra la nueva aunque siga en la misma campaña.
    const vigente = () => id === decisionReq.current && objetivo === cafeteriaActual.current && campana === campanaActual.current;
    setGuardando(true);
    setErrorAccion('');
    try {
      await campanasAfiliados.resolverSolicitud(objetivo, campana, solicitud.id, decision, codigo);
      if (!vigente()) return;
      setAccion(null);
      setCodigo('');
      setIntentoSolicitudes(n => n + 1);
    } catch (err) {
      if (!vigente()) return;
      setErrorAccion(err.message || 'No se pudo registrar la decisión.');
    } finally {
      if (vigente()) setGuardando(false);
    }
  }

  if (cafeteriaId === null) {
    return (
      <Alert severity="warning">
        No hay una cafetería asignada a tu sesión. Contacta con el administrador para revisar tu acceso.
      </Alert>
    );
  }

  const listaCampanas = campanasVigentes ? campanas.datos : [];
  const cargandoCampanas = !campanasVigentes || campanas.loading;
  const errorCampanas = campanasVigentes ? campanas.error : '';
  const campana = listaCampanas.find(c => c.id === campanaActiva) || null;
  const solicitudesVigentes = solicitudes.clave === claveSolicitudes;
  const cargandoSolicitudes = !solicitudesVigentes || solicitudes.loading;
  const filas = (solicitudesVigentes ? solicitudes.datos : [])
    .filter(s => filtro === 'todas' || s.estado === filtro);

  return (
    <Stack spacing={2}>
      <Paper component="section" aria-label="Contexto de afiliados" variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
        <Stack spacing={2} alignItems="flex-start">
          <Typography variant="h6">Afiliados de tu cafetería</Typography>
          <Chip label={`Cafetería #${cafeteriaId}`} variant="outlined" />
          <Typography variant="body2" color="text.secondary">
            Revisa las solicitudes de tus campañas de carrito completo, asigna códigos y desactívalos cuando lo necesites.
          </Typography>
          <Button variant="contained" onClick={() => navigate('/dueno/afiliados/campanas')}>
            Administrar campañas
          </Button>
        </Stack>
      </Paper>

      <Paper component="section" aria-label="Solicitudes de afiliación" variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6">Solicitudes de afiliación</Typography>
          {errorCampanas && (
            <Alert severity="error" action={<Button onClick={() => setIntentoCampanas(n => n + 1)}>Reintentar</Button>}>
              {errorCampanas}
            </Alert>
          )}
          {cargandoCampanas && <CircularProgress aria-label="Cargando campañas" />}
          {!cargandoCampanas && !errorCampanas && listaCampanas.length === 0 && (
            <Typography>No hay campañas disponibles en esta cafetería.</Typography>
          )}
          {!cargandoCampanas && !errorCampanas && listaCampanas.length > 0 && (
            <>
              <Box component="label">
                Campaña
                <select aria-label="Campaña" value={campanaId ?? ''} onChange={e => setCampanaId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Selecciona una campaña</option>
                  {listaCampanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </Box>
              <Typography>Comisión vigente: {porcentaje(campana?.comision_pct)}</Typography>
              <Box component="label">
                Estado
                <select aria-label="Estado" value={filtro} onChange={e => setFiltro(e.target.value)}>
                  <option value="todas">Todas</option>
                  {['pendiente', 'aprobada', 'rechazada'].map(estado => (
                    <option key={estado} value={estado}>{estadoTexto(estado)}</option>
                  ))}
                </select>
              </Box>

              {solicitudesVigentes && solicitudes.error && (
                <Alert severity="error" action={<Button onClick={() => setIntentoSolicitudes(n => n + 1)}>Reintentar</Button>}>
                  {solicitudes.error}
                </Alert>
              )}
              {cargandoSolicitudes && <CircularProgress aria-label="Cargando solicitudes" />}
              {!cargandoSolicitudes && !solicitudes.error && (
                <>
                  {filas.length === 0 ? (
                    <Typography>No hay solicitudes con este estado.</Typography>
                  ) : filas.map(s => (
                    <Box key={s.id} component="article" aria-label={`Solicitud ${s.id}`}>
                      <Typography>{s.solicitante} · {estadoTexto(s.estado)}</Typography>
                      <Typography>{s.plan_promocion}</Typography>
                      {s.enlace_publico && <Typography>{s.enlace_publico}</Typography>}
                      {s.codigo && (
                        <Typography>Código: {s.codigo} ({s.codigo_activo ? 'activo' : 'desactivado'})</Typography>
                      )}
                      <Stack direction="row" spacing={1}>
                        {s.estado === 'pendiente' && (
                          <Button disabled={guardando} onClick={() => { setAccion({ solicitud: s, decision: 'aprobar' }); setCodigo(''); setErrorAccion(''); }}>
                            Aprobar
                          </Button>
                        )}
                        {s.estado === 'pendiente' && (
                          <Button disabled={guardando} onClick={() => { setAccion({ solicitud: s, decision: 'rechazar' }); setErrorAccion(''); }}>
                            Rechazar
                          </Button>
                        )}
                        {s.estado === 'aprobada' && s.codigo_activo && (
                          <Button disabled={guardando} onClick={() => { setAccion({ solicitud: s, decision: 'desactivar' }); setErrorAccion(''); }}>
                            Desactivar
                          </Button>
                        )}
                      </Stack>
                    </Box>
                  ))}
                </>
              )}

              {accion && (
                <Stack spacing={1}>
                  <Typography>
                    {accion.decision === 'aprobar'
                      ? `Asignar código a ${accion.solicitud.solicitante}`
                      : `${accion.decision === 'rechazar' ? 'Rechazar' : 'Desactivar'} solicitud ${accion.solicitud.id}`}
                  </Typography>
                  {accion.decision === 'aprobar' && (
                    <TextField
                      label="Código del afiliado (opcional)"
                      value={codigo}
                      onChange={e => setCodigo(e.target.value)}
                    />
                  )}
                  {errorAccion && <Alert severity="error">{errorAccion}</Alert>}
                  <Stack direction="row" spacing={1}>
                    <Button onClick={() => resolver(accion.decision, accion.solicitud)} disabled={guardando}>
                      Confirmar
                    </Button>
                    <Button onClick={() => { setAccion(null); setCodigo(''); setErrorAccion(''); }}>
                      Cancelar
                    </Button>
                  </Stack>
                </Stack>
              )}
            </>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
