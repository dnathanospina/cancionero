/**
 * Errores de escritura comunes a todos los orígenes (demostración, OneDrive).
 *  - ConflictError: el archivo cambió (o se borró, o ya existe) desde que se leyó.
 *    reason: 'changed' | 'deleted' | 'exists'
 *  - OfflineError: no hay conexión; el cambio queda pendiente.
 */
export class ConflictError extends Error {
  constructor(reason, path) {
    super(
      reason === 'exists'
        ? `Ya existe un archivo llamado «${path}».`
        : reason === 'deleted'
          ? `Otra persona ha borrado «${path}».`
          : `Otra persona ha cambiado «${path}».`,
    );
    this.name = 'ConflictError';
    this.reason = reason;
    this.path = path;
  }
}

export class OfflineError extends Error {
  constructor() {
    super('Sin conexión');
    this.name = 'OfflineError';
  }
}
