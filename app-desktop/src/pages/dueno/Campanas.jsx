// Vista principal de campañas de afiliados del dueño (E03 / CAM-290).
// Navega entre listado, formulario y resumen reutilizando el layout y PageHeader.
// El contexto de cafetería proviene siempre del perfil autorizado, nunca de la URL.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, CircularProgress, Paper, Stack, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import PageHeader from '../../components/dueno/PageHeader';
import { campanasAfiliados, validarFormularioCampana } from '../../services/campanasAfiliados';

const LISTADO = '/dueno/afiliados/campanas';

// Formulario vacío para crear una campaña.
const nuevaCampana = () => ({
  nombre: '', descuento_normal_pct: '', descuento_oferta_pct: '', comision_pct: '', inicio: '', fin: '',
});

// Cafetería autorizada del perfil: entero positivo, o null si la asignación no sirve.
function cafeteriaAutorizada(usuario) {
  const asignacion = usuario?.cafeteria_id;
  const id = typeof asignacion === 'number' || typeof asignacion === 'string' ? Number(asignacion) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

// Formatea un porcentaje, o un guion si no viene informado.
const porcentaje = (valor) => (valor === '' || valor === null || valor === undefined ? '—' : `${Number(valor)}%`);
// Formatea una fecha ISO, o indica que no hay límite.
const fecha = (iso) => (iso ? new Date(iso).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sin límite');
// Texto legible del estado de la campaña.
const estadoTexto = (campana) => (campana?.estado ? String(campana.estado) : 'sin estado');
// Acción de estado permitida por la RPC: solo activa/aceptada se pausan y solo pausada se activa.
function accionEstado(campana) {
  if (!campana || campana.estado === 'finalizada') return null;
  // La RPC exige aceptación vigente para reactivar; sin ella la campaña quedaría atrapada en pausada.
  const version = String(campana.version_confirmada || '').trim();
  if (!campana.confirmada_por_dueno || !version
    || version !== String(campana.version_condiciones || '').trim()) return null;
  const db = String(campana.estado_db || '').toLowerCase();
  if (db === 'pausada') return 'activar';
  if (db === 'activa' || db === 'aceptada') return 'pausar';
  return null;
}

// Botón de cambio de estado; no se renderiza cuando la campaña no admite la acción.
function BotonEstado({ campana, onCambiarEstado, size }) {
  const accion = accionEstado(campana);
  if (!accion) return null;
  return <Button size={size} onClick={() => onCambiarEstado(campana, accion)}>
    {accion === 'pausar' ? 'Pausar' : 'Activar'}
  </Button>;
}

// Convierte una fecha ISO al valor local que espera <input type="datetime-local">.
const paraInput = (iso) => {
  if (!iso) return '';
  const valor = new Date(iso);
  if (!Number.isFinite(valor.getTime())) return '';
  return new Date(valor.getTime() - valor.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

// Vista principal: mantiene el listado y resuelve las rutas de listado, formulario y resumen.
function Campanas({ currentUser }) {
  const navigate = useNavigate();
  const cafeteriaId = cafeteriaAutorizada(currentUser);
  // El listado guarda a qué cafetería pertenece. Así el primer render tras un
  // cambio de cafetería no puede mostrar filas, error ni carga de la anterior.
  const [listado, setListado] = useState({ cafeteriaId: null, campanas: [], loading: true, error: '', accionError: '' });
  const vigente = listado.cafeteriaId === cafeteriaId;
  const campanas = vigente ? listado.campanas : [];
  const loading = vigente ? listado.loading : true;
  const error = vigente ? listado.error : '';
  const errorAccion = vigente ? listado.accionError : '';
  const solicitud = useRef(0);
  // Cafetería vigente del render: invalida cargas y guardados que terminan tras
  // un cambio de perfil, aunque su callback se dispare más tarde.
  const cafeteriaActual = useRef(cafeteriaId);
  cafeteriaActual.current = cafeteriaId;

  // Carga el listado de la cafetería activa y descarta respuestas atrasadas.
  const cargar = useCallback(async () => {
    const objetivo = cafeteriaId;
    if (objetivo !== cafeteriaActual.current) return;
    const id = ++solicitud.current;
    // Al recargar la misma cafetería se conservan sus filas; al cambiar de
    // cafetería nunca se reutilizan las de la anterior.
    setListado(prev => (prev.cafeteriaId === objetivo
      ? { ...prev, loading: true, error: '', accionError: '' }
      : { cafeteriaId: objetivo, campanas: [], loading: true, error: '', accionError: '' }));
    try {
      const filas = await campanasAfiliados.listar(objetivo);
      if (id !== solicitud.current || objetivo !== cafeteriaActual.current) return;
      setListado({ cafeteriaId: objetivo, campanas: filas, loading: false, error: '', accionError: '' });
    } catch (err) {
      if (id === solicitud.current && objetivo === cafeteriaActual.current) {
        setListado({ cafeteriaId: objetivo, campanas: [], loading: false, error: err.message || 'No se pudieron cargar las campañas.', accionError: '' });
      }
    }
  }, [cafeteriaId]);

  useEffect(() => {
    if (!cafeteriaId) { setListado({ cafeteriaId: null, campanas: [], loading: false, error: '' }); return undefined; }
    cargar();
    return () => { solicitud.current++; };
  }, [cafeteriaId, cargar]);

  if (!cafeteriaId) {
    return <Alert severity="warning">No hay una cafetería asignada a tu sesión. Contacta con el administrador para revisar tu acceso.</Alert>;
  }

  // Regresa al listado conservando el estado ya cargado.
  const volverAlListado = () => navigate(LISTADO);

  // Recarga y vuelve al listado solo si el guardado sigue perteneciendo a la cafetería activa.
  const guardarYVolver = async (origen) => {
    if (origen !== cafeteriaActual.current) return;
    await cargar();
    if (origen !== cafeteriaActual.current) return;
    volverAlListado();
  };

  // Pausa o reactiva una campaña y recarga el listado de la cafetería activa.
  const cambiarEstado = async (campana, accion) => {
    const origen = cafeteriaId;
    if (origen !== cafeteriaActual.current) return;
    try {
      await campanasAfiliados.cambiarEstado(origen, campana.id, accion === 'pausar');
    } catch (err) {
      if (origen !== cafeteriaActual.current) return;
      setListado(prev => (prev.cafeteriaId === origen
        ? { ...prev, accionError: err.message || 'No se pudo cambiar el estado de la campaña.' }
        : prev));
      return;
    }
    await cargar();
  };

  // Resuelve las rutas que dependen del listado: carga, error con reintento o
  // contenido. Solo tras una carga exitosa se puede hablar de campaña inexistente.
  const detalle = (contenido) => {
    if (loading && campanas.length === 0) return <Cargando />;
    if (error) {
      return (
        <Box>
          <PageHeader title="Campañas" subtitle="No se pudo cargar la campaña solicitada."
            actions={<Button startIcon={<ArrowBackIcon />} onClick={volverAlListado}>Volver al listado</Button>} />
          <Alert severity="error" action={<Button color="inherit" onClick={cargar}>Reintentar</Button>}>
            {error}
          </Alert>
        </Box>
      );
    }
    return contenido;
  };

  return (
    <Routes>
      <Route index element={
        <Listado campanas={campanas} loading={loading} error={error} errorAccion={errorAccion} cafeteriaId={cafeteriaId}
          onReintentar={cargar} onNueva={() => navigate(`${LISTADO}/nueva`)} onCambiarEstado={cambiarEstado}
          onResumen={(c) => navigate(`${LISTADO}/${c.id}`)} onEditar={(c) => navigate(`${LISTADO}/${c.id}/editar`)} />
      } />
      <Route path="nueva" element={
        <Formulario key={cafeteriaId} campanas={campanas} cafeteriaId={cafeteriaId} onVolver={volverAlListado}
          onGuardado={guardarYVolver} />
      } />
      <Route path=":id/editar" element={detalle(
        <FormularioEdicion campanas={campanas} cafeteriaId={cafeteriaId} onVolver={volverAlListado}
          onGuardado={guardarYVolver} />
      )} />
      <Route path=":id" element={detalle(
        <Resumen campanas={campanas} errorAccion={errorAccion} onVolver={volverAlListado} onCambiarEstado={cambiarEstado}
          onReintentar={cargar} onEditar={(c) => navigate(`${LISTADO}/${c.id}/editar`)} />
      )} />
    </Routes>
  );
}

// Indicador de carga del listado y de las rutas que dependen de él.
function Cargando() {
  return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
}

// Listado de campañas con estados de carga, error y vacío.
function Listado({ campanas, loading, error, errorAccion, cafeteriaId, onReintentar, onNueva, onResumen, onEditar, onCambiarEstado }) {
  return (
    <Box>
      <PageHeader
        title="Campañas"
        subtitle="Campañas de carrito completo y comisiones de tu cafetería."
        actions={<>
          <Chip label={`Cafetería #${cafeteriaId}`} variant="outlined" />
          {loading && campanas.length > 0 && <CircularProgress size={20} aria-label="Actualizando campañas" />}
          <Button variant="contained" startIcon={<AddIcon />} onClick={onNueva} disabled={loading || Boolean(error)}>
            Nueva campaña
          </Button>
        </>}
      />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" onClick={onReintentar}>Reintentar</Button>}>
          {error}
        </Alert>
      )}
      {errorAccion && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" onClick={onReintentar}>Reintentar</Button>}>
          {errorAccion}
        </Alert>
      )}
      {loading && campanas.length === 0 ? (
        <Cargando />
      ) : error ? null : campanas.length === 0 ? (
        <Paper elevation={0} sx={{ border: '1px dashed #DCCBBA', borderRadius: 4, p: 6, textAlign: 'center' }}>
          <CampaignOutlinedIcon sx={{ fontSize: 48, color: '#AB8563', mb: 1 }} />
          <Typography variant="h6" fontWeight={800}>Aún no hay campañas</Typography>
          <Typography color="text.secondary" sx={{ mt: 1, mb: 2 }}>
            Crea la primera campaña de tu cafetería para ofrecer descuentos a los afiliados.
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={onNueva}>Crear la primera campaña</Button>
        </Paper>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2,minmax(0,1fr))', xl: 'repeat(3,minmax(0,1fr))' }, gap: 2.5 }}>
          {campanas.map((c) => (
            <Paper key={c.id} elevation={0} sx={{ borderRadius: 4, border: '1px solid #E9E1D9', p: 2.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <Typography variant="h6" fontWeight={800}>{c.nombre}</Typography>
                <Chip size="small" label={estadoTexto(c)} />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Normal {porcentaje(c.descuento_normal_pct)} · Oferta {porcentaje(c.descuento_oferta_pct)} · Comisión {porcentaje(c.comision_pct)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Desde {fecha(c.inicio)}<br />Hasta {fecha(c.fin)}
              </Typography>
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button size="small" onClick={() => onResumen(c)}>Ver resumen</Button>
                <Button size="small" onClick={() => onEditar(c)}>Editar</Button>
                <BotonEstado campana={c} onCambiarEstado={onCambiarEstado} size="small" />
              </Stack>
            </Paper>
          ))}
        </Box>
      )}
    </Box>
  );
}

// Remonta el formulario al cambiar de campaña para no reutilizar los datos de la anterior.
function FormularioEdicion(props) {
  const { id } = useParams();
  return <Formulario key={`${props.cafeteriaId}-${id}`} {...props} />;
}

// Formulario de creación y edición de una campaña.
function Formulario({ campanas, cafeteriaId, onVolver, onGuardado }) {
  const { id } = useParams();
  const existente = id ? campanas.find(c => String(c.id) === String(id)) : null;
  const [form, setForm] = useState(() => (existente
    ? {
      ...existente,
      descuento_normal_pct: existente.descuento_normal_pct ?? '',
      descuento_oferta_pct: existente.descuento_oferta_pct ?? '',
      comision_pct: existente.comision_pct ?? '',
      inicio: paraInput(existente.inicio),
      fin: paraInput(existente.fin),
    }
    : nuevaCampana()));
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [errores, setErrores] = useState({});
  // El formulario se desmonta al cambiar de cafetería; su guardado pendiente no
  // debe escribir estado en el componente retirado.
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);
  // Actualiza un campo y retira solo su error, conservando los demás valores.
  const cambiar = key => e => {
    setForm(prev => ({ ...prev, [key]: e.target.value }));
    setErrores(prev => ({ ...prev, [key]: undefined }));
    setFormError('');
  };

  // Valida, envía el formulario y refresca el listado al guardar.
  const guardar = async (e) => {
    e.preventDefault();
    if (busy) return;
    const detectados = validarFormularioCampana(form, !existente).errores;
    setErrores(detectados);
    if (Object.keys(detectados).length > 0) {
      setFormError('Revisa los campos marcados: hay datos obligatorios o inválidos.');
      return;
    }
    const origen = cafeteriaId;
    setBusy(true);
    setFormError('');
    try {
      if (existente) await campanasAfiliados.actualizar(origen, existente.id, form);
      else await campanasAfiliados.crear(origen, form);
      await onGuardado(origen);
    } catch (err) {
      if (montado.current) setFormError(err.message || 'No se pudo guardar la campaña.');
    } finally {
      if (montado.current) setBusy(false);
    }
  };

  // Un id inexistente no debe transformarse en una creación accidental.
  if (id && !existente) {
    return (
      <Box>
        <PageHeader title="Editar campaña" actions={<Button startIcon={<ArrowBackIcon />} onClick={onVolver}>Volver al listado</Button>} />
        <Alert severity="warning">No se encontró la campaña solicitada. Vuelve al listado para elegir una campaña.</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title={existente ? 'Editar campaña' : 'Nueva campaña'}
        subtitle="Define las tasas y la vigencia de la campaña."
        actions={<Button startIcon={<ArrowBackIcon />} onClick={onVolver}>Volver al listado</Button>}
      />
      <Paper component="form" onSubmit={guardar} noValidate elevation={0} sx={{ border: '1px solid #E9E1D9', borderRadius: 4, p: 3, maxWidth: 640 }}>
        <Stack spacing={2.5}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField label="Nombre de la campaña" value={form.nombre} onChange={cambiar('nombre')} required disabled={busy} inputProps={{ maxLength: 120 }} error={Boolean(errores.nombre)} helperText={errores.nombre} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Descuento a precio normal" type="number" value={form.descuento_normal_pct} onChange={cambiar('descuento_normal_pct')} required disabled={busy} inputProps={{ min: 0, max: 100, step: 0.01 }} InputProps={{ endAdornment: '%' }} error={Boolean(errores.descuento_normal_pct)} helperText={errores.descuento_normal_pct} fullWidth />
            <TextField label="Descuento en oferta" type="number" value={form.descuento_oferta_pct} onChange={cambiar('descuento_oferta_pct')} required disabled={busy} inputProps={{ min: 0, max: 100, step: 0.01 }} InputProps={{ endAdornment: '%' }} error={Boolean(errores.descuento_oferta_pct)} helperText={errores.descuento_oferta_pct} fullWidth />
            <TextField label="Comisión" type="number" value={form.comision_pct} onChange={cambiar('comision_pct')} required disabled={busy} inputProps={{ min: 0, max: 100, step: 0.01 }} InputProps={{ endAdornment: '%' }} error={Boolean(errores.comision_pct)} helperText={errores.comision_pct} fullWidth />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Inicio" type="datetime-local" value={form.inicio || ''} onChange={cambiar('inicio')} required={!existente} disabled={busy} InputLabelProps={{ shrink: true }} error={Boolean(errores.inicio)} helperText={errores.inicio} fullWidth />
            <TextField label="Término" type="datetime-local" value={form.fin || ''} onChange={cambiar('fin')} required={!existente} disabled={busy} InputLabelProps={{ shrink: true }} error={Boolean(errores.fin)} helperText={errores.fin} fullWidth />
          </Stack>
          <Stack direction="row" spacing={1.5} justifyContent="flex-end">
            <Button onClick={onVolver} disabled={busy}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={busy}>{busy ? 'Guardando…' : 'Guardar campaña'}</Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}

// Resumen de solo lectura de una campaña del listado.
function Resumen({ campanas, errorAccion, onVolver, onEditar, onCambiarEstado, onReintentar }) {
  const { id } = useParams();
  const campana = campanas.find(c => String(c.id) === String(id));
  if (!campana) {
    return (
      <Box>
        <PageHeader title="Resumen de la campaña" actions={<Button startIcon={<ArrowBackIcon />} onClick={onVolver}>Volver al listado</Button>} />
        <Alert severity="warning">No se encontró la campaña solicitada. Vuelve al listado para elegir una campaña.</Alert>
      </Box>
    );
  }
  return (
    <Box>
      <PageHeader
        title={campana.nombre}
        subtitle="Resumen de la campaña"
        actions={<Button startIcon={<ArrowBackIcon />} onClick={onVolver}>Volver al listado</Button>}
      />
      {errorAccion && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" onClick={onReintentar}>Reintentar</Button>}>
          {errorAccion}
        </Alert>
      )}
      <Paper elevation={0} sx={{ border: '1px solid #E9E1D9', borderRadius: 4, p: 3, maxWidth: 640 }}>
        <Stack spacing={1.5}>
          <Chip label={estadoTexto(campana)} sx={{ alignSelf: 'flex-start' }} />
          <Typography>Descuento a precio normal: <strong>{porcentaje(campana.descuento_normal_pct)}</strong></Typography>
          <Typography>Descuento en oferta: <strong>{porcentaje(campana.descuento_oferta_pct)}</strong></Typography>
          <Typography>Comisión del afiliado: <strong>{porcentaje(campana.comision_pct)}</strong></Typography>
          <Typography>Inicio: {fecha(campana.inicio)}</Typography>
          <Typography>Término: {fecha(campana.fin)}</Typography>
          <Stack direction="row" justifyContent="flex-end">
            <Button onClick={() => onEditar(campana)}>Editar campaña</Button>
            <BotonEstado campana={campana} onCambiarEstado={onCambiarEstado} />
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}

export default Campanas;
