# 🤖 関係グラフ (engine-flow) ↔ rules

> ⚠️ このファイルは `scripts/gen-docs/gen-mapping.ts` により自動生成された。手で編集しない。
> 再生成: `npm run docs:mapping`
> Source hash: `4ab48996bf86`

engine namespace effect / flow / invariant / dyn / target / cost / cond / resolve と公式ルールの参照関係を Mermaid flowchart で表示。Obsidian グラフビュー連携は [by-rule/](./by-rule/) / [by-engine/](./by-engine/) を参照。

```mermaid
flowchart LR
  subgraph engine["Engine Namespaces"]
    NS_cond["cond"]
    NS_cost["cost"]
    NS_dyn["dyn"]
    NS_effect["effect"]
    NS_flow["flow"]
    NS_invariant["invariant"]
    NS_resolve["resolve"]
    NS_target["target"]
  end
  subgraph rules["Rules"]
    R_01_victory_conditions_md["01-victory-conditions"]
    R_02_deck_construction_md["02-deck-construction"]
    R_03_field_areas_md["03-field-areas"]
    R_04_game_setup_md["04-game-setup"]
    R_05_turn_phases_md["05-turn-phases"]
    R_06_card_types_md["06-card-types"]
    R_07_action_flow_md["07-action-flow"]
    R_08_contact_md["08-contact"]
    R_09_cutin_disguise_md["09-cutin-disguise"]
    R_10_action_event_md["10-action-event"]
    R_12_next_hint_md["12-next-hint"]
    R_13_keywords_md["13-keywords"]
    R_15_abilities_effects_md["15-abilities-effects"]
    R_17_icons_md["17-icons"]
    R_18_mr_md["18-mr"]
    R_19_special_rules_md["19-special-rules"]
    R_20_color_and_switch_md["20-color-and-switch"]
    R_21_declared_ability_cost_md["21-declared-ability-cost"]
    R_22_qa_action_contact_md["22-qa-action-contact"]
    R_23_qa_disguise_cutin_md["23-qa-disguise-cutin"]
    R_24_qa_naming_stun_md["24-qa-naming-stun"]
    R_25_qa_effects_resolution_md["25-qa-effects-resolution"]
    R_26_qa_deck_refresh_md["26-qa-deck-refresh"]
  end
  NS_cond --> R_13_keywords_md
  NS_cond --> R_15_abilities_effects_md
  NS_cond --> R_17_icons_md
  NS_cond --> R_18_mr_md
  NS_cond --> R_19_special_rules_md
  NS_cond --> R_25_qa_effects_resolution_md
  NS_cost --> R_21_declared_ability_cost_md
  NS_cost --> R_25_qa_effects_resolution_md
  NS_cost --> R_26_qa_deck_refresh_md
  NS_dyn --> R_15_abilities_effects_md
  NS_effect --> R_10_action_event_md
  NS_effect --> R_15_abilities_effects_md
  NS_effect --> R_17_icons_md
  NS_effect --> R_21_declared_ability_cost_md
  NS_effect --> R_25_qa_effects_resolution_md
  NS_flow --> R_01_victory_conditions_md
  NS_flow --> R_02_deck_construction_md
  NS_flow --> R_03_field_areas_md
  NS_flow --> R_04_game_setup_md
  NS_flow --> R_05_turn_phases_md
  NS_flow --> R_06_card_types_md
  NS_flow --> R_07_action_flow_md
  NS_flow --> R_08_contact_md
  NS_flow --> R_09_cutin_disguise_md
  NS_flow --> R_10_action_event_md
  NS_flow --> R_12_next_hint_md
  NS_flow --> R_13_keywords_md
  NS_flow --> R_15_abilities_effects_md
  NS_flow --> R_17_icons_md
  NS_flow --> R_20_color_and_switch_md
  NS_flow --> R_21_declared_ability_cost_md
  NS_flow --> R_22_qa_action_contact_md
  NS_flow --> R_23_qa_disguise_cutin_md
  NS_flow --> R_24_qa_naming_stun_md
  NS_invariant --> R_01_victory_conditions_md
  NS_invariant --> R_03_field_areas_md
  NS_invariant --> R_06_card_types_md
  NS_invariant --> R_13_keywords_md
  NS_invariant --> R_20_color_and_switch_md
  NS_invariant --> R_26_qa_deck_refresh_md
  NS_resolve --> R_15_abilities_effects_md
  NS_resolve --> R_25_qa_effects_resolution_md
  NS_target --> R_15_abilities_effects_md
  NS_target --> R_19_special_rules_md
```
