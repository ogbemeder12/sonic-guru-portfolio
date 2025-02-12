export const RockPaperScissorsIDL = {
  version: "0.1.0",
  name: "rock_paper_scissors",
  instructions: [
    {
      name: "createBet",
      accounts: [
        { name: "bet", isMut: true, isSigner: true },
        { name: "creator", isMut: true, isSigner: true },
        { name: "escrow", isMut: true, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false }
      ],
      args: [
        { name: "betId", type: "u64" },
        { name: "betAmount", type: "u64" }
      ]
    },
    {
      name: "joinBet",
      accounts: [
        { name: "bet", isMut: true, isSigner: false },
        { name: "player", isMut: true, isSigner: true },
        { name: "escrow", isMut: true, isSigner: false }
      ],
      args: [{ name: "choice", type: "u8" }]
    },
    {
      name: "resolveBet",
      accounts: [
        { name: "bet", isMut: true, isSigner: false },
        { name: "escrow", isMut: true, isSigner: false }
      ],
      args: []
    }
  ],
  accounts: [
    {
      name: "EscrowAccount",
      type: {
        kind: "struct",
        fields: [{ name: "authority", type: "publicKey" }]
      }
    },
    {
      name: "Bet",
      type: {
        kind: "struct",
        fields: [
          { name: "betId", type: "u64" },
          { name: "creator", type: "publicKey" },
          { name: "betAmount", type: "u64" },
          { name: "maxPlayers", type: "u8" },
          { name: "currentPlayers", type: "u8" },
          { name: "players", type: { vec: { defined: "Player" } } },
          { name: "state", type: { defined: "BetState" } },
          { name: "escrowAccount", type: "publicKey" }
        ]
      }
    }
  ],
  types: [
    {
      name: "Player",
      type: {
        kind: "struct",
        fields: [
          { name: "player", type: "publicKey" },
          { name: "choice", type: "u8" }
        ]
      }
    },
    {
      name: "BetState",
      type: {
        kind: "enum",
        variants: [
          { name: "Open" },
          { name: "InProgress" },
          { name: "Completed" }
        ]
      }
    }
  ],
  errors: [
    { code: 6000, name: "BetNotOpen", msg: "Bet is not open." },
    { code: 6001, name: "BetFull", msg: "Bet is full." },
    { code: 6002, name: "BetNotInProgress", msg: "Bet is not in progress." },
    { code: 6003, name: "InvalidChoice", msg: "Invalid choice." },
    { code: 6004, name: "NoWinner", msg: "No winner, replay required." }
  ]
} as const;

export const PROGRAM_ID = "FJziisRdYuEkRdshWns1qTMbGGryyGdE5KPiAcv6sF1G";
