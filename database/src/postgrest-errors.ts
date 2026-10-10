export class PostgrestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PostgrestError'
  }
}

export function throwIfDbError(result: { error: { message: string } | null }) {
  if (result.error) throw new PostgrestError(result.error.message)
}
