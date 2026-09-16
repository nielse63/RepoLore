export type AcquisitionErrorCode =
  | "github-error"
  | "tarball-too-large"
  | "extracted-too-large"
  | "too-many-files"
  | "unsafe-entry"
  | "timeout";

/**
 * Thrown for any failure in fetching or safely extracting a repository's
 * source (ADR-0002). Every code maps to an honest, user-facing reason a
 * repository couldn't be analyzed — never a silent partial result.
 */
export class AcquisitionError extends Error {
  code: AcquisitionErrorCode;

  constructor(code: AcquisitionErrorCode, message: string) {
    super(message);
    this.name = "AcquisitionError";
    this.code = code;
  }
}
