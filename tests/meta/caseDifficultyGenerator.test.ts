import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

interface OfficialCaseStub {
  type: string;
  card_num: string;
  card_id: string;
  difficulty_first: string | null;
  difficulty_second: string | null;
}

type DifficultyEntry = [string, { first: number; second: number }];

const require = createRequire(import.meta.url);
const { collectCaseDifficulties } = require(
  "../../scripts/cards/generate-case-difficulties.cjs",
) as {
  collectCaseDifficulties: (
    cards: OfficialCaseStub[],
  ) => DifficultyEntry[];
};

describe("official case difficulty generator", () => {
  it("preserves zero and inherits a unique official pair by card ID", () => {
    expect(
      collectCaseDifficulties([
        {
          type: "事件",
          card_num: "B09107P",
          card_id: "0106",
          difficulty_first: "0",
          difficulty_second: "0",
        },
        {
          type: "事件",
          card_num: "B02015",
          card_id: "0187",
          difficulty_first: "7",
          difficulty_second: "6",
        },
        {
          type: "事件",
          card_num: "PR211",
          card_id: "0187",
          difficulty_first: null,
          difficulty_second: null,
        },
      ]),
    ).toEqual([
      ["B02015", { first: 7, second: 6 }],
      ["B09107P", { first: 0, second: 0 }],
      ["PR211", { first: 7, second: 6 }],
    ]);
  });

  it("rejects a missing pair when the shared official ID is ambiguous", () => {
    expect(() =>
      collectCaseDifficulties([
        {
          type: "事件",
          card_num: "A",
          card_id: "same",
          difficulty_first: "7",
          difficulty_second: "6",
        },
        {
          type: "事件",
          card_num: "B",
          card_id: "same",
          difficulty_first: "6",
          difficulty_second: "5",
        },
        {
          type: "事件",
          card_num: "C",
          card_id: "same",
          difficulty_first: null,
          difficulty_second: null,
        },
      ]),
    ).toThrow("unresolvable official case difficulty: C (same)");
  });
});
