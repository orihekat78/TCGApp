# 🤖 関係グラフ: engine ↔ specs

> ⚠️ このファイルは `scripts/gen-docs/gen-mapping.ts` により自動生成された。手で編集しない。
> 再生成: `npm run docs:mapping`
> Source hash: `02d42ce2f7a4`

engine namespace と仕様書の参照関係を Mermaid flowchart で表示。`cards-analysis/` 配下は 1:1 で量が多いため除外。Obsidian グラフビュー連携は [by-spec/](./by-spec/) / [by-engine/](./by-engine/) を参照。

```mermaid
flowchart LR
  subgraph engine["Engine Namespaces"]
    NS_cards["cards"]
    NS_effect["effect"]
    NS_event["event"]
    NS_flow["flow"]
    NS_listeners["listeners"]
    NS_resolve["resolve"]
    NS_types["types"]
  end
  subgraph specs["Specs"]
    S_card_authoring_convention_md["card-authoring-convention"]
    S_cards_data_INDEX_md["INDEX"]
    S_engine_api_atom_verbs_md["engine-api-atom-verbs"]
    S_engine_api_card_abilities_md["engine-api-card-abilities"]
    S_engine_api_card_shape_md["engine-api-card-shape"]
    S_engine_api_effect_descriptor_md["engine-api-effect-descriptor"]
    S_engine_api_events_md["engine-api-events"]
    S_engine_api_flow_contact_md["engine-api-flow-contact"]
    S_engine_api_flow_control_md["engine-api-flow-control"]
    S_engine_api_flow_setup_md["engine-api-flow-setup"]
    S_engine_api_resolver_md["engine-api-resolver"]
    S_refactor_plan_phase_3b_design_md["phase-3b-design"]
  end
  NS_cards -.-> S_cards_data_INDEX_md
  NS_cards -.-> S_engine_api_card_shape_md
  NS_effect -.-> S_card_authoring_convention_md
  NS_effect -.-> S_engine_api_atom_verbs_md
  NS_effect -.-> S_engine_api_effect_descriptor_md
  NS_effect -.-> S_engine_api_resolver_md
  NS_effect -.-> S_refactor_plan_phase_3b_design_md
  NS_event -.-> S_engine_api_events_md
  NS_flow -.-> S_engine_api_flow_contact_md
  NS_flow -.-> S_engine_api_flow_control_md
  NS_flow -.-> S_engine_api_flow_setup_md
  NS_listeners -.-> S_engine_api_card_abilities_md
  NS_resolve -.-> S_engine_api_resolver_md
  NS_types -.-> S_engine_api_card_shape_md
  NS_types -.-> S_engine_api_resolver_md
```
