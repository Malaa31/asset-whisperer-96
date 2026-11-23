export function shouldShowVaultConflict(
  localDataHash: string,
  remoteDataHash: string,
  lastSyncedDataHash: string | null | undefined,
): boolean {
  if (!lastSyncedDataHash) return localDataHash !== remoteDataHash;
  return (
    localDataHash !== lastSyncedDataHash &&
    remoteDataHash !== lastSyncedDataHash &&
    localDataHash !== remoteDataHash
  );
}
