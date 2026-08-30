-- Repair: invoices voided before release-on-void shipped (commit c5909f2,
-- 2026-07-06) kept their time entries linked to the voided invoice's lines,
-- leaving that time permanently "billed" and impossible to invoice again.
-- Restore the invariant the code now maintains: voiding an invoice releases
-- its billed time back to the unbilled pool (the voided invoice keeps its
-- lines for the record - only the time_entry -> line link is cleared).
UPDATE "time_entry" te
SET "invoice_line_id" = NULL, "updated_at" = now()
FROM "invoice_line" il
JOIN "invoice" i ON i."id" = il."invoice_id"
WHERE te."invoice_line_id" = il."id" AND i."status" = 'void';
