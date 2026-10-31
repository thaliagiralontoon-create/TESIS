import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const id = () => integer("id").primaryKey().generatedByDefaultAsIdentity();
const createdAt = () => timestamp("creado_en", { withTimezone: true }).notNull().defaultNow();

export const areas = pgTable("areas", {
  id: id(),
  nombre: varchar("nombre", { length: 80 }).notNull().unique(),
});

export const categorias = pgTable("categorias", {
  id: id(),
  nombre: varchar("nombre", { length: 60 }).notNull().unique(),
  slaHoras: numeric("sla_horas", { precision: 6, scale: 2 }).notNull().default("8"),
});

export const usuarios = pgTable("usuarios", {
  id: id(),
  codigo: varchar("codigo", { length: 20 }).notNull().unique(),
  nombre: varchar("nombre", { length: 120 }).notNull(),
  correo: varchar("correo", { length: 120 }).unique(),
  rol: varchar("rol", { length: 20 }).notNull(),
  areaId: integer("area_id").references(() => areas.id),
  especialidadId: integer("especialidad_id").references(() => categorias.id),
  activo: boolean("activo").notNull().default(true),
  creadoEn: createdAt(),
}, (table) => [
  check("usuarios_rol_check", sql`${table.rol} in ('colaborador', 'tecnico', 'supervisor')`),
  index("idx_usuarios_rol_activo").on(table.rol, table.activo),
]);

export const incidencias = pgTable("incidencias", {
  id: id(),
  codigo: varchar("codigo", { length: 20 }).notNull().unique(),
  origen: varchar("origen", { length: 20 }).notNull().default("sistema"),
  titulo: varchar("titulo", { length: 160 }).notNull(),
  descripcion: text("descripcion").notNull(),
  usuarioId: integer("usuario_id").references(() => usuarios.id),
  areaId: integer("area_id").references(() => areas.id),
  prioridad: varchar("prioridad", { length: 10 }).notNull().default("Media"),
  estado: varchar("estado", { length: 12 }).notNull().default("Abierto"),
  categoriaSugeridaId: integer("categoria_sugerida_id").references(() => categorias.id),
  confianzaSugerencia: numeric("confianza_sugerencia", { precision: 5, scale: 4 }),
  modeloVersion: varchar("modelo_version", { length: 40 }),
  categoriaConfirmadaId: integer("categoria_confirmada_id").references(() => categorias.id),
  confirmadaPor: integer("confirmada_por").references(() => usuarios.id),
  confirmadaEn: timestamp("confirmada_en", { withTimezone: true }),
  tecnicoId: integer("tecnico_id").references(() => usuarios.id),
  registradaEn: timestamp("registrada_en", { withTimezone: true }).notNull(),
  asignadaEn: timestamp("asignada_en", { withTimezone: true }),
  resueltaEn: timestamp("resuelta_en", { withTimezone: true }),
  cerradaEn: timestamp("cerrada_en", { withTimezone: true }),
  solucion: text("solucion"),
  // Aprendizaje del asistente: qué se sugirió, si sirvió y qué se hizo realmente.
  procedimientoId: varchar("procedimiento_id", { length: 40 }),
  procedimientoUtil: boolean("procedimiento_util"),
  causa: varchar("causa", { length: 160 }),
  repuestoUsado: varchar("repuesto_usado", { length: 120 }),
}, (table) => [
  check("incidencias_origen_check", sql`${table.origen} in ('sistema', 'historico')`),
  check("incidencias_prioridad_check", sql`${table.prioridad} in ('Baja', 'Media', 'Alta', 'Crítica')`),
  check("incidencias_estado_check", sql`${table.estado} in ('Abierto', 'Asignado', 'En proceso', 'Resuelto', 'Cerrado')`),
  index("idx_inc_estado").on(table.estado),
  index("idx_inc_registrada").on(table.registradaEn),
  index("idx_inc_tecnico").on(table.tecnicoId),
  index("idx_inc_categoria").on(table.categoriaConfirmadaId),
  index("idx_inc_origen").on(table.origen),
]);

export const incidenciaEventos = pgTable("incidencia_eventos", {
  id: id(),
  incidenciaId: integer("incidencia_id").notNull().references(() => incidencias.id, { onDelete: "cascade" }),
  usuarioId: integer("usuario_id").references(() => usuarios.id),
  evento: varchar("evento", { length: 40 }).notNull(),
  detalle: text("detalle"),
  ocurridoEn: timestamp("ocurrido_en", { withTimezone: true }).notNull(),
}, (table) => [index("idx_eventos_inc").on(table.incidenciaId, table.ocurridoEn)]);

export const reporteRegistros = pgTable("reporte_registros", {
  id: id(),
  tipo: varchar("tipo", { length: 60 }).notNull(),
  usuarioId: integer("usuario_id").references(() => usuarios.id),
  inicio: timestamp("inicio", { withTimezone: true }).notNull(),
  fin: timestamp("fin", { withTimezone: true }).notNull(),
  duracionMs: integer("duracion_ms").notNull(),
  filas: integer("filas").notNull().default(0),
}, (table) => [index("idx_reportes_inicio").on(table.inicio)]);

export const consultaRegistros = pgTable("consulta_registros", {
  id: id(),
  usuarioId: integer("usuario_id").references(() => usuarios.id),
  modulo: varchar("modulo", { length: 60 }).notNull(),
  solicitadaEn: timestamp("solicitada_en", { withTimezone: true }).notNull(),
  respuestaMs: integer("respuesta_ms").notNull(),
  datosActualizados: boolean("datos_actualizados").notNull(),
  inmediata: boolean("inmediata").notNull(),
}, (table) => [index("idx_consultas_solicitada").on(table.solicitadaEn)]);

export const verificaciones = pgTable("verificaciones", {
  id: id(),
  indicador: varchar("indicador", { length: 10 }).notNull(),
  periodoInicio: date("periodo_inicio", { mode: "date" }).notNull(),
  periodoFin: date("periodo_fin", { mode: "date" }).notNull(),
  valorSistema: numeric("valor_sistema", { precision: 12, scale: 4 }).notNull(),
  valorRecalculado: numeric("valor_recalculado", { precision: 12, scale: 4 }).notNull(),
  tolerancia: numeric("tolerancia", { precision: 8, scale: 4 }).notNull().default("0.01"),
  coincide: boolean("coincide").notNull(),
  verificadoPor: integer("verificado_por").references(() => usuarios.id),
  verificadoEn: timestamp("verificado_en", { withTimezone: true }).notNull(),
  observacion: text("observacion"),
}, (table) => [index("idx_verificaciones_periodo").on(table.periodoInicio, table.periodoFin)]);

export const actividades = pgTable("actividades", {
  id: id(),
  titulo: varchar("titulo", { length: 160 }).notNull(),
  tipo: varchar("tipo", { length: 40 }).notNull().default("Mantenimiento"),
  tecnicoId: integer("tecnico_id").notNull().references(() => usuarios.id),
  programadaPara: timestamp("programada_para", { withTimezone: true }).notNull(),
  venceEn: timestamp("vence_en", { withTimezone: true }).notNull(),
  ejecutadaEn: timestamp("ejecutada_en", { withTimezone: true }),
  estado: varchar("estado", { length: 12 }).notNull().default("Programada"),
  creadaPor: integer("creada_por").references(() => usuarios.id),
  creadaEn: createdAt(),
}, (table) => [
  check("actividades_estado_check", sql`${table.estado} in ('Programada', 'Ejecutada', 'Cancelada')`),
  index("idx_act_tecnico").on(table.tecnicoId),
  index("idx_act_programada").on(table.programadaPara),
]);

export const modelosMl = pgTable("modelos_ml", {
  id: id(),
  version: varchar("version", { length: 40 }).notNull().unique(),
  algoritmo: varchar("algoritmo", { length: 80 }).notNull(),
  entrenadoEn: timestamp("entrenado_en", { withTimezone: true }).notNull(),
  nEntrenamiento: integer("n_entrenamiento").notNull(),
  nPrueba: integer("n_prueba").notNull(),
  exactitud: numeric("exactitud", { precision: 6, scale: 4 }),
  f1Macro: numeric("f1_macro", { precision: 6, scale: 4 }),
  kappa: numeric("kappa", { precision: 6, scale: 4 }),
  metricasJson: jsonb("metricas_json").$type<Record<string, unknown>>(),
  // Pesos del modelo entrenado desde la pantalla; null en las versiones entrenadas fuera del sistema.
  modeloJson: text("modelo_json"),
  activo: boolean("activo").notNull().default(false),
});

// Protocolo de tareas del pretest (procedimiento manual) y postest (sistema) para I1, I3 e I4.
export const mediciones = pgTable("mediciones", {
  id: id(),
  indicador: varchar("indicador", { length: 4 }).notNull(),
  fase: varchar("fase", { length: 10 }).notNull(),
  tarea: varchar("tarea", { length: 6 }).notNull(),
  inicio: timestamp("inicio", { withTimezone: true }).notNull(),
  fin: timestamp("fin", { withTimezone: true }).notNull(),
  duracionMs: integer("duracion_ms").notNull(),
  respuesta: text("respuesta"),
  datosActualizados: boolean("datos_actualizados"),
  valorObtenido: numeric("valor_obtenido", { precision: 14, scale: 4 }),
  valorReferencia: numeric("valor_referencia", { precision: 14, scale: 4 }),
  cumple: boolean("cumple"),
  observacion: text("observacion"),
  responsableId: integer("responsable_id").references(() => usuarios.id),
  anulada: boolean("anulada").notNull().default(false),
  creadoEn: createdAt(),
}, (table) => [
  check("mediciones_indicador_check", sql`${table.indicador} in ('I1', 'I3', 'I4', 'ML')`),
  check("mediciones_fase_check", sql`${table.fase} in ('pretest', 'postest')`),
  index("idx_mediciones_tarea").on(table.fase, table.tarea),
]);

export const schema = {
  areas,
  categorias,
  usuarios,
  incidencias,
  incidenciaEventos,
  reporteRegistros,
  consultaRegistros,
  verificaciones,
  actividades,
  modelosMl,
  mediciones,
};

export type User = typeof usuarios.$inferSelect;
export type Incident = typeof incidencias.$inferSelect;
