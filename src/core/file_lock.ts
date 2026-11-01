import * as path from "node:path";

/**
 * Per-file asynchronous mutex queue to serialize read/write operations
 * across parallel Model Context Protocol (MCP) tool invocations.
 */
class AsyncLockQueue {
  private queues = new Map<string, Promise<void>>();

  /**
   * Acquire a lock for the specified file path and execute the callback.
   * Locks are normalized using path.resolve to guarantee uniform key matching.
   */
  async withLock<T>(filePath: string, operation: () => Promise<T> | T): Promise<T> {
    const normPath = path.resolve(filePath).toLowerCase();
    
    // Chain onto any existing pending lock for this file
    const currentLock = this.queues.get(normPath) || Promise.resolve();
    let releaseLock: () => void;
    
    const nextLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    // Update the queue tail
    this.queues.set(
      normPath,
      currentLock.then(
        () => nextLock,
        () => nextLock
      )
    );

    try {
      await currentLock;
      return await operation();
    } finally {
      releaseLock!();
      // Clean up map entry if this was the last operation in the chain
      if (this.queues.get(normPath) === nextLock) {
        this.queues.delete(normPath);
      }
    }
  }

  /**
   * Check if a specific file path currently has an active or pending lock.
   */
  isLocked(filePath: string): boolean {
    const normPath = path.resolve(filePath).toLowerCase();
    return this.queues.has(normPath);
  }
}

export const fileLockManager = new AsyncLockQueue();

export async function withFileLock<T>(
  filePath: string,
  operation: () => Promise<T> | T
): Promise<T> {
  return fileLockManager.withLock(filePath, operation);
}
