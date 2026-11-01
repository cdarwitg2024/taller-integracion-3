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

const { __canales: mockCanales } = require('../lib/supabase');
const { supabase } = require('../lib/supabase');
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

  test('un UPDATE de stock y precio llega al menú', () => {
    const { ultimo } = montar();
    emitir(mockCanales[0], 'UPDATE', {
      new: { id: 1, stock: 0, precio: 1900, activo: true, eliminado_en: null },
      old: { id: 1 },
    });
    expect(ultimo()[0]).toMatchObject({
      id: 1,
      stock: 0,
      precio: 1900,
      activo: true,
    });
  });

  test('un UPDATE que desactiva viaja con activo: false', () => {
    const { ultimo } = montar();
    emitir(mockCanales[0], 'UPDATE', {
      new: { id: 1, stock: 5, precio: 1500, activo: false },
      old: { id: 1 },
    });
    expect(ultimo()[0].activo).toBe(false);
  });

  test('un INSERT pide recargar la lista', () => {
    const { ultimo } = montar();
    emitir(mockCanales[0], 'INSERT', { new: { id: 9 } });
    expect(ultimo()[0].recargar).toBe(true);
  });

  test('al desmontar libera el canal', () => {
    const { tree } = montar();
    act(() => tree.unmount());
    expect(supabase.removeChannel).toHaveBeenCalledWith(mockCanales[0]);
  });
});
