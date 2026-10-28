------------------- MODULE SettlementBatchReconciliation -------------------
EXTENDS Naturals

VARIABLES
  escrowBalance,
  settledMerchantTotal,
  collectedPlatformFees,
  initialGrossCaptured

vars == <<escrowBalance, settledMerchantTotal, collectedPlatformFees, initialGrossCaptured>>

Init ==
  /\ initialGrossCaptured = 10000
  /\ escrowBalance = 10000
  /\ settledMerchantTotal = 0
  /\ collectedPlatformFees = 0

SettleBatch(merchantShare, feeShare) ==
  /\ escrowBalance > 0
  /\ merchantShare + feeShare = escrowBalance
  /\ settledMerchantTotal' = settledMerchantTotal + merchantShare
  /\ collectedPlatformFees' = collectedPlatformFees + feeShare
  /\ escrowBalance' = 0
  /\ UNCHANGED initialGrossCaptured

Next ==
  \/ SettleBatch(9750, 250)
  \/ UNCHANGED vars

Spec == Init /\ [][Next]_vars

\* CONSERVATION OF MONEY INVARIANT: Total funds across escrow, merchant, and fees never change.
ConservationOfFundsInvariant ==
  escrowBalance + settledMerchantTotal + collectedPlatformFees = initialGrossCaptured
=============================================================================
