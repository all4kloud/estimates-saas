/**
 * Lee una variable de entorno del servidor. Vacía o "NOT_SET" (el valor que deja
 * scripts/gcp-setup.ps1 cuando un secreto aún no existe) cuenta como no configurada.
 */
export function env(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v && v !== 'NOT_SET' ? v : undefined;
}
