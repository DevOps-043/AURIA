import { useWorkspaceStore } from "../../app/workspace-store";

export const useWorkspace = () => {
  const snapshot = useWorkspaceStore((state) => state.snapshot);

  if (!snapshot) {
    throw new Error("La instantanea del espacio de trabajo todavia no se ha cargado.");
  }

  return snapshot;
};
