// qaId=card:B02018:dc712167e0587386756f5293d40bf1766e89e09669554ebcde8e028749d962d4
// qaId=card:B02020:dc712167e0587386756f5293d40bf1766e89e09669554ebcde8e028749d962d4
// qaId=card:B02023:dc712167e0587386756f5293d40bf1766e89e09669554ebcde8e028749d962d4
// qaId=card:B02030:dc712167e0587386756f5293d40bf1766e89e09669554ebcde8e028749d962d4
// qaId=card:B02040:dc712167e0587386756f5293d40bf1766e89e09669554ebcde8e028749d962d4
// qaId=card:B03032:dc712167e0587386756f5293d40bf1766e89e09669554ebcde8e028749d962d4
// qaId=card:B03034:dc712167e0587386756f5293d40bf1766e89e09669554ebcde8e028749d962d4
// qaId=card:B03061:dc712167e0587386756f5293d40bf1766e89e09669554ebcde8e028749d962d4
// qaId=card:B05029:dc712167e0587386756f5293d40bf1766e89e09669554ebcde8e028749d962d4
// qaId=card:B05028:c5239a4966c1a53661d5744287332da9539d76ea368394a4953c8b8bfc6760d7
// qaId=card:PR136:cb2b6ed1081ffd2d13be25301f02d68c36004d38d7bbf4c4659ad8a2bdea9521
// qaId=card:PR142:cb2b6ed1081ffd2d13be25301f02d68c36004d38d7bbf4c4659ad8a2bdea9521
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { registerAll } from "@/cards";
import { engine } from "@/engine";
import { event } from "@/engine/event";
import { _clearPendingEffectPickQueue } from "@/engine/effect/resolve-picks";
import {
  _resetTriggeredRegistered,
  registerTriggeredListener,
} from "@/engine/listeners/triggered";
import { mutate } from "@/engine/mutate";
import { _resetUidCounter } from "@/engine/mutate/scene";
import { produce } from "@/engine/produce";
import { runAllUntilEmpty } from "@/engine/resolve";
import { createEmptyGameState } from "@/engine/state-factory";
import type { CardDef, GameState, PlayerSide } from "@/engine/types";
import { dispatchEngineAction } from "@/ui/hooks/useEngineDispatch";
import { bindPendingDecision } from "@/ui/hooks/useEngineDispatch/types";
import { useGameStateStore } from "@/ui/state/store";
import { dispatchCurrentDecision } from "../../helpers/dispatch-current-decision";
import { sceneChar } from "../../helpers/fixtures";

const COMMON =
  "dc712167e0587386756f5293d40bf1766e89e09669554ebcde8e028749d962d4";
const QA = {
  B02018: `card:B02018:${COMMON}`,
  B02020: `card:B02020:${COMMON}`,
  B02023: `card:B02023:${COMMON}`,
  B02030: `card:B02030:${COMMON}`,
  B02040: `card:B02040:${COMMON}`,
  B03032: `card:B03032:${COMMON}`,
  B03034: `card:B03034:${COMMON}`,
  B03061: `card:B03061:${COMMON}`,
  B05029: `card:B05029:${COMMON}`,
  B05028:
    "card:B05028:c5239a4966c1a53661d5744287332da9539d76ea368394a4953c8b8bfc6760d7",
  PR136:
    "card:PR136:cb2b6ed1081ffd2d13be25301f02d68c36004d38d7bbf4c4659ad8a2bdea9521",
  PR142:
    "card:PR142:cb2b6ed1081ffd2d13be25301f02d68c36004d38d7bbf4c4659ad8a2bdea9521",
} as const;

const SELF_SET = "QA_W3_SELF_SET";
const OPP_SET = "QA_W3_OPP_SET";
const SELF_TAIL = "QA_W3_SELF_TAIL";
const OPP_TAIL = "QA_W3_OPP_TAIL";
const SELF_HOST = "QA_W3_SELF_HOST";
const OPP_HOST = "QA_W3_OPP_HOST";
const VICTIM = "QA_W3_VICTIM";
const COST = ["QA_W3_COST_1", "QA_W3_COST_2", "QA_W3_COST_3"] as const;

function fixture(id: string, overrides: Partial<CardDef> = {}): CardDef {
  return {
    id,
    no: id,
    kind: "character",
    names: [id],
    colors: ["白"],
    level: 1,
    ap: 1000,
    lp: 1,
    traits: ["警察"],
    keywords: [],
    rarity: "T",
    imageUrl: "",
    abilities: [],
    ruleRefs: [],
    ...overrides,
  };
}

function base(): GameState {
  const state = createEmptyGameState();
  state.turn = {
    number: 3,
    player: "self",
    phase: "main",
    isFirstPlayerFirstTurn: false,
  };
  state.players.self.case.colors = ["白", "緑"];
  state.players.self.file = Array.from({ length: 10 }, () => ({
    type: "card-back",
    cardId: "FILE",
  }));
  state.players.self.deck = [SELF_SET, SELF_TAIL];
  state.players.opp.deck = [OPP_SET, OPP_TAIL];
  return state;
}

function install(state: GameState): void {
  useGameStateStore.getState().resetMatchSessionState();
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function dispatch(action: Parameters<typeof dispatchEngineAction>[0]): void {
  expect(dispatchEngineAction(action)).toEqual({ ok: true });
}

function pick(uid: string | null): void {
  expect(
    dispatchCurrentDecision({ type: "effectPickResolve", pickedUid: uid }),
  ).toEqual({ ok: true });
}

type LeaveProof = {
  owner: PlayerSide;
  cardId: string;
  faceUp: false;
  hostGone: true;
  removedByOwner: true;
  removedByOther: false;
};

function ownerOfSceneUid(state: GameState, uid: string): PlayerSide {
  return state.players.self.scene.some((character) => character.uid === uid)
    ? "self"
    : "opp";
}

function finishOpenAction(): void {
  for (let step = 0; step < 12; step += 1) {
    const store = useGameStateStore.getState();
    const actionId = store.activeActionId;
    if (!actionId) return;
    const state = store.gameState!;
    const action = state.actionContexts?.[actionId];
    if (!action) return;
    if (action.phase === "action-1" || action.phase === "action-2") {
      const acted =
        action.phase === "action-1" ? action.firstActed : action.secondActed;
      const uid =
        action.phase === "action-1" ? action.firstUid : action.secondUid;
      if (acted === undefined) {
        expect(uid).toBeTruthy();
        dispatch({
          type: "actionContact",
          actionId,
          player: ownerOfSceneUid(state, uid!),
          choice: { kind: "pass" },
        });
      }
      dispatch({ type: "actionAdvance", actionId });
      continue;
    }
    if (action.phase === "action-1-redo") {
      if (action.firstRedoActed === undefined) {
        expect(action.firstUid).toBeTruthy();
        dispatch({
          type: "actionContact",
          actionId,
          player: ownerOfSceneUid(state, action.firstUid!),
          choice: { kind: "pass" },
        });
      }
      dispatch({ type: "actionAdvance", actionId });
      continue;
    }
    if (action.phase === "judge" && action.judgeResolved !== true) {
      dispatch({ type: "actionJudge", actionId });
      continue;
    }
    dispatch({ type: "actionAdvance", actionId });
  }
  throw new Error("public contact did not reach action-end");
}

function leaveProof(
  owner: PlayerSide,
  hostUid: string,
  cardId: string,
): LeaveProof {
  const beforeActionEnd = useGameStateStore.getState().gameState!;
  const host = beforeActionEnd.players[owner].scene.find(
    (character) => character.uid === hostUid,
  )!;
  const setCard = host.setCards.find((card) => card.cardId === cardId)!;
  finishOpenAction();
  if (
    useGameStateStore
      .getState()
      .gameState!.players[owner].scene.some(
        (character) => character.uid === hostUid,
      )
  ) {
    const ready = produce(useGameStateStore.getState().gameState!, (draft) => {
      draft.players.self.scene.push(
        sceneChar("B10022", `public-remover-${owner}-${hostUid}`, {
          state: "active",
        }),
      );
    });
    expect(useGameStateStore.getState().setGameState(ready)).toBe(true);
    dispatch({
      type: "declaredAbility",
      uid: `public-remover-${owner}-${hostUid}`,
      abilId: "a1",
    });
    expect(
      useGameStateStore
        .getState()
        .pendingEffectPick?.candidates.some(
          (candidate) => candidate.uid === hostUid,
        ),
    ).toBe(true);
    pick(hostUid);
  }
  const after = useGameStateStore.getState().gameState!;
  const other = owner === "self" ? "opp" : "self";
  return {
    owner,
    cardId: setCard.cardId,
    faceUp: setCard.faceUp as false,
    hostGone: !after.players[owner].scene.some(
      (character) => character.uid === hostUid,
    ),
    removedByOwner: after.players[owner].remove.includes(cardId),
    removedByOther: after.players[other].remove.includes(cardId),
  };
}

function enter(cardId: string): string {
  dispatch({ type: "handUseCard", player: "self", cardId });
  return useGameStateStore
    .getState()
    .gameState!.players.self.scene.find(
      (character) => character.cardId === cardId,
    )!.uid;
}

function startContact(attackerUid: string, targetUid: string): string {
  dispatch({ type: "actionDeclareChar", byUid: attackerUid, targetUid });
  const actionId = useGameStateStore.getState().activeActionId!;
  dispatch({ type: "actionGuard", actionId, guarderUid: null });
  dispatch({ type: "actionAdvance", actionId });
  dispatch({ type: "actionAdvance", actionId });
  return actionId;
}

function finishContact(actionId: string): void {
  dispatch({
    type: "actionContact",
    actionId,
    player: "opp",
    choice: { kind: "pass" },
  });
  dispatch({ type: "actionAdvance", actionId });
  dispatch({
    type: "actionContact",
    actionId,
    player: "self",
    choice: { kind: "pass" },
  });
  dispatch({ type: "actionAdvance", actionId });
  dispatch({ type: "actionJudge", actionId });
}

function startB03034(): void {
  const state = base();
  state.players.self.scene = [
    sceneChar(SELF_HOST, "attacker", { state: "active" }),
  ];
  state.players.opp.scene = [
    sceneChar(OPP_HOST, "contact-target", { state: "sleep" }),
    sceneChar(OPP_HOST, "contact-decoy", { state: "sleep" }),
  ];
  state.players.self.hand = ["B03034"];
  install(state);
  const actionId = startContact("attacker", "contact-target");
  dispatch({
    type: "actionContact",
    actionId,
    player: "self",
    choice: { kind: "cutin", cardId: "B03034" },
  });
}

function contactRemoval(
  cardId: "PR136" | "PR142",
  pickedHost: PlayerSide,
): LeaveProof {
  const state = base();
  state.players.self.scene = [
    sceneChar(cardId, "iori", { state: "active" }),
    sceneChar(SELF_HOST, "self-host", { state: "active" }),
  ];
  state.players.opp.scene = [
    sceneChar(VICTIM, "victim", { state: "sleep" }),
    sceneChar(OPP_HOST, "opp-host", { state: "active" }),
  ];
  install(state);
  finishContact(startContact("iori", "victim"));
  const hostUid = pickedHost === "self" ? "self-host" : "opp-host";
  pick(hostUid);
  return leaveProof(
    pickedHost,
    hostUid,
    pickedHost === "self" ? SELF_SET : OPP_SET,
  );
}

function proveOptionalSelf(
  cardId: "B02023" | "B02030" | "B05029",
  abilityId: "a1" | "a2",
  route: "enter" | "declared",
): LeaveProof {
  const state = base();
  state.players.self.scene = [sceneChar(SELF_HOST, "self-host")];
  if (route === "enter") state.players.self.hand = [cardId];
  else state.players.self.scene.unshift(sceneChar(cardId, "source"));
  install(state);
  if (route === "enter") enter(cardId);
  else dispatch({ type: "declaredAbility", uid: "source", abilId: abilityId });
  pick("self-host");
  return leaveProof("self", "self-host", SELF_SET);
}

function proveOptionalOpponent(cardId: "B02020" | "B03032"): LeaveProof {
  const state = base();
  state.players.self.hand = [cardId];
  state.players.opp.scene = [sceneChar(OPP_HOST, "opp-host")];
  install(state);
  enter(cardId);
  pick("opp-host");
  return leaveProof("opp", "opp-host", OPP_SET);
}

beforeEach(() => {
  engine.cards._resetRegistry();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _clearPendingEffectPickQueue();
  _resetUidCounter();
  registerAll();
  for (const id of [
    SELF_SET,
    OPP_SET,
    SELF_TAIL,
    OPP_TAIL,
    SELF_HOST,
    ...COST,
  ]) {
    engine.cards.register(fixture(id));
  }
  engine.cards.register(fixture(OPP_HOST, { ap: 1500 }));
  engine.cards.register(fixture(VICTIM, { colors: ["緑"] }));
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: PlayerSide | null }).__humanPlayerSide =
    "self";
  useGameStateStore.getState().resetMatchSessionState();
});

afterEach(() => {
  (globalThis as { __humanPlayerSide?: PlayerSide | null }).__humanPlayerSide =
    null;
  useGameStateStore.getState().resetMatchSessionState();
});

describe("official set-card host ownership through public dispatch", () => {
  it(`${QA.B02018}: fixed self host`, () => {
    const state = base();
    state.players.self.scene = [sceneChar("B02018", "source")];
    state.players.self.deck = [...COST, SELF_SET, SELF_TAIL];
    install(state);
    dispatch({ type: "declaredAbility", uid: "source", abilId: "a2" });
    if (useGameStateStore.getState().pendingEffectChoice) {
      expect(
        dispatchCurrentDecision({ type: "choiceResolve", choiceIndex: 0 }),
      ).toEqual({ ok: true });
    }
    expect(leaveProof("self", "source", SELF_SET), QA.B02018).toEqual({
      owner: "self",
      cardId: SELF_SET,
      faceUp: false,
      hostGone: true,
      removedByOwner: true,
      removedByOther: false,
    });
  });

  it(`${QA.B03061}: entering source is fixed self host`, () => {
    const state = base();
    state.players.self.hand = ["B03061"];
    install(state);
    const uid = enter("B03061");
    expect(leaveProof("self", uid, SELF_SET), QA.B03061).toEqual({
      owner: "self",
      cardId: SELF_SET,
      faceUp: false,
      hostGone: true,
      removedByOwner: true,
      removedByOther: false,
    });
  });

  it(`${QA.B02023}: optional self host`, () => {
    expect(proveOptionalSelf("B02023", "a1", "enter"), QA.B02023).toEqual({
      owner: "self",
      cardId: SELF_SET,
      faceUp: false,
      hostGone: true,
      removedByOwner: true,
      removedByOther: false,
    });
  });

  it(`${QA.B02030}: optional self host`, () => {
    expect(proveOptionalSelf("B02030", "a2", "declared"), QA.B02030).toEqual({
      owner: "self",
      cardId: SELF_SET,
      faceUp: false,
      hostGone: true,
      removedByOwner: true,
      removedByOther: false,
    });
  });

  it(`${QA.B05029}: optional self host`, () => {
    expect(proveOptionalSelf("B05029", "a1", "declared"), QA.B05029).toEqual({
      owner: "self",
      cardId: SELF_SET,
      faceUp: false,
      hostGone: true,
      removedByOwner: true,
      removedByOther: false,
    });
  });

  it(`${QA.B02020}: optional opponent host`, () => {
    expect(proveOptionalOpponent("B02020"), QA.B02020).toEqual({
      owner: "opp",
      cardId: OPP_SET,
      faceUp: false,
      hostGone: true,
      removedByOwner: true,
      removedByOther: false,
    });
  });

  it(`${QA.B03032}: optional opponent host`, () => {
    expect(proveOptionalOpponent("B03032"), QA.B03032).toEqual({
      owner: "opp",
      cardId: OPP_SET,
      faceUp: false,
      hostGone: true,
      removedByOwner: true,
      removedByOther: false,
    });
  });

  it(`${QA.B02040}: filtered white self host`, () => {
    const state = base();
    state.players.self.scene = [
      sceneChar("B02040", "source"),
      sceneChar(SELF_HOST, "white-host"),
      sceneChar(VICTIM, "nonwhite-host"),
    ];
    install(state);
    dispatch({ type: "declaredAbility", uid: "source", abilId: "a2" });
    if (useGameStateStore.getState().pendingEffectChoice) {
      expect(
        dispatchCurrentDecision({ type: "choiceResolve", choiceIndex: 0 }),
      ).toEqual({ ok: true });
    }
    expect(
      useGameStateStore
        .getState()
        .pendingEffectPick?.candidates.map((candidate) => candidate.uid),
    ).toEqual(["white-host"]);
    pick("white-host");
    expect(leaveProof("self", "white-host", SELF_SET), QA.B02040).toEqual({
      owner: "self",
      cardId: SELF_SET,
      faceUp: false,
      hostGone: true,
      removedByOwner: true,
      removedByOther: false,
    });
  });

  it(`${QA.B03034}: selected contact target is opponent host`, () => {
    startB03034();
    expect(
      useGameStateStore
        .getState()
        .pendingEffectPick?.candidates.map((candidate) => candidate.uid),
    ).toEqual(["contact-target"]);
    pick("contact-target");
    expect(leaveProof("opp", "contact-target", OPP_SET), QA.B03034).toEqual({
      owner: "opp",
      cardId: OPP_SET,
      faceUp: false,
      hostGone: true,
      removedByOwner: true,
      removedByOther: false,
    });
  });

  it(`${QA.B05028}: sequential self and opponent hosts use their own decks`, () => {
    const state = base();
    state.players.self.scene = [
      sceneChar("B05028", "source"),
      sceneChar(SELF_HOST, "self-host"),
    ];
    state.players.opp.scene = [sceneChar(OPP_HOST, "opp-host")];
    install(state);
    dispatch({ type: "declaredAbility", uid: "source", abilId: "a2" });
    pick("self-host");
    pick("opp-host");
    const selfProof = leaveProof("self", "self-host", SELF_SET);
    const oppProof = leaveProof("opp", "opp-host", OPP_SET);
    expect([selfProof, oppProof], QA.B05028).toEqual([
      {
        owner: "self",
        cardId: SELF_SET,
        faceUp: false,
        hostGone: true,
        removedByOwner: true,
        removedByOther: false,
      },
      {
        owner: "opp",
        cardId: OPP_SET,
        faceUp: false,
        hostGone: true,
        removedByOwner: true,
        removedByOther: false,
      },
    ]);
  });

  it(`${QA.PR136}: contact removal then self picked host`, () => {
    expect(contactRemoval("PR136", "self"), QA.PR136).toEqual({
      owner: "self",
      cardId: SELF_SET,
      faceUp: false,
      hostGone: true,
      removedByOwner: true,
      removedByOther: false,
    });
  });

  it(`${QA.PR142}: contact removal then opponent picked host`, () => {
    expect(contactRemoval("PR142", "opp"), QA.PR142).toEqual({
      owner: "opp",
      cardId: OPP_SET,
      faceUp: false,
      hostGone: true,
      removedByOwner: true,
      removedByOther: false,
    });
  });
});

describe("set-card routing negatives", () => {
  it("optional self route permits zero selection", () => {
    const state = base();
    state.players.self.scene = [
      sceneChar("B02030", "source"),
      sceneChar(SELF_HOST, "self-host"),
    ];
    install(state);
    dispatch({ type: "declaredAbility", uid: "source", abilId: "a2" });
    pick(null);
    expect(useGameStateStore.getState().gameState!.players.self.deck).toEqual([
      SELF_SET,
      SELF_TAIL,
    ]);
    expect(
      useGameStateStore.getState().gameState!.players.self.scene[1]!.setCards,
    ).toEqual([]);
  });

  it("no opponent candidates resolves without moving deck top", () => {
    const state = base();
    state.players.self.hand = ["B02020"];
    install(state);
    enter("B02020");
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(useGameStateStore.getState().gameState!.players.opp.deck).toEqual([
      OPP_SET,
      OPP_TAIL,
    ]);
  });

  it("stale host decision cannot move deck top", () => {
    const state = base();
    state.players.self.scene = [
      sceneChar("B02030", "source"),
      sceneChar(SELF_HOST, "self-host"),
    ];
    install(state);
    dispatch({ type: "declaredAbility", uid: "source", abilId: "a2" });
    const pending = useGameStateStore.getState().pendingEffectPick!;
    const withoutHost = produce(
      useGameStateStore.getState().gameState!,
      (draft) => {
        mutate.scene.removeToRemove(draft, "self-host", "effect");
        runAllUntilEmpty(draft);
      },
    );
    useGameStateStore.getState().setGameState(withoutHost);
    expect(
      dispatchEngineAction(
        bindPendingDecision(pending, {
          type: "effectPickResolve",
          pickedUid: "self-host",
        }),
      ),
    ).toEqual({ ok: false, reason: "not-allowed" });
    expect(useGameStateStore.getState().gameState!.players.self.deck).toEqual([
      SELF_SET,
      SELF_TAIL,
    ]);
  });

  it(`${QA.B03034}: contact target may be skipped`, () => {
    startB03034();
    pick(null);
    expect(useGameStateStore.getState().gameState!.players.opp.deck).toEqual([
      OPP_SET,
      OPP_TAIL,
    ]);
    expect(
      useGameStateStore
        .getState()
        .gameState!.players.opp.scene.flatMap(
          (character) => character.setCards,
        ),
    ).toEqual([]);
  });

  it("fixed self route with empty deck does not invent a set card", () => {
    const state = base();
    state.players.self.hand = ["B03061"];
    state.players.self.deck = [];
    install(state);
    const uid = enter("B03061");
    expect(
      useGameStateStore
        .getState()
        .gameState!.players.self.scene.find(
          (character) => character.uid === uid,
        )?.setCards,
    ).toEqual([]);
  });
});
