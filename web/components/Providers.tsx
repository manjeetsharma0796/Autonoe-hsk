"use client";

import { useState, type ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { hashkeyTestnet } from "@autonoe/chain";
import { WalletProvider } from "@/components/wallet/WalletProvider";

// viem's `Chain` type is structurally compatible with the object exported by
// @autonoe/chain; cast keeps wagmi's stricter typing happy without redefining it.
const config = createConfig({
  chains: [hashkeyTestnet as never],
  connectors: [injected()],
  transports: {
    [hashkeyTestnet.id]: http(),
  },
});

export function Providers({ children }: { children: ReactNode }) {
  // Create the QueryClient once per app instance.
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          modalSize="compact"
          theme={darkTheme({
            accentColor: "#F59E0B",
            accentColorForeground: "#1b1305",
            borderRadius: "medium",
            overlayBlur: "small",
          })}
        >
          <WalletProvider>{children}</WalletProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
