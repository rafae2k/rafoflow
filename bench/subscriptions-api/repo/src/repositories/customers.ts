import type { Database } from "../db/database.ts";
import type { Customer } from "../domain/types.ts";
import { ConflictError } from "../lib/errors.ts";

export function insertCustomer(db: Database, customer: Customer): Customer {
  try {
    db.prepare("INSERT INTO customers (id, email, name, created_at) VALUES (?, ?, ?, ?)").run(
      customer.id,
      customer.email,
      customer.name,
      customer.created_at,
    );
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE constraint failed: customers.email")) {
      throw new ConflictError("email_taken", `a customer with email ${customer.email} already exists`);
    }
    throw err;
  }
  return customer;
}

export function findCustomer(db: Database, id: string): Customer | undefined {
  const row = db.prepare("SELECT * FROM customers WHERE id = ?").get(id);
  return row ? ({ ...row } as unknown as Customer) : undefined;
}
