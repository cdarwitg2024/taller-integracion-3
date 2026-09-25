// Mock en memoria del cliente supabase, usado por los tests de pedidos/QR.
// Implementa la API fluida mínima que usan los services bajo test
// (select/insert/update/eq/order/or/single/maybeSingle), con un almacén
// por tabla. Aisla el comportamiento (validación, cálculo, estados,
// un-solo-uso) de la BD real de Supabase.

const store = {};

function tabla(name) {
  if (!store[name]) store[name] = [];
  return store[name];
}

function asignarId(lista, row) {
  const maxId = lista.reduce((m, r) => (Number(r.id) > m ? Number(r.id) : m), 0);
  return { ...row, id: maxId + 1 };
}

function matcherOR(predicate) {
  const clausulas = String(predicate)
    .split(',')
    .map(c => c.split('.eq.'))
    .filter(p => p.length === 2)
    .map(([field, value]) => [field.trim(), value.trim()]);
  return row => clausulas.some(([field, value]) => String(row[field]) === String(value));
}

function crearBuilder(tablaActual) {
  const estado = {
    filtros: [],
    orPredicado: null,
    ultimoInsert: null,
    ultimoUpdate: null,
  };

  const builder = {
    select() { return builder; },
    insert(payload) { estado.ultimoInsert = payload; return builder; },
    update(payload) { estado.ultimoUpdate = payload; return builder; },
    eq(field, value) { estado.filtros.push(row => String(row[field]) === String(value)); return builder; },
    or(predicate) { estado.orPredicado = matcherOR(predicate); return builder; },
    order() { return builder; },
    maybeSingle() { return resolver(false); },
    single() { return resolver(true); },
  };

  function aplicar(esSingle) {
    const lista = tabla(tablaActual);
    let data = null;
    let error = null;

    if (estado.ultimoInsert) {
      const fila = asignarId(lista, {
        ...estado.ultimoInsert,
        creado_en: estado.ultimoInsert.creado_en || new Date().toISOString(),
      });
      lista.push(fila);
      data = fila;
    } else if (estado.ultimoUpdate) {
      const filas = lista.filter(row => estado.filtros.every(f => f(row)));
      if (filas.length > 0) {
        const fila = { ...filas[0], ...estado.ultimoUpdate, actualizado_en: new Date().toISOString() };
        for (let i = 0; i < lista.length; i++) {
          if (estado.filtros.every(f => f(lista[i]))) {
            lista[i] = { ...fila };
          }
        }
        data = fila;
      }
    } else {
      let filas = lista.filter(row => estado.filtros.every(f => f(row)));
      if (estado.orPredicado) {
        filas = filas.filter(estado.orPredicado);
      }
      if (esSingle) {
        if (filas.length > 1) {
          error = { message: 'JSON object requested, multiple rows returned' };
        } else {
          data = filas[0] ?? null;
        }
      } else {
        data = filas;
      }
    }

    return { data, error };
  }

  function resolver(esSingle) {
    return {
      then(fn) {
        if (esSingle) {
          return Promise.resolve(aplicar(true)).then(fn);
        }
        // maybeSingle: primer resultado del arreglo, o null si no hay filas
        const { data, error } = aplicar(false);
        return Promise.resolve({ data: Array.isArray(data) ? data[0] ?? null : data, error }).then(fn);
      },
    };
  }

  // Permite `await supabase.from(t).insert(x)` sin .select()/.single()
  builder.then = (fn) => Promise.resolve(aplicar()).then(fn);

  return builder;
}

module.exports = {
  channel: () => ({ on: () => ({ subscribe: () => {} }), unsubscribe: () => Promise.resolve() }),
  from: (tablaActual) => crearBuilder(tablaActual),
};