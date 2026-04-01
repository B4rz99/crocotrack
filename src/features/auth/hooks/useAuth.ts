import { useShallow } from "zustand/react/shallow";
import { useAuthStore } from "../stores/auth.store";

export const useAuth = () =>
  useAuthStore(
    useShallow((state) => ({
      user: state.user,
      profile: state.profile,
      isAuthenticated: state.isAuthenticated,
      isLoading: state.isLoading,
      isOwner: state.isOwner,
      isWorker: state.isWorker,
      setSession: state.setSession,
      setProfile: state.setProfile,
      clear: state.clear,
    }))
  );
