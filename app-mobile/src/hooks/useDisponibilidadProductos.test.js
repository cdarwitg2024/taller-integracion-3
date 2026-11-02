import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

// Supabase falso: guarda los canales creados para poder dispararles eventos.
jest.mock('../lib/supabase', () => {
  const canales = [];
  return {
    __canales: canales,
    supabase: {
      channel: (nombre) => {
        const canal = {
          nombre,
          handlers: [],
          on(evento, config, cb) {
            this.handlers.push({ evento, config, tipo: config?.event, cb });
            return this;
          },
          subscribe(cb) {
            this.estado = cb;
            canales.push(this);
            return this;
          },
        };
        return canal;
      },
      removeChannel: jest.fn(),
    },
  };
});

const { __canales: mockCanales, supabase } = require('../lib/supabase');
const { useDisponibilidadProductos } = require('./useDisponibilidadProductos');

const Sonda = ({ cafeteriaId, onCambios }) => {
  const { cambios } = useDisponibilidadProductos(cafeteriaId);
  onCambios(cambios);
  return null;
};

const montar = (cafeteriaId = 7) => {
  const estados = [];
  let tree;
  act(() => {
    tree = TestRenderer.create(
      <Sonda cafeteriaId={cafeteriaId} onCambios={(c) => estados.push(c)} />
    );
  });
  return { tree, ultimo: () => estados[estados.length - 1] };
};

const emitir = (canal, evento, payload) => {
  const handler = canal.handlers.find((h) => h.tipo === evento);
  act(() => handler.cb(payload));
};

describe('useDisponibilidadProductos', () => {
  beforeEach(() => {
    mockCanales.length = 0;
  });

  test('se suscribe a UPDATE, INSERT y DELETE de la cafetería', () => {
    montar(7);
    expect(mockCanales).toHaveLength(1);
    expect(mockCanales[0].nombre).toBe('productos-cafeteria-7');
    expect(mockCanales[0].handlers.map((h) => h.tipo)).toEqual([
      'UPDATE',
      'INSERT',
      'DELETE',
    ]);
  });

  test('un UPDATE normal parchea el producto con stock y estado', () => {
    const { ultimo } = montar();
    emitir(mockCanales[0], 'UPDATE', {
      new: { id: 1, stock: 0, activo: true, eliminado_en: null },
      old: { id: 1 },
    });
    expect(ultimo()[0]).toMatchObject({ id: 1, stock: 0, activo: true });
  });

  test('sin payload.old se asume posible reactivación y se recarga', () => {
    // Fallback de S2-T19: con REPLICA IDENTITY por defecto el UPDATE puede no
    // traer `old`; sin este fallback el producto reactivado nunca reaparecía.
    const { ultimo } = montar();
    emitir(mockCanales[0], 'UPDATE', {
      new: { id: 1, stock: 5, activo: true, eliminado_en: null },
    });
    expect(ultimo()[0]).toMatchObject({ recargar: true });
  });

  test('un INSERT pide recargar la lista', () => {
    const { ultimo } = montar();
    emitir(mockCanales[0], 'INSERT', { new: { id: 9 } });
    expect(ultimo()[0].recargar).toBe(true);
  });

  test('un DELETE informa el id eliminado', () => {
    const { ultimo } = montar();
    emitir(mockCanales[0], 'DELETE', { old: { id: 4 } });
    expect(ultimo()[0].eliminadoId).toBe(4);
  });

  test('al desmontar libera el canal', () => {
    const { tree } = montar();
    act(() => tree.unmount());
    expect(supabase.removeChannel).toHaveBeenCalledWith(mockCanales[0]);
  });
});
