import * as crypto from "crypto";

export interface MerkleProofNode {
  readonly position: "LEFT" | "RIGHT";
  readonly siblingHashHex: string;
}

export interface SettlementMerkleProof {
  readonly leafHashHex: string;
  readonly rootHashHex: string;
  readonly path: readonly MerkleProofNode[];
}

export function sha256Hex(data: string): string {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

export function hashPair(leftHex: string, rightHex: string): string {
  return sha256Hex(`NODE:${leftHex}:${rightHex}`);
}

export function computeSettlementMerkleRoot(transactionIds: readonly string[]): string {
  if (transactionIds.length === 0) {
    throw new Error("MERKLE_ERR: Cannot compute Merkle root of empty settlement batch");
  }

  let currentLayer: string[] = transactionIds.map((id) => sha256Hex(`LEAF:${id}`));

  while (currentLayer.length > 1) {
    const nextLayer: string[] = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = currentLayer[i];
      if (left === undefined) continue;
      const right = currentLayer[i + 1] ?? left;
      nextLayer.push(hashPair(left, right));
    }
    currentLayer = nextLayer;
  }

  return currentLayer[0] ?? "";
}

export function generateInclusionProof(
  transactionIds: readonly string[],
  targetIndex: number
): SettlementMerkleProof {
  if (targetIndex < 0 || targetIndex >= transactionIds.length) {
    throw new Error("MERKLE_ERR: Target transaction index out of bounds");
  }

  let currentLayer: string[] = transactionIds.map((id) => sha256Hex(`LEAF:${id}`));
  const leafHashHex = currentLayer[targetIndex] ?? "";
  const path: MerkleProofNode[] = [];
  let idx = targetIndex;

  while (currentLayer.length > 1) {
    const isRightNode = idx % 2 === 1;
    const siblingIdx = isRightNode ? idx - 1 : idx + 1;
    const currentHash = currentLayer[idx] ?? "";
    const siblingHash = currentLayer[siblingIdx] ?? currentHash;

    path.push({
      position: isRightNode ? "LEFT" : "RIGHT",
      siblingHashHex: siblingHash,
    });

    const nextLayer: string[] = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = currentLayer[i];
      if (left === undefined) continue;
      const right = currentLayer[i + 1] ?? left;
      nextLayer.push(hashPair(left, right));
    }

    currentLayer = nextLayer;
    idx = Math.floor(idx / 2);
  }

  return {
    leafHashHex,
    rootHashHex: currentLayer[0] ?? "",
    path,
  };
}

export function verifyInclusionProof(proof: SettlementMerkleProof): boolean {
  let computedHash = proof.leafHashHex;
  for (const step of proof.path) {
    if (step.position === "LEFT") {
      computedHash = hashPair(step.siblingHashHex, computedHash);
    } else {
      computedHash = hashPair(computedHash, step.siblingHashHex);
    }
  }
  return computedHash === proof.rootHashHex;
}
