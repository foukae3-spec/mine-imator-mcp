/**
 * Mine-imator ID generator matching upstream save_id_create()
 * Mine-imator uses 16-character uppercase alphanumeric strings: ^[A-Z0-9]{16}$
 */

const ID_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function save_id_create(): string {
  let id = "";
  for (let i = 0; i < 16; i++) {
    const randomIndex = Math.floor(Math.random() * ID_CHARS.length);
    id += ID_CHARS[randomIndex];
  }
  return id;
}

export function is_valid_save_id(id: unknown): boolean {
  if (typeof id !== "string") return false;
  return /^[A-Z0-9]{16}$/.test(id);
}
