/**
 * @file Promociones.jsx
 * @description Vista del panel de dueño para la gestión integral de descuentos y convenios comerciales.
 * Centraliza en dos pestañas:
 *  1. Promociones por Producto: Creación, filtrado y mantención de ofertas a nivel de catálogo.
 *  2. Condiciones de Campaña: Revisión de versión, tasas de descuento y comisión, y adhesión a campañas de carrito completo.
 *
 * Funciones y utilidades principales:
 *  - estado(p, now): Calcula dinámicamente el estado comercial (Vigente, Programada, Pausada o Finalizada).
 *  - cargar(inicial): Obtiene las promociones vigentes y productos activos de la cafetería autorizada.
 *  - guardar(e): Inserta o actualiza promociones de forma segura, verificando el ámbito de la sesión del dueño.
 *  - borrar(): Retira la promoción manteniendo intactos los importes de los pedidos históricos.
 *  - useEffect (campanaPendiente): Detecta campañas de carrito completo pendientes de firma para alertar con un badge en la pestaña.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Badge, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, InputAdornment, MenuItem, Paper, Skeleton, Stack, Switch, Tab, Tabs, TextField, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import { promocionesCafeteria } from '../../services/administracionCafeteria';
import { campanasService } from '../../services/campanasService';
import { productos as productosService } from '../../services/productos';
import { supabase } from '../../services/supabase';
import CondicionesCampana from './CondicionesCampana';
import { campanaAceptada } from '../../utils/condicionesCampana';

const nuevo = () => ({
  nombre: '',
  descripcion: '',
  descuento_porcentaje: '',
  producto_id: '',
  inicio_en: '',
  fin_en: '',
  activo: true,
});

const fechaLocal = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const fecha = (iso) => (iso ? new Date(iso).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' }) : null);

const estado = (p, now) => {
  if (!p.activo) return 'Pausada';
  if (p.fin_en && new Date(p.fin_en).getTime() <= now) return 'Finalizada';
  if (p.inicio_en && new Date(p.inicio_en).getTime() > now) return 'Programada';
  return 'Vigente';
};

const tonos = {
  Vigente: { bg: '#E6F3EB', fg: '#267248' },
  Programada: { bg: '#FFF0D8', fg: '#97631D' },
  Pausada: { bg: '#EFEBE7', fg: '#77685B' },
  Finalizada: { bg: '#F5E7E3', fg: '#A45A45' },
};

export default function Promociones({ currentUser }) {
  const cafeteriaId = String(currentUser?.cafeteria_id ?? currentUser?.cafeteriaId ?? '');

  const [tabActiva, setTabActiva] = useState(0);
  const [resumenCampana, setResumenCampana] = useState(null);
  const campanaPendiente = resumenCampana?.cafeteriaId === cafeteriaId && resumenCampana.pendiente;
  const errorCampana = resumenCampana?.cafeteriaId === cafeteriaId && resumenCampana.error;
  const [promociones, setPromociones] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState(null);
  const [eliminar, setEliminar] = useState(null);
  const [busy, setBusy] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('Todas');
  const [now, setNow] = useState(Date.now());

  const solicitud = useRef(0);
  const cafeteriaActual = useRef(cafeteriaId);
  cafeteriaActual.current = cafeteriaId;
  const operando = useRef(false);

  const solicitudCampana = useRef(0);
  const cargarCampana = useCallback(async () => {
    const id = ++solicitudCampana.current;
    if (!cafeteriaId) return;
    try {
      const campana = await campanasService.obtenerCampanaVigente(cafeteriaId);
      if (id === solicitudCampana.current) {
        setResumenCampana({ cafeteriaId, pendiente: Boolean(campana && !campanaAceptada(campana)), error: '' });
      }
    } catch (err) {
      if (id === solicitudCampana.current) setResumenCampana({ cafeteriaId, pendiente: false, error: err.message });
    }
  }, [cafeteriaId]);

  useEffect(() => {
    cargarCampana();
    const canal = cafeteriaId ? supabase.channel(`promociones-campanas-${cafeteriaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campanas', filter: `cafeteria_id=eq.${cafeteriaId}` }, cargarCampana)
      .subscribe() : null;
    return () => {
      solicitudCampana.current++;
      if (canal) supabase.removeChannel(canal);
    };
  }, [cafeteriaId, cargarCampana]);

  const cargar = useCallback(async (inicial = false) => {
    const id = ++solicitud.current;
    if (inicial) setLoading(true);

    try {
      if (!cafeteriaId) throw new Error('No tienes una cafetería asociada.');
      const [rows, prods] = await Promise.all([
        promocionesCafeteria.listar(cafeteriaId),
        productosService.getAll(cafeteriaId),
      ]);
      if (id !== solicitud.current) return;
      setPromociones(rows);
      setProductos(prods);
      setError('');
    } catch (err) {
      if (id === solicitud.current) setError(err.message);
    } finally {
      if (id === solicitud.current) setLoading(false);
    }
  }, [cafeteriaId]);

  useEffect(() => {
    setPromociones([]);
    setProductos([]);
    setForm(null);
    setEliminar(null);
    setNotice('');
    cargar(true);

    if (!cafeteriaId) return () => { solicitud.current++; };

    const canal = supabase
      .channel('dueno-promociones-' + cafeteriaId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'promociones', filter: 'cafeteria_id=eq.' + cafeteriaId },
        () => cargar()
      )
      .subscribe();

    const interval = setInterval(() => setNow(Date.now()), 30000);

    return () => {
      solicitud.current++;
      clearInterval(interval);
      supabase.removeChannel(canal);
    };
  }, [cafeteriaId, cargar]);

  const stats = useMemo(() => ({
    total: promociones.length,
    vigentes: promociones.filter((p) => estado(p, now) === 'Vigente').length,
    programadas: promociones.filter((p) => estado(p, now) === 'Programada').length,
  }), [promociones, now]);

  const visibles = promociones.filter((p) => {
    const cumpleFiltro = filtro === 'Todas' || estado(p, now) === filtro;
    const texto = (p.nombre + ' ' + (p.descripcion || '')).toLocaleLowerCase();
    const cumpleBusqueda = texto.includes(busqueda.trim().toLocaleLowerCase());
    return cumpleFiltro && cumpleBusqueda;
  });

  const cambiar = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const guardar = async (e) => {
    e.preventDefault();
    if (operando.current) return;

    operando.current = true;
    setBusy(true);
    setFormError('');
    const ambito = cafeteriaId;

    try {
      await promocionesCafeteria.guardar(cafeteriaId, form);
      if (ambito !== cafeteriaActual.current) return;
      setForm(null);
      setNotice('Promoción guardada. Se aplicará en las compras durante su vigencia.');
      await cargar();
    } catch (err) {
      if (ambito === cafeteriaActual.current) setFormError(err.message);
    } finally {
      operando.current = false;
      setBusy(false);
    }
  };

  const borrar = async () => {
    if (operando.current) return;

    operando.current = true;
    setBusy(true);
    setFormError('');
    const ambito = cafeteriaId;

    try {
      await promocionesCafeteria.eliminar(cafeteriaId, eliminar);
      if (ambito !== cafeteriaActual.current) return;
      setEliminar(null);
      setNotice('La promoción fue eliminada. Los pedidos anteriores conservan su precio.');
      await cargar();
    } catch (err) {
      if (ambito === cafeteriaActual.current) setFormError(err.message);
    } finally {
      operando.current = false;
      setBusy(false);
    }
  };

  return (
    <Box sx={{ pb: 4 }}>
      {errorCampana && <Alert severity="warning" sx={{ mb: 2 }} action={<Button onClick={cargarCampana}>Reintentar</Button>}>
        No se pudo comprobar si hay campañas pendientes: {errorCampana}
      </Alert>}
      {/* Pestañas de Navegación dentro de Promociones */}
      <Box sx={{ borderBottom: '1px solid #E9E1D9', mb: 3 }}>
        <Tabs
          value={tabActiva}
          onChange={(_, val) => setTabActiva(val)}
          sx={{
            '& .MuiTab-root': {
              fontWeight: 700,
              fontSize: '0.95rem',
              textTransform: 'none',
              color: '#77685B',
              minHeight: 48,
              '&.Mui-selected': { color: '#7A482D' },
            },
            '& .MuiTabs-indicator': {
              bgcolor: '#7A482D',
              height: 3,
              borderRadius: '3px 3px 0 0',
            },
          }}
        >
          <Tab
            icon={<LocalOfferOutlinedIcon fontSize="small" />}
            iconPosition="start"
            label="Promociones por Producto"
          />
          <Tab
            icon={<AssignmentTurnedInOutlinedIcon fontSize="small" />}
            iconPosition="start"
            label={
              <Badge
                color="warning"
                variant="dot"
                invisible={!campanaPendiente}
                sx={{ '& .MuiBadge-badge': { right: -6, top: 2 } }}
              >
                Condiciones de Campaña (Carrito Completo)
              </Badge>
            }
          />
        </Tabs>
      </Box>

      {/* Pestaña 1: Promociones por Producto */}
      {tabActiva === 0 && (
        <>
          <Stack direction="row" justifyContent="flex-end" sx={{ mb: 3 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setFormError('');
                setForm(nuevo());
              }}
              disabled={loading || Boolean(error)}
              sx={{ bgcolor: '#7A482D', '&:hover': { bgcolor: '#5E3722' } }}
            >
              Nueva promoción
            </Button>
          </Stack>

          {error && (
            <Alert
              severity="warning"
              sx={{ mb: 2 }}
              action={
                <Button color="inherit" onClick={() => cargar(true)} disabled={loading}>
                  Reintentar
                </Button>
              }
            >
              {error}
            </Alert>
          )}

          {notice && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>
              {notice}
            </Alert>
          )}

          {/* Tarjetas resumen */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 2, mb: 3 }}>
            {[
              [stats.total, 'Promociones'],
              [stats.vigentes, 'Vigentes'],
              [stats.programadas, 'Programadas'],
            ].map(([count, label]) => (
              <Paper
                key={label}
                elevation={0}
                sx={{ p: { xs: 1.5, md: 2.5 }, borderRadius: 3, border: '1px solid #E9E1D9' }}
              >
                <Typography variant="h4" fontWeight={800}>
                  {loading || error ? '—' : count}
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  {label}
                </Typography>
              </Paper>
            ))}
          </Box>

          {/* Filtros y búsqueda */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
            <TextField
              size="small"
              label="Buscar promoción"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              sx={{ flex: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              select
              size="small"
              label="Estado"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              sx={{ minWidth: 170 }}
            >
              {['Todas', 'Vigente', 'Programada', 'Pausada', 'Finalizada'].map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </TextField>
            <Button onClick={() => cargar(true)} startIcon={<RefreshIcon />} disabled={loading || busy}>
              Actualizar
            </Button>
          </Stack>

          {/* Lista de Promociones */}
          {loading ? (
            <Skeleton variant="rounded" height={250} />
          ) : !error && !visibles.length ? (
            <Paper elevation={0} sx={{ border: '1px dashed #DCCBBA', borderRadius: 4, p: 6, textAlign: 'center' }}>
              <LocalOfferOutlinedIcon sx={{ fontSize: 48, color: '#AB8563', mb: 1 }} />
              <Typography variant="h6" fontWeight={800}>
                {promociones.length ? 'No hay coincidencias' : 'Tu próxima promoción empieza aquí'}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                {promociones.length
                  ? 'Prueba con otro nombre o estado.'
                  : 'Crea tu primera oferta. Los descuentos se aplican automáticamente al pagar.'}
              </Typography>
            </Paper>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
                gap: 2.5,
              }}
            >
              {visibles.map((p) => {
                const state = estado(p, now);
                const color = tonos[state];
                const producto = productos.find((item) => Number(item.id) === Number(p.producto_id));

                return (
                  <Paper
                    key={p.id}
                    elevation={0}
                    sx={{
                      borderRadius: 4,
                      border: '1px solid #E9E1D9',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <Box
                      sx={{
                        p: 2.5,
                        background: '#F6EDE3',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Typography variant="h3" fontWeight={900} sx={{ color: '#7A482D', letterSpacing: -2 }}>
                        −{p.descuento_porcentaje}%
                      </Typography>
                      <Chip size="small" label={state} sx={{ bgcolor: color.bg, color: color.fg, fontWeight: 700 }} />
                    </Box>

                    <Box sx={{ p: 2.5, flex: 1 }}>
                      <Typography variant="h6" fontWeight={800}>
                        {p.nombre}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ my: 1, overflowWrap: 'anywhere' }}>
                        {p.descripcion || 'Sin descripción adicional'}
                      </Typography>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={p.producto_id ? producto?.nombre || 'Producto #' + p.producto_id : 'Toda la cafetería'}
                      />
                      <Typography variant="caption" sx={{ display: 'block', mt: 2 }} color="text.secondary">
                        {p.inicio_en ? 'Desde ' + fecha(p.inicio_en) : 'Sin fecha de inicio'}
                        <br />
                        {p.fin_en ? 'Hasta ' + fecha(p.fin_en) : 'Sin fecha de término'}
                      </Typography>
                    </Box>

                    <Stack direction="row" justifyContent="flex-end" sx={{ p: 1.5, borderTop: '1px solid #EFE7DF' }}>
                      <Button
                        size="small"
                        startIcon={<EditOutlinedIcon />}
                        disabled={busy}
                        onClick={() => {
                          setFormError('');
                          setForm({
                            ...p,
                            producto_id: p.producto_id || '',
                            inicio_en: fechaLocal(p.inicio_en),
                            fin_en: fechaLocal(p.fin_en),
                          });
                        }}
                      >
                        Editar
                      </Button>
                      <Tooltip title="Eliminar promoción">
                        <IconButton
                          aria-label={'Eliminar ' + p.nombre}
                          color="error"
                          disabled={busy}
                          onClick={() => {
                            setFormError('');
                            setEliminar(p);
                          }}
                        >
                          <DeleteOutlineIcon />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Paper>
                );
              })}
            </Box>
          )}

          <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
            Si coinciden varias promociones, se aplica el mayor descuento por producto. Los descuentos no se acumulan.
          </Typography>

          {/* Diálogo Crear/Editar Promoción */}
          <Dialog
            open={Boolean(form)}
            onClose={() => {
              if (!busy) setForm(null);
            }}
            maxWidth="sm"
            fullWidth
          >
            <Box component="form" onSubmit={guardar}>
              <DialogTitle fontWeight={800}>
                {form?.id ? 'Editar promoción' : 'Una nueva razón para volver'}
              </DialogTitle>
              <DialogContent dividers>
                {form && (
                  <Stack spacing={2.5} sx={{ pt: 1 }}>
                    {formError && <Alert severity="error">{formError}</Alert>}
                    <TextField
                      label="Nombre de la promoción"
                      value={form.nombre}
                      onChange={cambiar('nombre')}
                      required
                      disabled={busy}
                      inputProps={{ maxLength: 120 }}
                    />
                    <TextField
                      label="Descripción"
                      value={form.descripcion || ''}
                      onChange={cambiar('descripcion')}
                      multiline
                      minRows={2}
                      disabled={busy}
                      inputProps={{ maxLength: 2000 }}
                    />
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                      <TextField
                        label="Descuento"
                        type="number"
                        required
                        value={form.descuento_porcentaje}
                        onChange={cambiar('descuento_porcentaje')}
                        disabled={busy}
                        inputProps={{ min: 1, max: 99, step: 0.01 }}
                        InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                        fullWidth
                      />
                      <TextField
                        select
                        label="Aplicar a"
                        value={form.producto_id || ''}
                        onChange={cambiar('producto_id')}
                        disabled={busy}
                        fullWidth
                      >
                        <MenuItem value="">Toda la cafetería</MenuItem>
                        {productos.map((p) => (
                          <MenuItem key={p.id} value={p.id}>
                            {p.nombre}
                            {!p.activo ? ' (inactivo)' : ''}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Stack>
                    <TextField
                      label="Inicio (opcional)"
                      type="datetime-local"
                      value={form.inicio_en}
                      onChange={cambiar('inicio_en')}
                      disabled={busy}
                      InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                      label="Fin (opcional)"
                      type="datetime-local"
                      value={form.fin_en}
                      onChange={cambiar('fin_en')}
                      disabled={busy}
                      InputLabelProps={{ shrink: true }}
                    />
                    <FormControlLabel
                      label="Promoción habilitada"
                      control={
                        <Switch
                          checked={form.activo}
                          disabled={busy}
                          onChange={(e) => setForm((prev) => ({ ...prev, activo: e.target.checked }))}
                        />
                      }
                    />
                  </Stack>
                )}
              </DialogContent>
              <DialogActions sx={{ p: 2.5 }}>
                <Button disabled={busy} onClick={() => setForm(null)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="contained" disabled={busy}>
                  {busy ? 'Guardando…' : 'Guardar promoción'}
                </Button>
              </DialogActions>
            </Box>
          </Dialog>

          {/* Diálogo Eliminar Promoción */}
          <Dialog
            open={Boolean(eliminar)}
            onClose={() => {
              if (!busy) setEliminar(null);
            }}
            maxWidth="xs"
            fullWidth
          >
            <DialogTitle fontWeight={800}>Eliminar promoción</DialogTitle>
            <DialogContent>
              {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
              <Typography>
                ¿Eliminar «{eliminar?.nombre}»? Dejará de aplicarse en nuevas compras. Los pedidos anteriores conservan su precio.
              </Typography>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button disabled={busy} onClick={() => setEliminar(null)}>
                Conservar
              </Button>
              <Button color="error" variant="contained" disabled={busy} onClick={borrar}>
                {busy ? 'Eliminando…' : 'Eliminar'}
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}

      {/* Pestaña 2: Condiciones de Campaña */}
      {tabActiva === 1 && (
        <CondicionesCampana currentUser={currentUser} onConfirmada={cargarCampana} />
      )}
    </Box>
  );
}
