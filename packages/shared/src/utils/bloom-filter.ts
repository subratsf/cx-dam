/**
 * Bloom Filter implementation for fast name uniqueness checking
 * Uses multiple hash functions to minimize false positives
 */
export class BloomFilter {
  private bitArray: Uint8Array;
  private size: number;
  private hashCount: number;

  constructor(expectedItems: number = 100000, falsePositiveRate: number = 0.01) {
    // Calculate optimal bit array size
    this.size = Math.ceil(
      (-expectedItems * Math.log(falsePositiveRate)) / (Math.log(2) * Math.log(2))
    );

    // Calculate optimal number of hash functions
    this.hashCount = Math.ceil((this.size / expectedItems) * Math.log(2));

    // Initialize bit array (using Uint8Array for memory efficiency)
    this.bitArray = new Uint8Array(Math.ceil(this.size / 8));
  }

  /**
   * Generate multiple hash values for a given key
   */
  private hash(key: string, seed: number): number {
    let hash = seed;
    for (let i = 0; i < key.length; i++) {
      hash = (hash << 5) - hash + key.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % this.size;
  }

  /**
   * Add an item to the bloom filter
   */
  add(item: string): void {
    const normalizedItem = item.toLowerCase().trim();

    for (let i = 0; i < this.hashCount; i++) {
      const position = this.hash(normalizedItem, i);
      const byteIndex = Math.floor(position / 8);
      const bitIndex = position % 8;
      this.bitArray[byteIndex] |= 1 << bitIndex;
    }
  }

  /**
   * Check if an item might exist in the bloom filter
   * Returns true if item might exist (with false positive rate)
   * Returns false if item definitely doesn't exist
   */
  mightContain(item: string): boolean {
    const normalizedItem = item.toLowerCase().trim();

    for (let i = 0; i < this.hashCount; i++) {
      const position = this.hash(normalizedItem, i);
      const byteIndex = Math.floor(position / 8);
      const bitIndex = position % 8;

      if ((this.bitArray[byteIndex] & (1 << bitIndex)) === 0) {
        return false; // Definitely doesn't exist
      }
    }

    return true; // Might exist
  }

  /**
   * Get the current false positive probability
   */
  getFalsePositiveProbability(itemsAdded: number): number {
    const exponent = (-this.hashCount * itemsAdded) / this.size;
    return Math.pow(1 - Math.exp(exponent), this.hashCount);
  }

  /**
   * Export bloom filter state for persistence
   */
  export(): { bitArray: number[]; size: number; hashCount: number } {
    return {
      bitArray: Array.from(this.bitArray),
      size: this.size,
      hashCount: this.hashCount,
    };
  }

  /**
   * Import bloom filter state from persistence
   */
  static import(data: {
    bitArray: number[];
    size: number;
    hashCount: number;
  }): BloomFilter {
    const filter = new BloomFilter();
    filter.bitArray = new Uint8Array(data.bitArray);
    filter.size = data.size;
    filter.hashCount = data.hashCount;
    return filter;
  }

  /**
   * Clear the bloom filter
   */
  clear(): void {
    this.bitArray = new Uint8Array(Math.ceil(this.size / 8));
  }
}
