"use client";

import { formatUnits } from "viem";
import { useWallet } from "@/components/wallet/WalletProvider";

/** Format a base-unit bigint balance to a readable string. */
function fmt(v: bigint, decimals: number, maxFrac: number): string {
  return Number(formatUnits(v, decimals)).toLocaleString(undefined, {
    maximumFractionDigits: maxFrac,
  });
}

export function Balances() {
  const wallet = useWallet();
  const b = wallet.balances;

  return (
    <section className="panel">
      <div className="phead">
        <span className="lab">Agent wallet · balances</span>
      </div>
      <div className="pbody">
        {b ? (
          <div className="balstrip">
            <div className="c">
              <div className="sy">
                <span className="b">$</span> mUSD
              </div>
              <div className="n">{fmt(b.mUSD, 6, 2)}</div>
              <div className="subv">stablecoin</div>
            </div>
            <div className="c">
              <div className="sy">
                <span className="b">W</span> WMNT
              </div>
              <div className="n">{fmt(b.wmnt, 18, 4)}</div>
              <div className="subv">wrapped MNT</div>
            </div>
            <div className="c">
              <div className="sy">
                <span className="b">M</span> MNT
              </div>
              <div className="n">{fmt(b.mnt, 18, 4)}</div>
              <div className="subv">gas</div>
            </div>
          </div>
        ) : (
          <div className="balstrip">
            <div className="c">
              <div className="subv">
                {wallet.isCreated
                  ? "Unlock the agent wallet to load live balances."
                  : "Create an agent wallet to start trading."}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
