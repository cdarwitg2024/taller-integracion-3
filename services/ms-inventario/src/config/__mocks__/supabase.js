// Mock en memoria del cliente supabase, usado por los tests de inventario-service.
// Implementa la API fluida mínima (select/insert/update/eq/in/is/gte/or/order/
// single/maybeSingle) con un almacén por tabla.
//
// `raw` está porque stock.service.js descuenta con una operación aritmética en
// la base (`stock - ?`): el mock la evalúa contra la fila que va aactualizar,
// no devuelve un valor fijo. Sin eso, el descuento nunca bajaría el stock y los
// tests de movimientos pasarían por encima del bug que cubren.

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

const MARCA_RAW = Symbol('raw');

// Expresión aritmética del cliente real: `raw('stock - ?', [3])` descuenta 3 en
// SQL. Acá se parsea a {campo, op, operando} y se resuelve contra la fila.
function crearExpresionRaw(expresion, binds) {
  const partes = String(expresion).trim().split(/\s+/);
  if (partes.length !== 3 || partes[2] !== '?') {
    throw new Error(`Mock: expresion raw no soportada: "${expresion}"`);
  }
  const [campo, op, , ...resto] = partes;
  if (!['+', '-', '*', '/'].includes(op)) {
    throw new Error(`Mock: operador raw no soportado: "${op}"`);
  }
  return { [MARCA_RAW]: true, campo, op, operando: binds && binds[0], resto };
}

function esRaw(valor) {
  return Boolean(valor && typeof valor === 'object' && valor[MARCA_RAW]);
}

function aplicarRaw(expr, fila) {
  if (!esRaw(expr)) return expr;

  const { campo, op, operando, resto } = expr;
  const actual = Number(fila[campo]) || 0;
  const valor = Number(operando) || 0;
  const terminos = [resto[0]].map(v => (Number.isFinite(Number(v)) ? Number(v) : 0));

  let resultado;
  switch (op) {
    case '+': resultado = actual + valor; break;
    case '-': resultado = actual - valor; break;
    case '*': resultado = actual * valor; break;
    case '/': resultado = valor === 0 ? 0 : actual / valor; break;
    default: resultado = actual;
  }

  return terminos.reduce((acc, t) => acc + t, resultado);
}

// Un `update` puede traer expresiones raw mezcladas con valores literales: cada
// una se resuelve contra la fila que se esta actualizando.
function materializar(payload, fila) {
  const salida = {};
  for (const [campo, valor] of Object.entries(payload)) {
    salida[campo] = aplicarRaw(valor, fila);
  }
  return salida;
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
    // `is('eliminado_en', null)`: el borrado lógico se guarda como NULL, así que
    // una fila sin la columna cuenta como NULL.
    is(field, value) {
      estado.filtros.push(row => (value === null || value === undefined
        ? row[field] === null || row[field] === undefined
        : String(row[field]) === String(value)));
      return builder;
    },
    // `gte('stock', n)`: el descuento se hace con este filtro para que el UPDATE
    // sea atómico. Si el mock no lo respetara, descontar de más no fallaría nunca.
    gte(field, value) {
      estado.filtros.push(row => (Number(row[field]) || 0) >= (Number(value) || 0));
      return builder;
    },
    in(field, values) {
      const lista = Array.isArray(values) ? values : [values];
      estado.filtros.push(row => lista.some(v => String(row[field]) === String(v)));
      return builder;
    },
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
      const lote = Array.isArray(estado.ultimoInsert) ? estado.ultimoInsert : [estado.ultimoInsert];
      const filas = lote.map(p => asignarId(lista, {
        ...p,
        creado_en: p.creado_en || new Date().toISOString(),
      }));
      lista.push(...filas);
      data = filas.length === 1 ? filas[0] : filas;
    } else if (estado.ultimoUpdate) {
      const filas = lista.filter(row => estado.filtros.every(f => f(row)));
      if (filas.length > 0) {
        const fila = {
          ...filas[0],
          ...materializar(estado.ultimoUpdate, filas[0]),
          actualizado_en: new Date().toISOString()
        };
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
        const { data, error } = aplicar(false);
        return Promise.resolve({ data: Array.isArray(data) ? data[0] ?? null : data, error }).then(fn);
      },
    };
  }

  builder.then = (fn) => Promise.resolve(aplicar()).then(fn);

  return builder;
}

module.exports = {
  channel: () => ({ on: () => ({ subscribe: () => {} }), unsubscribe: () => Promise.resolve() }),
  from: (tablaActual) => crearBuilder(tablaActual),
  raw: crearExpresionRaw,
  __seed(tablaActual, filas) {
    const lista = tabla(tablaActual);
    lista.push(...filas.map(f => ({ ...f })));
    return lista;
  },
  __reset() {
    for (const k of Object.keys(store)) delete store[k];
  },
  __tabla(tablaActual) {
    return tabla(tablaActual);
  }
};