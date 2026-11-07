import { App } from "@/components/App";
import { StoreProvider } from "@/lib/store";

export default function Page() {
  return (
    <StoreProvider>
      <App />
    </StoreProvider>
  );
}
