// ─── Bloom Sync: tự đồng bộ Assessment Matrix ↔ Content Structure taxonomy tags ───
// Giải pháp Option B: cả 2 chiều

import { parseMatrix, serializeMatrix, DEFAULT_EMPTY_MATRIX, type AssessmentMatrixMap } from "./_assessment-matrix";
import {
  parseContentStructure,
  serializeContentStructure,
  type ContentStructureData,
  type TaxonomyTagMap,
} from "./_content-structure";
import { BLOOM_LEVELS, type BloomLevelKey } from "./_bloom-objectives";

type IdentifiableComponent = {
  id: number;
  component_type: string;
};

/**
 * Merge Assessment Matrix → Content Structure taxonomy tags.
 * Với mỗi Bloom level trong matrix, thêm tag `component:{id}` → level vào taxonomyTags.
 *
 * Chỉ ảnh hưởng đến component tags (assessment components).
 * Module tags, document tags, và các tags khác được giữ nguyên.
 */
export function mergeMatrixIntoStructure(
  matrixJson: string,
  structureJson: string,
  allComponents: IdentifiableComponent[],
): string {
  const matrix = parseMatrix(matrixJson);
  const structure = parseContentStructure(structureJson);

  const assessmentIds = new Set(
    allComponents
      .filter((c) => c.component_type === "exam" || c.component_type === "assignment")
      .map((c) => c.id),
  );

  const newTags: TaxonomyTagMap = { ...structure.taxonomyTags };

  for (const level of BLOOM_LEVELS) {
    for (const id of matrix[level.key]) {
      const key = `component:${id}`;
      if (!assessmentIds.has(id)) continue; // chỉ sync assessment components
      const current = newTags[key] ?? [];
      if (!current.includes(level.key)) {
        newTags[key] = [...current, level.key];
      }
    }
  }

  // Xóa tags của assessment components không còn trong matrix
  for (const key of Object.keys(newTags)) {
    if (!key.startsWith("component:")) continue;
    const id = Number(key.slice("component:".length));
    if (!assessmentIds.has(id)) continue;

    const levelsFromMatrix: BloomLevelKey[] = [];
    for (const level of BLOOM_LEVELS) {
      if (matrix[level.key].includes(id)) {
        levelsFromMatrix.push(level.key);
      }
    }

    if (levelsFromMatrix.length === 0) {
      delete newTags[key];
    } else {
      newTags[key] = levelsFromMatrix;
    }
  }

  const next: ContentStructureData = {
    ...structure,
    taxonomyTags: newTags,
  };

  return serializeContentStructure(next);
}

/**
 * Merge Content Structure taxonomy tags → Assessment Matrix.
 * Với mỗi component có tag Bloom trong taxonomyTags, cập nhật matrix.
 *
 * Chỉ ảnh hưởng đến assessment components (exam/assignment).
 * Module tags và document tags không ảnh hưởng đến matrix.
 */
export function mergeStructureIntoMatrix(
  structureJson: string,
  matrixJson: string,
  allComponents: IdentifiableComponent[],
): string {
  const structure = parseContentStructure(structureJson);
  const matrix = parseMatrix(matrixJson);

  const assessmentComponents = allComponents.filter(
    (c) => c.component_type === "exam" || c.component_type === "assignment",
  );

  const newMatrix: AssessmentMatrixMap = { ...DEFAULT_EMPTY_MATRIX };
  for (const level of BLOOM_LEVELS) {
    newMatrix[level.key] = [...matrix[level.key]];
  }

  for (const component of assessmentComponents) {
    const key = `component:${component.id}`;
    const tagsFromStructure = structure.taxonomyTags[key] ?? [];

    for (const level of BLOOM_LEVELS) {
      const hasTag = tagsFromStructure.includes(level.key);
      const currentIds = newMatrix[level.key];
      const isInMatrix = currentIds.includes(component.id);

      if (hasTag && !isInMatrix) {
        newMatrix[level.key] = [...currentIds, component.id];
      } else if (!hasTag && isInMatrix) {
        newMatrix[level.key] = currentIds.filter((id) => id !== component.id);
      }
    }
  }

  return serializeMatrix(newMatrix);
}


