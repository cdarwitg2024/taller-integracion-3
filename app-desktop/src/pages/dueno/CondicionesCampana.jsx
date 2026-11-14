/**
 * @file CondicionesCampana.jsx
 * @description Módulo de visualización y confirmación de condiciones de campañas (S3-T4 / V03).
 * Despliega versión de condiciones, tasa de descuento sobre carrito completo, tasa de comisión administrativa y vigencia.
 *
 * Funciones y utilidades principales:
 *  - formatearFecha(iso): Transforma fechas ISO a formato legible local (es-CL) para vigencias y auditoría de confirmación.
 *  - cargar(mostrarEsqueleto): Consulta la campaña de carrito completo activa para la cafetería y sincroniza en tiempo real con Supabase.
 *  - handleConfirmar(): Gestiona la adhesión del dueño implementando:
 *      * Bloqueo síncrono mediante `confirmandoRef` e `isSubmitting` para evitar que un doble clic duplique la aceptación.
 *      * Validación estricta de la respuesta del servidor para garantizar que ningún error se presente falsamente como éxito.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Typography, Paper, Button, Alert, Skeleton, Stack, Chip, Divider, FormControlLabel, Checkbox, CircularProgress } from '@mui/material';

import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import PercentOutlinedIcon from '@mui/icons-material/PercentOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import MonetizationOnOutlinedIcon from '@mui/icons-material/MonetizationOnOutlined';

import { campanasService } from '../../services/campanasService';
import { supabase } from '../../services/supabase';
import { campanaAceptada, claveCondiciones, formatearTasa } from '../../utils/condicionesCampana';

function formatearFecha(iso) {
  if (!iso) return 'No especificada';
  try {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return iso;
    return d.toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function CondicionesCampana({ currentUser, onConfirmada }) {
  const cafeteriaId = String(currentUser?.cafeteria_id ?? currentUser?.cafeteriaId ?? '');
  return <CondicionesDeCafeteria key={`${currentUser?.id}:${cafeteriaId}`} cafeteriaId={cafeteriaId} onConfirmada={onConfirmada} />;
}

function CondicionesDeCafeteria({ cafeteriaId, onConfirmada }) {

  const [campana, setCampana] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [consentimiento, setConsentimiento] = useState(null);
  const clave = claveCondiciones(campana);
  const aceptoTerminos = clave !== null && consentimiento === clave;
  const aceptada = campanaAceptada(campana);

  // Protección síncrona contra doble clic
  const confirmandoRef = useRef(false);
  const solicitudIdRef = useRef(0);
  const activoRef = useRef(false);
  const claveRef = useRef(null);
  const publicarCampana = useCallback(data => {
    claveRef.current = claveCondiciones(data);
    setCampana(data);
  }, []);

  useEffect(() => {
    setConsentimiento(null);
    setNotice('');
  }, [clave]);

  const cargar = useCallback(async (mostrarEsqueleto = false) => {
    if (!activoRef.current) return;
    const reqId = ++solicitudIdRef.current;
    if (mostrarEsqueleto) setLoading(true);
    setError('');

    try {
      if (!cafeteriaId) {
        throw new Error('No tienes una cafetería asociada a tu cuenta.');
      }
      const data = await campanasService.obtenerCampanaVigente(cafeteriaId);
      if (reqId === solicitudIdRef.current) {
        publicarCampana(data);
      }
    } catch (err) {
      if (reqId === solicitudIdRef.current) {
        setError(err.message || 'Error al cargar las condiciones de campaña.');
        publicarCampana(null);
      }
    } finally {
      if (reqId === solicitudIdRef.current) {
        setLoading(false);
      }
    }
  }, [cafeteriaId, publicarCampana]);

  useEffect(() => {
    activoRef.current = true;
    cargar(true);

    const canal = cafeteriaId && supabase?.channel ? supabase
      .channel(`dueno-campanas-${cafeteriaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campanas',
          filter: `cafeteria_id=eq.${cafeteriaId}`,
        },
        () => {
          cargar(false);
        }
      )
      .subscribe() : null;

    return () => {
      activoRef.current = false;
      solicitudIdRef.current++;
      if (canal && typeof supabase.removeChannel === 'function') {
        supabase.removeChannel(canal);
      }
    };
  }, [cafeteriaId, cargar]);

  const handleConfirmar = async () => {
    // 1. Doble clic no duplica aceptación: bloqueo sincrónico
    if (confirmandoRef.current) return;
    if (!campana || !aceptoTerminos || aceptada) return;
    const claveEnviada = clave;
    const sigueVigente = () => activoRef.current && claveRef.current === claveEnviada;

    confirmandoRef.current = true;
    setIsSubmitting(true);
    setError('');
    setNotice('');

    try {
      const res = await campanasService.confirmarCondiciones({
        campanaId: campana.id,
        cafeteriaId,
        version: campana.version_condiciones,
      });
      if (!sigueVigente()) return;
      solicitudIdRef.current++;
      setLoading(false);
      publicarCampana(res);
      setNotice('Condiciones de la campaña aceptadas exitosamente.');
      onConfirmada?.(res);
    } catch (err) {
      // Garantizar que ante cualquier error se notifique el fallo y no el éxito
      if (sigueVigente()) setError(err.message || 'Ocurrió un error al confirmar las condiciones.');
    } finally {
      confirmandoRef.current = false;
      if (activoRef.current) setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <Skeleton variant="rounded" height={140} sx={{ mb: 3, borderRadius: 3 }} />
        <Skeleton variant="rounded" height={300} sx={{ borderRadius: 3 }} />
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 4, maxWidth: 1100, mx: 'auto' }}>
      {/* Alertas */}
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 3, borderRadius: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => cargar(true)} disabled={loading}>
              Reintentar
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {notice && (
        <Alert
          severity="success"
          sx={{ mb: 3, borderRadius: 2 }}
          onClose={() => setNotice('')}
        >
          {notice}
        </Alert>
      )}

      {!campana ? (
        <Paper
          elevation={0}
          sx={{
            p: 6,
            textAlign: 'center',
            borderRadius: 4,
            border: '1px dashed #DCCBBA',
            bgcolor: '#FAFAF8',
          }}
        >
          <GavelOutlinedIcon sx={{ fontSize: 56, color: '#AB8563', mb: 2 }} />
          <Typography variant="h6" fontWeight={800} gutterBottom>
            No hay campañas de carrito completo activas para tu cafetería
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 500, mx: 'auto', mb: 3 }}>
            Cuando el equipo de administración configure una nueva campaña de carrito completo con
            descuentos y comisiones, podrás revisar los términos y confirmar su adhesión aquí.
          </Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => cargar(true)}
            disabled={loading}
          >
            Comprobar de nuevo
          </Button>
        </Paper>
      ) : (
        <Stack spacing={3}>
          {/* Ficha resumen con Versión / Tasa / Vigencia */}
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 4,
              border: '1px solid #E9E1D9',
              bgcolor: '#FFFFFF',
            }}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              spacing={2}
              sx={{ mb: 2 }}
            >
              <Box>
                <Typography variant="caption" sx={{ color: '#7A482D', fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' }}>
                  Campaña de Carrito Completo
                </Typography>
                <Typography variant="h5" fontWeight={800} sx={{ color: '#2C1810', mt: 0.5 }}>
                  {campana.nombre}
                </Typography>
                {campana.descripcion && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {campana.descripcion}
                  </Typography>
                )}
              </Box>

              <Chip
                label={aceptada ? 'Condiciones Aceptadas' : 'Pendiente de Aceptación'}
                color={aceptada ? 'success' : 'warning'}
                icon={aceptada ? <CheckCircleOutlinedIcon /> : undefined}
                sx={{ fontWeight: 700, px: 1 }}
              />
            </Stack>

            <Divider sx={{ my: 2 }} />

            {/* Cuadrícula de Parámetros Clave: Versión, Tasas, Vigencia */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
                gap: 2,
              }}
            >
              {/* 1. Versión */}
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 3,
                  bgcolor: '#F9F6F0',
                  border: '1px solid #EDE6DD',
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <GavelOutlinedIcon sx={{ color: '#7A482D', fontSize: 20 }} />
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>
                    Versión de Condiciones
                  </Typography>
                </Stack>
                <Typography variant="h6" fontWeight={800} color="#2C1810">
                  {campana.version_condiciones || 'v1.0'}
                </Typography>
              </Paper>

              {/* 2. Tasa de Descuento */}
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 3,
                  bgcolor: '#F0F7F2',
                  border: '1px solid #DCEDE2',
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <PercentOutlinedIcon sx={{ color: '#267248', fontSize: 20 }} />
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>
                    Tasa de Descuento
                  </Typography>
                </Stack>
                <Typography variant="h6" fontWeight={800} color="#267248">
                  {formatearTasa(campana.tasa_descuento)}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Aplicable al carrito completo
                </Typography>
              </Paper>

              {/* 3. Tasa de Comisión */}
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 3,
                  bgcolor: '#FFF8F0',
                  border: '1px solid #FCE8D3',
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <MonetizationOnOutlinedIcon sx={{ color: '#A0522D', fontSize: 20 }} />
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>
                    Tasa de Comisión
                  </Typography>
                </Stack>
                <Typography variant="h6" fontWeight={800} color="#A0522D">
                  {formatearTasa(campana.tasa_comision)}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Comisión administrativa
                </Typography>
              </Paper>

              {/* 4. Vigencia */}
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 3,
                  bgcolor: '#F9F6F0',
                  border: '1px solid #EDE6DD',
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <CalendarMonthOutlinedIcon sx={{ color: '#7A482D', fontSize: 20 }} />
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>
                    Vigencia
                  </Typography>
                </Stack>
                <Typography variant="body2" fontWeight={700} color="#2C1810">
                  Desde: {formatearFecha(campana.vigencia_desde)}
                </Typography>
                <Typography variant="body2" fontWeight={700} color="#2C1810">
                  Hasta: {formatearFecha(campana.vigencia_hasta)}
                </Typography>
              </Paper>
            </Box>
          </Paper>

          {/* Sección de Aceptación o Estado de Confirmación */}
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 4,
              border: '1px solid #E9E1D9',
              bgcolor: '#FFFFFF',
            }}
          >
            <Typography variant="h6" fontWeight={800} sx={{ mb: 1, color: '#2C1810' }}>
              Responsabilidad y Confirmación del Dueño
            </Typography>

            {aceptada ? (
              <Box
                sx={{
                  p: 2.5,
                  borderRadius: 3,
                  bgcolor: '#EBF6EF',
                  border: '1px solid #CDE8D6',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 2,
                }}
              >
                <CheckCircleOutlinedIcon sx={{ color: '#267248', fontSize: 32, mt: 0.5 }} />
                <Box>
                  <Typography variant="subtitle1" fontWeight={800} color="#267248">
                    Condiciones confirmadas y aceptadas por el dueño
                  </Typography>
                  <Typography variant="body2" color="#267248" sx={{ mt: 0.5 }}>
                    La cafetería se encuentra formalmente adherida a la campaña versión{' '}
                    <strong>{campana.version_confirmada || campana.version_condiciones || 'v1.0'}</strong>.
                  </Typography>
                  {campana.fecha_confirmacion && (
                    <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#407B57' }}>
                      Fecha de confirmación: {formatearFecha(campana.fecha_confirmacion)}
                    </Typography>
                  )}
                </Box>
              </Box>
            ) : (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Al confirmar, manifiestas la voluntad de aplicar el porcentaje de descuento indicado sobre
                  los carritos completos y reconoces la tasa de comisión administrativa durante toda la vigencia
                  señalada.
                </Typography>

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={aceptoTerminos}
                      onChange={(e) => setConsentimiento(e.target.checked ? clave : null)}
                      disabled={isSubmitting}
                      color="primary"
                    />
                  }
                  label={
                    <Typography variant="body2" fontWeight={600}>
                      Confirmo la versión {campana.version_condiciones || 'v1.0'} y acepto las tasas y la vigencia establecidas.
                    </Typography>
                  }
                  sx={{ mb: 2 }}
                />

                <Stack direction="row" spacing={2} alignItems="center">
                  <Button
                    variant="contained"
                    startIcon={
                      isSubmitting ? (
                        <CircularProgress size={18} color="inherit" />
                      ) : (
                        <AssignmentTurnedInOutlinedIcon />
                      )
                    }
                    onClick={handleConfirmar}
                    disabled={!aceptoTerminos || isSubmitting}
                    sx={{
                      bgcolor: '#7A482D',
                      '&:hover': { bgcolor: '#5E3722' },
                      px: 3,
                      py: 1,
                      fontWeight: 700,
                    }}
                  >
                    {isSubmitting ? 'Confirmando...' : 'Confirmar Condiciones'}
                  </Button>

                  <Button
                    variant="text"
                    startIcon={<RefreshIcon />}
                    onClick={() => cargar(true)}
                    disabled={isSubmitting || loading}
                  >
                    Actualizar
                  </Button>
                </Stack>
              </Box>
            )}
          </Paper>
        </Stack>
      )}
    </Box>
  );
}
