import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("X402EscrowModule", (m) => {
  const escrow = m.contract("X402Escrow", []);

  return { escrow };
});