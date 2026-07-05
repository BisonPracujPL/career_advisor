import { CareerTree, TreeBranchNode, TreeNode, TreeStateNode } from "../types";

export interface CheckpointRevertOption {
  stepsToKeep: number;
  label: string;
  confirmMessage: string;
}

export function getCheckpointRevertOption(
  tree: CareerTree,
  node: TreeNode
): CheckpointRevertOption | null {
  const pathSteps = tree.levels.length - 1;
  if (pathSteps <= 0) return null;

  let stepsToKeep: number;
  let label: string;

  if (node.kind === "state") {
    const state = node as TreeStateNode;
    if (state.id === "state:current") {
      stepsToKeep = pathSteps - 1;
      label = "Cofnij ostatni krok";
    } else {
      stepsToKeep = state.depth;
      if (stepsToKeep >= pathSteps) return null;
      label =
        stepsToKeep === 0
          ? "Cofnij do startu"
          : `Cofnij do checkpointu — etap ${stepsToKeep}`;
    }
  } else if (node.kind === "branch") {
    const branch = node as TreeBranchNode;
    if (branch.status !== "completed") return null;

    let levelIndex = -1;
    for (let li = 0; li < tree.levels.length; li++) {
      if (tree.levels[li].branches.some((b) => b.id === branch.id)) {
        levelIndex = li;
        break;
      }
    }
    if (levelIndex < 0 || levelIndex >= pathSteps) return null;

    stepsToKeep = levelIndex;
    label =
      stepsToKeep === 0
        ? "Cofnij przed tę gałąź — wybierz inną"
        : `Cofnij przed tę gałąź (etap ${stepsToKeep})`;
  } else {
    return null;
  }

  if (stepsToKeep >= pathSteps) return null;

  const removed = pathSteps - stepsToKeep;
  const confirmMessage =
    stepsToKeep === 0
      ? "Cofnąć do startu? Wybrane gałęzie zostaną usunięte — skille startowe z profilu wirtualnego zostają."
      : `Cofnąć o ${removed} ${removed === 1 ? "krok" : "kroki"}? Późniejsze gałęzie zostaną usunięte — wybierzesz inną ścieżkę.`;

  return { stepsToKeep, label, confirmMessage };
}
