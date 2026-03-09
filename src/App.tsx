import { RouterProvider } from "react-router";
import { useAuthListener } from "@/features/auth/hooks/useAuthListener";
import { useAutoSync } from "@/shared/hooks/useAutoSync";
import { router } from "./app/router";

export default function App() {
  useAuthListener();
  useAutoSync();
  return <RouterProvider router={router} />;
}
