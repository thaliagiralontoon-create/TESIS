ALTER TABLE "mediciones" DROP CONSTRAINT "mediciones_indicador_check";--> statement-breakpoint
ALTER TABLE "incidencias" ADD COLUMN "procedimiento_id" varchar(40);--> statement-breakpoint
ALTER TABLE "incidencias" ADD COLUMN "procedimiento_util" boolean;--> statement-breakpoint
ALTER TABLE "incidencias" ADD COLUMN "causa" varchar(160);--> statement-breakpoint
ALTER TABLE "incidencias" ADD COLUMN "repuesto_usado" varchar(120);--> statement-breakpoint
ALTER TABLE "modelos_ml" ADD COLUMN "modelo_json" text;--> statement-breakpoint
ALTER TABLE "mediciones" ADD CONSTRAINT "mediciones_indicador_check" CHECK ("mediciones"."indicador" in ('I1', 'I3', 'I4', 'ML'));