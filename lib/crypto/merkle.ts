import { hashLeaf, hashInternalNode } from './sha256';
import { MerkleProofStep, MerkleInclusionProof } from '../types';

export class MerkleTree {
  private rawLeaves: string[];
  private leafHashes: string[];
  private layers: string[][];

  constructor(leaves: string[]) {
    this.rawLeaves = [...leaves];
    // Domain-separate every leaf with 0x00 prefix
    this.leafHashes = leaves.map((leaf) => hashLeaf(leaf));
    this.layers = [];
    this.buildTree();
  }

  private buildTree(): void {
    if (this.leafHashes.length === 0) {
      this.layers = [[]];
      return;
    }

    let currentLayer = [...this.leafHashes];
    this.layers.push(currentLayer);

    while (currentLayer.length > 1) {
      const nextLayer: string[] = [];

      for (let i = 0; i < currentLayer.length; i += 2) {
        const left = currentLayer[i];
        // Handle odd number of elements by duplicating the last node
        const right = i + 1 < currentLayer.length ? currentLayer[i + 1] : left;
        const parentHash = hashInternalNode(left, right);
        nextLayer.push(parentHash);
      }

      this.layers.push(nextLayer);
      currentLayer = nextLayer;
    }
  }

  public getRoot(): string {
    if (this.layers.length === 0 || this.layers[0].length === 0) {
      return '';
    }
    const topLayer = this.layers[this.layers.length - 1];
    return topLayer[0] || '';
  }

  public getLeafCount(): number {
    return this.leafHashes.length;
  }

  public getDomainSeparatedLeaves(): string[] {
    return [...this.leafHashes];
  }

  public getLayers(): string[][] {
    return this.layers.map((layer) => [...layer]);
  }

  /**
   * Generates a cryptographic Merkle inclusion proof for the leaf at leafIndex.
   */
  public getProof(leafIndex: number): MerkleProofStep[] {
    if (leafIndex < 0 || leafIndex >= this.leafHashes.length) {
      throw new Error(`Leaf index ${leafIndex} out of range [0, ${this.leafHashes.length - 1}]`);
    }

    const proof: MerkleProofStep[] = [];
    let currentIndex = leafIndex;

    // Traverse all layers except the top root layer
    for (let layerIndex = 0; layerIndex < this.layers.length - 1; layerIndex++) {
      const currentLayer = this.layers[layerIndex];
      const isRightSibling = currentIndex % 2 === 1;
      const siblingIndex = isRightSibling ? currentIndex - 1 : currentIndex + 1;

      if (siblingIndex < currentLayer.length) {
        proof.push({
          position: isRightSibling ? 'left' : 'right',
          hash: currentLayer[siblingIndex],
        });
      } else {
        // Odd leaf duplicate condition: sibling is self
        proof.push({
          position: 'right',
          hash: currentLayer[currentIndex],
        });
      }

      currentIndex = Math.floor(currentIndex / 2);
    }

    return proof;
  }

  /**
   * Returns a complete inclusion proof package for a given leaf index.
   */
  public getInclusionProof(leafIndex: number): MerkleInclusionProof {
    const proof = this.getProof(leafIndex);
    return {
      leafHash: this.rawLeaves[leafIndex],
      leafIndex,
      proof,
      root: this.getRoot(),
    };
  }
}

/**
 * Independently verifies a Merkle inclusion proof.
 * Can be run on server or client.
 */
export function verifyMerkleProof(
  rawLeafHash: string,
  proof: MerkleProofStep[],
  expectedRoot: string
): boolean {
  if (!rawLeafHash || !expectedRoot) {
    return false;
  }

  // 1. Hash the raw leaf with 0x00 domain separation
  let currentHash = hashLeaf(rawLeafHash);

  // 2. Iterate up the proof path using 0x01 internal node hashing
  for (const step of proof) {
    if (!step || !step.hash || !step.position) {
      return false;
    }

    if (step.position === 'left') {
      currentHash = hashInternalNode(step.hash, currentHash);
    } else if (step.position === 'right') {
      currentHash = hashInternalNode(currentHash, step.hash);
    } else {
      return false;
    }
  }

  // 3. Compare with expected root (constant time check or strict string equality)
  return currentHash.toLowerCase() === expectedRoot.toLowerCase();
}
