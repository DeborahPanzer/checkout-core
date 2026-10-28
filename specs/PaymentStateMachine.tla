------------------------ MODULE PaymentStateMachine ------------------------
EXTENDS Naturals, Sequences

VARIABLES
  intentState,       \* Current state: "CREATED", "AUTHORIZED", "CAPTURED", "CANCELED"
  capturedCount,     \* Total number of successful captures executed
  ledgerBalanced     \* Boolean invariant indicating zero-sum ledger state

vars == <<intentState, capturedCount, ledgerBalanced>>

States == {"CREATED", "AUTHORIZED", "CAPTURED", "CANCELED"}

Init ==
  /\ intentState = "CREATED"
  /\ capturedCount = 0
  /\ ledgerBalanced = TRUE

Authorize ==
  /\ intentState = "CREATED"
  /\ intentState' = "AUTHORIZED"
  /\ UNCHANGED <<capturedCount, ledgerBalanced>>

Capture ==
  /\ intentState = "AUTHORIZED"
  /\ capturedCount = 0
  /\ intentState' = "CAPTURED"
  /\ capturedCount' = capturedCount + 1
  /\ ledgerBalanced' = TRUE

Cancel ==
  /\ intentState \in {"CREATED", "AUTHORIZED"}
  /\ intentState' = "CANCELED"
  /\ UNCHANGED <<capturedCount, ledgerBalanced>>

IdempotentDuplicateCapture ==
  /\ intentState = "CAPTURED"
  /\ UNCHANGED vars

Next ==
  \/ Authorize
  \/ Capture
  \/ Cancel
  \/ IdempotentDuplicateCapture

Spec == Init /\ [][Next]_vars

\* SAFETY INVARIANT: A payment intent can never be captured more than once.
NoDoubleCaptureInvariant == capturedCount <= 1

\* SAFETY INVARIANT: Captured state strictly implies exactly one capture event and balanced ledger.
CaptureConsistencyInvariant ==
  (intentState = "CAPTURED") => (capturedCount = 1 /\ ledgerBalanced = TRUE)
=============================================================================
