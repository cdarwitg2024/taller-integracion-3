# Modelo Entidad-Relación

## UNIVERSIDADES
| Tipo | Nombre | Clave |
| :--- | :--- | :--- |
| bigint | id | PK |
| varchar | nombre | |
| varchar | alias | |
| varchar | dominio | |
| timestamp | creado_en | |
| timestamp | actualizado_en | |

## CAMPUS_SEDES
| Tipo | Nombre | Clave |
| :--- | :--- | :--- |
| bigint | id | PK |
| bigint | universidad_id | FK |
| varchar | nombre_sede | |
| varchar | ciudad | |
| varchar | direccion | |
| boolean | activo | |
| timestamp | creado_en | |
| timestamp | actualizado_en | |

## ROLES
| Tipo | Nombre | Clave |
| :--- | :--- | :--- |
| bigint | id | PK |
| varchar | nombre | UK |
| text | descripcion | |
| boolean | activo | |

## CATEGORIAS
| Tipo | Nombre | Clave |
| :--- | :--- | :--- |
| bigint | id | PK |
| varchar | nombre | |
| text | descripcion | |

## CAFETERIAS
| Tipo | Nombre | Clave |
| :--- | :--- | :--- |
| bigint | id | PK |
| bigint | campus_id | FK |
| varchar | nombre | |
| text | descripcion | |
| time | hora_apertura | |
| time | hora_cierre | |
| bigint | imagen_id | |
| boolean | activa | |
| timestamp | creado_en | |
| timestamp | actualizado_en | |

## USUARIOS
| Tipo | Nombre | Clave |
| :--- | :--- | :--- |
| bigint | id | PK |
| bigint | rol_id | FK |
| varchar | nombre | |
| varchar | apellido | |
| varchar | email | UK |
| varchar | telefono | |
| varchar | password_hash | |
| varchar | foto_url | |
| boolean | activo | |
| timestamp | ultimo_acceso | |
| timestamp | creado_en | |
| timestamp | actualizado_en | |

## PRODUCTOS
| Tipo | Nombre | Clave |
| :--- | :--- | :--- |
| bigint | id | PK |
| bigint | cafeteria_id | FK |
| bigint | categoria_id | FK |
| varchar | nombre | |
| text | descripcion | |
| decimal | precio | |
| varchar | imagen_url | |
| boolean | disponible | |
| int | stock | |
| boolean | maneja_stock | |
| boolean | activo | |
| timestamp | creado_en | |
| timestamp | actualizado_en | |

## CAFETERIA_USUARIOS
| Tipo | Nombre | Clave |
| :--- | :--- | :--- |
| bigint | id | PK |
| bigint | usuario_id | FK |
| bigint | cafeteria_id | FK |
| varchar | cargo | |
| boolean | gestiona_inventario | |
| boolean | gestiona_productos | |
| boolean | gestiona_pedidos | |
| boolean | gestiona_usuarios | |
| boolean | recibe_notificaciones | |
| boolean | ver_reportes_financieros| |
| timestamp | creado_en | |

## PEDIDOS
| Tipo | Nombre | Clave |
| :--- | :--- | :--- |
| bigint | id | PK |
| bigint | usuario_id | FK |
| bigint | cafeteria_id | FK |
| varchar | codigo_retiro | UK |
| varchar | estado | |
| varchar | pago_estado | |
| text | notas | |
| decimal | total | |
| varchar | qr_token | UK |
| timestamp | qr_valido_hasta | |
| timestamp | qr_usado_en | |
| timestamp | tiempo_estimado_entrega| |
| int | tiempo_real_min | |
| timestamp | creado_en | |
| timestamp | listo_preparado_en | |
| timestamp | entregado_en | |
| timestamp | cancelado_en | |

## DISPOSITIVOS
| Tipo | Nombre | Clave |
| :--- | :--- | :--- |
| bigint | id | PK |
| bigint | usuario_id | FK |
| varchar | token_fcm | UK |
| varchar | plataforma | |
| boolean | activo | |
| timestamp | ultimo_acceso | |
| timestamp | creado_en | |

## METODOS_PAGO
| Tipo | Nombre | Clave |
| :--- | :--- | :--- |
| bigint | id | PK |
| varchar | nombre | |
| varchar | codigo | |
| boolean | activo | |
| text | instrucciones_referencia | |
| timestamp | creado_en | |
| timestamp | actualizado_en | |

## ALERTAS_STOCK
| Tipo | Nombre | Clave |
| :--- | :--- | :--- |
| bigint | id | PK |
| bigint | cafeteria_id | FK |
| bigint | producto_id | FK |
| int | stock_actual | |
| int | nivel_minimo | |
| varchar | estado | |
| text | mensaje | |
| boolean | leida | |
| timestamp | creado_en | |

## DETALLES_PEDIDO
| Tipo | Nombre | Clave |
| :--- | :--- | :--- |
| bigint | id | PK |
| bigint | pedido_id | FK |
| bigint | producto_id | FK |
| int | cantidad | |
| decimal | precio_unitario | |
| decimal | subtotal | |
| varchar | notas | |

## LOGS_VALIDACION_QR
| Tipo | Nombre | Clave |
| :--- | :--- | :--- |
| bigint | id | PK |
| bigint | cafeteria_id | FK |
| bigint | pedido_id | FK |
| bigint | usuario_validador_id | FK |
| varchar | resultado | |
| text | mensaje_error | |
| varchar | metodo_validacion | |
| timestamp | creado_en | |

## MOVIMIENTOS_INVENTARIO
| Tipo | Nombre | Clave |
| :--- | :--- | :--- |
| bigint | id | PK |
| bigint | producto_id | FK |
| bigint | usuario_id | FK |
| varchar | tipo | |
| int | cantidad | |
| text | motivo | |
| timestamp | creado_en | |

## PAGOS
| Tipo | Nombre | Clave |
| :--- | :--- | :--- |
| bigint | id | PK |
| bigint | pedido_id | FK |
| bigint | metodo_pago_id | FK |
| varchar | estado | |
| decimal | monto | |
| varchar | id_transaccion | UK |
| text | respuesta_pasarela | |
| varchar | comprobante_url | |
| timestamp | creado_en | |