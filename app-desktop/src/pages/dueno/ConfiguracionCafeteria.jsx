import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Chip, Divider, Paper, Skeleton, Stack, Switch, TextField, Typography, FormControlLabel } from '@mui/material';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import { configuracionCafeteria } from '../../services/administracionCafeteria';

const formulario = (data) => ({ nombre: data.nombre || '', descripcion: data.descripcion || '', telefono: data.telefono || '',
  hora_apertura: data.hora_apertura?.slice(0, 5) || '', hora_cierre: data.hora_cierre?.slice(0, 5) || '',
  imagen_url: data.imagen_url || '', activa: Boolean(data.activa) });
const panel = { p: { xs: 2.5, md: 3.5 }, borderRadius: 4, border: '1px solid #E9E1D9', boxShadow: '0 8px 28px #402B1806' };

export default function ConfiguracionCafeteria({ currentUser }) {
  const cafeteriaId = currentUser?.cafeteria_id;
  const [registro, setRegistro] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [imagenFallida, setImagenFallida] = useState(false);
  const solicitud = useRef(0);
  const guardando = useRef(false);
  const cargar = useCallback(async () => {
    const id = ++solicitud.current;
    setLoading(true); setError(''); setSuccess('');
    try {
      const data = await configuracionCafeteria.obtener(cafeteriaId);
      if (id !== solicitud.current) return;
      setRegistro(data); setForm(formulario(data));
    } catch (err) { if (id === solicitud.current) { setRegistro(null); setError(err.message); } }
    finally { if (id === solicitud.current) setLoading(false); }
  }, [cafeteriaId]);
  useEffect(() => { setRegistro(null); setForm(null); cargar(); return () => { solicitud.current++; }; }, [cargar]);
  useEffect(() => setImagenFallida(false), [form?.imagen_url]);
  const dirty = Boolean(registro && JSON.stringify(form) !== JSON.stringify(formulario(registro)));
  const cambiar = (campo) => (event) => { setSuccess(''); setForm(prev => ({ ...prev, [campo]: event.target.value })); };
  const guardar = async (event) => {
    event.preventDefault();
    if (guardando.current || !dirty) return;
    guardando.current = true; setSaving(true); setError(''); setSuccess('');
    const id = solicitud.current;
    try {
      const data = await configuracionCafeteria.guardar(cafeteriaId, form, registro.actualizado_en);
      if (id !== solicitud.current) return;
      setRegistro(data); setForm(formulario(data)); setSuccess('Los cambios se guardaron en tu cafetería.');
    } catch (err) { if (id === solicitud.current) setError(err.message); }
    finally { guardando.current = false; setSaving(false); }
  };
  return <Box sx={{ maxWidth: 1200, mx: 'auto', pb: 4 }}>
    {error && <Alert severity="error" sx={{ mb: 2 }} action={!registro && <Button onClick={cargar} disabled={loading} color="inherit">Reintentar</Button>}>{error}</Alert>}
    {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
    {loading ? <Stack spacing={2}><Skeleton variant="rounded" height={150} /><Skeleton variant="rounded" height={300} /></Stack> : registro && form && (
      <Box component="form" onSubmit={guardar}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.7fr) minmax(280px, 1fr)' }, gap: 3 }}>
          <Stack spacing={3}>
            <Paper elevation={0} sx={panel}><Typography variant="h6" fontWeight={800}>Información general</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Así reconocerán los estudiantes tu cafetería.</Typography>
              <Stack spacing={2.5}>
                <TextField label="Nombre de la cafetería" required value={form.nombre} onChange={cambiar('nombre')} disabled={saving} inputProps={{ maxLength: 120 }} fullWidth />
                <TextField label="Descripción" value={form.descripcion} onChange={cambiar('descripcion')} disabled={saving} multiline minRows={3} inputProps={{ maxLength: 2000 }} fullWidth />
                <TextField label="Teléfono de contacto" value={form.telefono} onChange={cambiar('telefono')} disabled={saving} type="tel" fullWidth />
                <TextField label="URL de la imagen" value={form.imagen_url} onChange={cambiar('imagen_url')} disabled={saving} type="url" helperText="Usa una dirección pública de imagen." fullWidth />
              </Stack>
            </Paper>
            <Paper elevation={0} sx={panel}><Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}><ScheduleOutlinedIcon /><Typography variant="h6" fontWeight={800}>Horario de atención</Typography></Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField label="Apertura" type="time" value={form.hora_apertura} onChange={cambiar('hora_apertura')} disabled={saving} InputLabelProps={{ shrink: true }} fullWidth />
                <TextField label="Cierre" type="time" value={form.hora_cierre} onChange={cambiar('hora_cierre')} disabled={saving} InputLabelProps={{ shrink: true }} fullWidth />
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>Puedes dejar ambas horas vacías si aún no defines un horario. El cierre puede ser al día siguiente.</Typography>
            </Paper>
          </Stack>
          <Stack spacing={3}>
            <Paper elevation={0} sx={{ ...panel, p: 0, overflow: 'hidden' }}>
              {form.imagen_url && !imagenFallida ? <Box component="img" src={form.imagen_url} alt="Imagen de tu cafetería" onError={() => setImagenFallida(true)} sx={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} /> : <Box sx={{ height: 160, display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,#F2E7DA,#E4D1BE)' }}><StorefrontOutlinedIcon sx={{ fontSize: 64, color: '#8F6A4E' }} /></Box>}
              <Box sx={{ p: 3 }}><Typography variant="overline" color="text.secondary">VISTA PREVIA</Typography><Typography variant="h5" fontWeight={800}>{form.nombre || 'Tu cafetería'}</Typography>
                <Typography color="text.secondary" variant="body2" sx={{ my: 1.5, overflowWrap: 'anywhere' }}>{form.descripcion || 'Agrega una descripción para presentar tu espacio.'}</Typography>
                <Chip size="small" label={form.activa ? 'Visible en catálogo' : 'Oculta del catálogo'} color={form.activa ? 'success' : 'default'} variant="outlined" />
                {form.hora_apertura && form.hora_cierre && <Typography variant="body2" sx={{ mt: 2 }}>{form.hora_apertura} — {form.hora_cierre}</Typography>}
                {registro.campus_sedes?.direccion && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{registro.campus_sedes.direccion}</Typography>}
              </Box>
            </Paper>
            <Paper elevation={0} sx={panel}><Typography fontWeight={800}>Visibilidad</Typography><FormControlLabel control={<Switch checked={form.activa} disabled={saving} onChange={e => { setSuccess(''); setForm(prev => ({ ...prev, activa: e.target.checked })); }} />} label="Mostrar en el catálogo" />
              <Typography variant="body2" color="text.secondary">Al ocultarla, deja de aparecer en el listado de cafeterías. Los pedidos existentes se conservan.</Typography>
            </Paper>
          </Stack>
        </Box>
        <Divider sx={{ my: 3 }} /><Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
          <Typography variant="body2" color="text.secondary">{dirty ? 'Tienes cambios sin guardar' : 'Toda tu información está guardada'}</Typography>
          <Stack direction="row" spacing={1.5}><Button startIcon={<RefreshIcon />} disabled={saving || !dirty} onClick={() => { setForm(formulario(registro)); setError(''); setSuccess(''); }}>Descartar cambios</Button>
            <Button variant="contained" type="submit" startIcon={<SaveOutlinedIcon />} disabled={saving || !dirty}>{saving ? 'Guardando…' : 'Guardar cambios'}</Button></Stack>
        </Stack>
      </Box>
    )}
  </Box>;
}
