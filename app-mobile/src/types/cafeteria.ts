export interface Cafeteria {
  /**
   * En la base `cafeterias.id` es un bigint, así que el tipo correcto es
   * number. Estaba declarado como `string`, lo que hacía que los ids del
   * catálogo de demostración ('mock-1') se aceptaran en TypeScript y llegaran
   * a la consulta del menú, donde no hayían match contra la columna numérica.
   */
  id: number;
  nombre: string;
  campus?: string;
  ubicacion?: string;
  demora?: string;
  rating?: string;
  horario?: string;
  imagen_url?: string;
  activa?: boolean;
}
