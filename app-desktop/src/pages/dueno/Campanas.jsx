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
import { campanasAfiliados } from '../../services/campanasAfiliados';

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
  const [campanas, setCampanas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const solicitud = useRef(0);

  // Carga el listado de la cafetería activa y descarta respuestas atrasadas.
  const cargar = useCallback(async () => {
    const id = ++solicitud.current;
    setLoading(true);
    try {
      const filas = await campanasAfiliados.listar(cafeteriaId);
      if (id !== solicitud.current) return;
      setCampanas(filas);
      setError('');
    } catch (err) {
      if (id === solicitud.current) setError(err.message || 'No se pudieron cargar las campañas.');
    } finally {
      if (id === solicitud.current) setLoading(false);
    }
  }, [cafeteriaId]);

  useEffect(() => {
    if (!cafeteriaId) { setCampanas([]); setLoading(false); return undefined; }
    setCampanas([]);
    cargar();
    return () => { solicitud.current++; };
  }, [cafeteriaId, cargar]);

  if (!cafeteriaId) {
    return <Alert severity="warning">No hay una cafetería asignada a tu sesión. Contacta con el administrador para revisar tu acceso.</Alert>;
  }

  // Regresa al listado conservando el estado ya cargado.
  const volverAlListado = () => navigate(LISTADO);
  // En una ruta profunda hay que esperar el listado antes de resolver el id.
  const cargandoInicial = loading && campanas.length === 0;

  return (
    <Routes>
      <Route index element={
        <Listado campanas={campanas} loading={loading} error={error} cafeteriaId={cafeteriaId}
          onReintentar={cargar} onNueva={() => navigate(`${LISTADO}/nueva`)}
          onResumen={(c) => navigate(`${LISTADO}/${c.id}`)} onEditar={(c) => navigate(`${LISTADO}/${c.id}/editar`)} />
      } />
      <Route path="nueva" element={
        <Formulario campanas={campanas} cafeteriaId={cafeteriaId} onVolver={volverAlListado}
          onGuardado={async () => { await cargar(); volverAlListado(); }} />
      } />
      <Route path=":id/editar" element={cargandoInicial ? <Cargando /> : (
        <Formulario campanas={campanas} cafeteriaId={cafeteriaId} onVolver={volverAlListado}
          onGuardado={async () => { await cargar(); volverAlListado(); }} />
      )} />
      <Route path=":id" element={cargandoInicial ? <Cargando /> : (
        <Resumen campanas={campanas} onVolver={volverAlListado}
          onEditar={(c) => navigate(`${LISTADO}/${c.id}/editar`)} />
      )} />
    </Routes>
  );
}

// Indicador de carga del listado y de las rutas que dependen de él.
function Cargando() {
  return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
}

// Listado de campañas con estados de carga, error y vacío.
function Listado({ campanas, loading, error, cafeteriaId, onReintentar, onNueva, onResumen, onEditar }) {
  return (
    <Box>
      <PageHeader
        title="Campañas"
        subtitle="Campañas de carrito completo y comisiones de tu cafetería."
        actions={<>
          <Chip label={`Cafetería #${cafeteriaId}`} variant="outlined" />
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
      {loading ? (
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
              </Stack>
            </Paper>
          ))}
        </Box>
      )}
    </Box>
  );
}

// Formulario de creación y edición de una campaña.
function Formulario({ campanas, cafeteriaId, onVolver, onGuardado }) {
  const { id } = useParams();
  const existente = id ? campanas.find(c => String(c.id) === String(id)) : null;
  const [form, setForm] = useState(() => (existente
    ? { ...existente, inicio: paraInput(existente.inicio), fin: paraInput(existente.fin) }
    : nuevaCampana()));
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  // Actualiza un campo del formulario sin perder el resto.
  const cambiar = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }));

  // Valida, envía el formulario y refresca el listado al guardar.
  const guardar = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFormError('');
    try {
      if (existente) await campanasAfiliados.actualizar(cafeteriaId, existente.id, form);
      else await campanasAfiliados.crear(cafeteriaId, form);
      await onGuardado();
    } catch (err) {
      setFormError(err.message || 'No se pudo guardar la campaña.');
    } finally {
      setBusy(false);
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
      <Paper component="form" onSubmit={guardar} elevation={0} sx={{ border: '1px solid #E9E1D9', borderRadius: 4, p: 3, maxWidth: 640 }}>
        <Stack spacing={2.5}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField label="Nombre de la campaña" value={form.nombre} onChange={cambiar('nombre')} required disabled={busy} inputProps={{ maxLength: 120 }} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Descuento a precio normal" type="number" value={form.descuento_normal_pct} onChange={cambiar('descuento_normal_pct')} disabled={busy} inputProps={{ min: 0, max: 100, step: 1 }} InputProps={{ endAdornment: '%' }} fullWidth />
            <TextField label="Descuento en oferta" type="number" value={form.descuento_oferta_pct} onChange={cambiar('descuento_oferta_pct')} disabled={busy} inputProps={{ min: 0, max: 100, step: 1 }} InputProps={{ endAdornment: '%' }} fullWidth />
            <TextField label="Comisión" type="number" value={form.comision_pct} onChange={cambiar('comision_pct')} disabled={busy} inputProps={{ min: 0, max: 100, step: 1 }} InputProps={{ endAdornment: '%' }} fullWidth />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Inicio" type="datetime-local" value={form.inicio || ''} onChange={cambiar('inicio')} disabled={busy} InputLabelProps={{ shrink: true }} fullWidth />
            <TextField label="Término" type="datetime-local" value={form.fin || ''} onChange={cambiar('fin')} disabled={busy} InputLabelProps={{ shrink: true }} fullWidth />
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
function Resumen({ campanas, onVolver, onEditar }) {
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
      <Paper elevation={0} sx={{ border: '1px solid #E9E1D9', borderRadius: 4, p: 3, maxWidth: 640 }}>
        <Stack spacing={1.5}>
          <Chip label={estadoTexto(campana)} sx={{ alignSelf: 'flex-start' }} />
          <Typography>Descuento a precio normal: <strong>{porcentaje(campana.descuento_normal_pct)}</strong></Typography>
          <Typography>Descuento en oferta: <strong>{porcentaje(campana.descuento_oferta_pct)}</strong></Typography>
          <Typography>Comisión del afiliado: <strong>{porcentaje(campana.comision_pct)}</strong></Typography>
          <Typography>Inicio: {fecha(campana.inicio)}</Typography>
          <Typography>Término: {fecha(campana.fin)}</Typography>
          <Stack direction="row" justifyContent="flex-end"><Button onClick={() => onEditar(campana)}>Editar campaña</Button></Stack>
        </Stack>
      </Paper>
    </Box>
  );
}

export default Campanas;
