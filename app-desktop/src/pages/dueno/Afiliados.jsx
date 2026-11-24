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

const estadoColor = { pendiente: 'warning', aprobada: 'success', rechazada: 'error' };
const selectorSx = {
  display: 'grid',
  gap: 0.75,
  color: 'text.secondary',
  fontSize: '0.875rem',
  fontWeight: 600,
  '& select': {
    p: 1.25,
    minWidth: 0,
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: 2,
    bgcolor: 'background.paper',
    color: 'text.primary',
    font: 'inherit',
    '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
  },
};

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
    // Invalidar también la respuesta en curso: al volver al contexto inicial, cafetería y campaña coinciden otra vez.
    decisionReq.current += 1;
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
    <Stack spacing={3}>
      <Paper component="section" aria-label="Contexto de afiliados" variant="outlined" sx={{
        p: { xs: 2, md: 3 }, borderRadius: 4,
      }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between' }}>
          <Stack spacing={1}>
            <Stack direction="row" sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="h6">Afiliados de tu cafetería</Typography>
              <Chip label={`Cafetería #${cafeteriaId}`} size="small" variant="outlined" />
            </Stack>
            <Typography variant="body2" color="text.secondary">Revisa las postulaciones y administra los códigos de tus campañas.</Typography>
          </Stack>
          <Button variant="outlined" sx={{ flexShrink: 0 }}
            onClick={() => navigate('/dueno/afiliados/campanas')}>
            Administrar campañas
          </Button>
        </Stack>
      </Paper>

      <Paper component="section" aria-label="Solicitudes de afiliación" variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 4 }}>
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
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 2fr) minmax(0, 1fr)' }, gap: 2,
                bgcolor: 'background.default', border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 2 }}>
                <Box component="label" sx={selectorSx}>
                  Campaña
                  <select aria-label="Campaña" value={campanaId ?? ''} onChange={e => setCampanaId(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Selecciona una campaña</option>
                    {listaCampanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </Box>
                <Box component="label" sx={selectorSx}>
                  Estado
                  <select aria-label="Estado" value={filtro} onChange={e => setFiltro(e.target.value)}>
                    <option value="todas">Todas</option>
                    {['pendiente', 'aprobada', 'rechazada'].map(estado => (
                      <option key={estado} value={estado}>{estadoTexto(estado)}</option>
                    ))}
                  </select>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ gridColumn: '1 / -1' }}>
                  Comisión vigente: <strong>{porcentaje(campana?.comision_pct)}</strong>
                </Typography>
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
                    <Typography color="text.secondary" sx={{ p: 3, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 3 }}>
                      No hay solicitudes con este estado.
                    </Typography>
                  ) : filas.map(s => (
                    <Box key={s.id} component="article" aria-label={`Solicitud ${s.id}`} sx={{
                      display: 'flex', flexDirection: 'column', gap: 1.5,
                      p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 3,
                      borderLeft: '4px solid', borderLeftColor: estadoColor[s.estado] ? `${estadoColor[s.estado]}.main` : 'divider',
                    }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <Typography variant="subtitle1" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>{s.solicitante}</Typography>
                        <Chip label={estadoTexto(s.estado)} color={estadoColor[s.estado] || 'default'} variant="outlined" size="small" />
                      </Stack>
                      <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight={700}>Plan de promoción</Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{s.plan_promocion}</Typography>
                        {s.enlace_publico && <Typography variant="body2" color="primary.main" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>{s.enlace_publico}</Typography>}
                      </Box>
                      {s.codigo && (
                        <Chip variant="outlined" size="small" color={s.codigo_activo ? 'success' : 'default'}
                          label={`Código: ${s.codigo} (${s.codigo_activo ? 'activo' : 'desactivado'})`}
                          sx={{ alignSelf: 'flex-start', maxWidth: '100%', fontFamily: 'monospace' }} />
                      )}
                      <Stack direction="row" spacing={1}>
                        {s.estado === 'pendiente' && (
                          <Button variant="contained" size="small" disabled={guardando} onClick={() => { setAccion({ solicitud: s, decision: 'aprobar' }); setCodigo(''); setErrorAccion(''); }}>
                            Aprobar
                          </Button>
                        )}
                        {s.estado === 'pendiente' && (
                          <Button variant="outlined" size="small" color="error" disabled={guardando} onClick={() => { setAccion({ solicitud: s, decision: 'rechazar' }); setErrorAccion(''); }}>
                            Rechazar
                          </Button>
                        )}
                        {s.estado === 'aprobada' && s.codigo_activo && (
                          <Button variant="outlined" size="small" disabled={guardando} onClick={() => { setAccion({ solicitud: s, decision: 'desactivar' }); setErrorAccion(''); }}>
                            Desactivar
                          </Button>
                        )}
                      </Stack>
                    </Box>
                  ))}
                </>
              )}

              {accion && (
                <Stack spacing={1.5} sx={{ p: 2.5, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                  <Typography fontWeight={700}>
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
                    <Button variant="contained" color={accion.decision === 'aprobar' ? 'primary' : 'error'}
                      onClick={() => resolver(accion.decision, accion.solicitud)} disabled={guardando}>
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
