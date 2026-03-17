import { useQuery } from "@tanstack/react-query";
import { desktopBridge } from "../api/desktop-bridge";

export const useWorkspaceSnapshot = () =>
  useQuery({
    queryKey: ["workspace-snapshot"],
    queryFn: desktopBridge.getWorkspaceSnapshot,
  });

export const useRuntimeHealth = () =>
  useQuery({
    queryKey: ["runtime-health"],
    queryFn: desktopBridge.getRuntimeHealth,
  });
