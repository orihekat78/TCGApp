// cards/_reuse — catalog-reuse バッチ (手書き, card-condition-catalog 流用) + engine-extension #1 batch
// 284 件 catalog-reuse + 10 件 engine-extension #1 (leave:to-remove batch) = 294 件。
// catalog-reuse はスキャン生成 (.tmp/reuse/build-barrel.cjs)、engine-extension #1 batch は手書き。
// 各カードは header に "catalog-reuse batch" または "engine-extension #1 leave:to-remove batch" マーカ。
import type { CardDef } from '@/engine/types';

import { D01003 } from '../ct-d01/D01003.js';
import { D01004 } from '../ct-d01/D01004.js';
import { D01006 } from '../ct-d01/D01006.js';
import { D01010 } from '../ct-d01/D01010.js';
import { D01015 } from '../ct-d01/D01015.js';
import { D02002 } from '../ct-d02/D02002.js';
import { D02009 } from '../ct-d02/D02009.js';
import { D02013 } from '../ct-d02/D02013.js';
import { D02015 } from '../ct-d02/D02015.js';
import { D03002 } from '../ct-d03/D03002.js';
import { D03010 } from '../ct-d03/D03010.js';
import { D03011 } from '../ct-d03/D03011.js';
import { D03015 } from '../ct-d03/D03015.js';
import { D04002 } from '../ct-d04/D04002.js';
import { D04004 } from '../ct-d04/D04004.js';
import { D04008 } from '../ct-d04/D04008.js';
import { D04015 } from '../ct-d04/D04015.js';
import { D05002 } from '../ct-d05/D05002.js';
import { D05004 } from '../ct-d05/D05004.js';
import { D05011 } from '../ct-d05/D05011.js';
import { D05015 } from '../ct-d05/D05015.js';
import { D06005 } from '../ct-d06/D06005.js';
import { D06006 } from '../ct-d06/D06006.js';
import { D06010 } from '../ct-d06/D06010.js';
import { D06011 } from '../ct-d06/D06011.js';
import { D06015 } from '../ct-d06/D06015.js';
import { D06017 } from '../ct-d06/D06017.js';
import { D06018 } from '../ct-d06/D06018.js';
import { D06019 } from '../ct-d06/D06019.js';
import { D06020 } from '../ct-d06/D06020.js';
import { D06022 } from '../ct-d06/D06022.js';
import { D06024 } from '../ct-d06/D06024.js';
import { D07004 } from '../ct-d07/D07004.js';
import { D07005 } from '../ct-d07/D07005.js';
import { D07016 } from '../ct-d07/D07016.js';
import { D07017 } from '../ct-d07/D07017.js';
import { D07022 } from '../ct-d07/D07022.js';
import { D09006 } from '../ct-d09/D09006.js';
import { D09007 } from '../ct-d09/D09007.js';
import { D09008 } from '../ct-d09/D09008.js';
import { D09009 } from '../ct-d09/D09009.js';
import { D09022 } from '../ct-d09/D09022.js';
import { D09023 } from '../ct-d09/D09023.js';
import { D09026 } from '../ct-d09/D09026.js';
import { D10012 } from '../ct-d10/D10012.js';
import { D10025 } from '../ct-d10/D10025.js';
import { B01008 } from '../ct-p01/B01008.js';
import { B01027 } from '../ct-p01/B01027.js';
import { B01028 } from '../ct-p01/B01028.js';
import { B01028P } from '../ct-p01/B01028P.js';
import { B01029 } from '../ct-p01/B01029.js';
import { B01032 } from '../ct-p01/B01032.js';
import { B01040 } from '../ct-p01/B01040.js';
import { B01040P } from '../ct-p01/B01040P.js';
import { B01046 } from '../ct-p01/B01046.js';
import { B01049 } from '../ct-p01/B01049.js';
import { B01063 } from '../ct-p01/B01063.js';
import { B01064 } from '../ct-p01/B01064.js';
import { B01083 } from '../ct-p01/B01083.js';
import { B01087 } from '../ct-p01/B01087.js';
import { B01088 } from '../ct-p01/B01088.js';
import { B01091 } from '../ct-p01/B01091.js';
import { B01094 } from '../ct-p01/B01094.js';
import { B01094P } from '../ct-p01/B01094P.js';
import { B01099 } from '../ct-p01/B01099.js';
import { B01099P } from '../ct-p01/B01099P.js';
import { B01100 } from '../ct-p01/B01100.js';
import { B01100P } from '../ct-p01/B01100P.js';
import { B01101 } from '../ct-p01/B01101.js';
import { B01101P } from '../ct-p01/B01101P.js';
import { B01102 } from '../ct-p01/B01102.js';
import { B01102P } from '../ct-p01/B01102P.js';
import { B02009 } from '../ct-p02/B02009.js';
import { B02010 } from '../ct-p02/B02010.js';
import { B02032 } from '../ct-p02/B02032.js';
import { B02051 } from '../ct-p02/B02051.js';
import { B02060 } from '../ct-p02/B02060.js';
import { B02061 } from '../ct-p02/B02061.js';
import { B02074 } from '../ct-p02/B02074.js';
import { B02074P } from '../ct-p02/B02074P.js';
import { B02082 } from '../ct-p02/B02082.js';
import { B02089 } from '../ct-p02/B02089.js';
import { B02089P } from '../ct-p02/B02089P.js';
import { B02090 } from '../ct-p02/B02090.js';
import { B02091 } from '../ct-p02/B02091.js';
import { B03004 } from '../ct-p03/B03004.js';
import { B03009 } from '../ct-p03/B03009.js';
import { B03010 } from '../ct-p03/B03010.js';
import { B03010P } from '../ct-p03/B03010P.js';
import { B03011 } from '../ct-p03/B03011.js';
import { B03015 } from '../ct-p03/B03015.js';
import { B03015P } from '../ct-p03/B03015P.js';
import { B03021 } from '../ct-p03/B03021.js';
import { B03021P } from '../ct-p03/B03021P.js';
import { B03022 } from '../ct-p03/B03022.js';
import { B03022P } from '../ct-p03/B03022P.js';
import { B03026 } from '../ct-p03/B03026.js';
import { B03037 } from '../ct-p03/B03037.js';
import { B03043 } from '../ct-p03/B03043.js';
import { B03048 } from '../ct-p03/B03048.js';
import { B03048P } from '../ct-p03/B03048P.js';
import { B03054 } from '../ct-p03/B03054.js';
import { B03054P } from '../ct-p03/B03054P.js';
import { B03055 } from '../ct-p03/B03055.js';
import { B03060 } from '../ct-p03/B03060.js';
import { B03060P } from '../ct-p03/B03060P.js';
import { B03064 } from '../ct-p03/B03064.js';
import { B03067 } from '../ct-p03/B03067.js';
import { B03067P } from '../ct-p03/B03067P.js';
import { B03074 } from '../ct-p03/B03074.js';
import { B03082 } from '../ct-p03/B03082.js';
import { B03087 } from '../ct-p03/B03087.js';
import { B03087P } from '../ct-p03/B03087P.js';
import { B03100 } from '../ct-p03/B03100.js';
import { B03103 } from '../ct-p03/B03103.js';
import { B03103P } from '../ct-p03/B03103P.js';
import { B03105 } from '../ct-p03/B03105.js';
import { B03114 } from '../ct-p03/B03114.js';
import { B03114P } from '../ct-p03/B03114P.js';
import { B03125 } from '../ct-p03/B03125.js';
import { B03127 } from '../ct-p03/B03127.js';
import { B03136 } from '../ct-p03/B03136.js';
import { B03137 } from '../ct-p03/B03137.js';
import { B03138 } from '../ct-p03/B03138.js';
import { B04005 } from '../ct-p04/B04005.js';
import { B04005P } from '../ct-p04/B04005P.js';
import { B04008 } from '../ct-p04/B04008.js';
import { B04009 } from '../ct-p04/B04009.js';
import { B04020 } from '../ct-p04/B04020.js';
import { B04025 } from '../ct-p04/B04025.js';
import { B04035 } from '../ct-p04/B04035.js';
import { B04035P } from '../ct-p04/B04035P.js';
import { B04036 } from '../ct-p04/B04036.js';
import { B04047 } from '../ct-p04/B04047.js';
import { B04047P } from '../ct-p04/B04047P.js';
import { B04050 } from '../ct-p04/B04050.js';
import { B04050P } from '../ct-p04/B04050P.js';
import { B04052 } from '../ct-p04/B04052.js';
import { B04052P } from '../ct-p04/B04052P.js';
import { B04054 } from '../ct-p04/B04054.js';
import { B04054P } from '../ct-p04/B04054P.js';
import { B04056 } from '../ct-p04/B04056.js';
import { B04056P } from '../ct-p04/B04056P.js';
import { B04060 } from '../ct-p04/B04060.js';
import { B04070 } from '../ct-p04/B04070.js';
import { B04070P } from '../ct-p04/B04070P.js';
import { B04071 } from '../ct-p04/B04071.js';
import { B04071P } from '../ct-p04/B04071P.js';
import { B04080 } from '../ct-p04/B04080.js';
import { B04096 } from '../ct-p04/B04096.js';
import { B04096P } from '../ct-p04/B04096P.js';
import { B05018 } from '../ct-p05/B05018.js';
import { B05018P } from '../ct-p05/B05018P.js';
import { B05037 } from '../ct-p05/B05037.js';
import { B05038 } from '../ct-p05/B05038.js';
import { B05055 } from '../ct-p05/B05055.js';
import { B05067 } from '../ct-p05/B05067.js';
import { B05067P } from '../ct-p05/B05067P.js';
import { B05069 } from '../ct-p05/B05069.js';
import { B05071 } from '../ct-p05/B05071.js';
import { B05083 } from '../ct-p05/B05083.js';
import { B05083P } from '../ct-p05/B05083P.js';
import { B05089 } from '../ct-p05/B05089.js';
import { B05089P } from '../ct-p05/B05089P.js';
import { B05089P2 } from '../ct-p05/B05089P2.js';
import { B05109 } from '../ct-p05/B05109.js';
import { B05110 } from '../ct-p05/B05110.js';
import { B05110P } from '../ct-p05/B05110P.js';
import { B05112 } from '../ct-p05/B05112.js';
import { B06030 } from '../ct-p06/B06030.js';
import { B06030P } from '../ct-p06/B06030P.js';
import { B06035 } from '../ct-p06/B06035.js';
import { B06040 } from '../ct-p06/B06040.js';
import { B06040P } from '../ct-p06/B06040P.js';
import { B06056 } from '../ct-p06/B06056.js';
import { B06060 } from '../ct-p06/B06060.js';
import { B06070 } from '../ct-p06/B06070.js';
import { B06071 } from '../ct-p06/B06071.js';
import { B06071P } from '../ct-p06/B06071P.js';
import { B06075 } from '../ct-p06/B06075.js';
import { B06075P } from '../ct-p06/B06075P.js';
import { B06091 } from '../ct-p06/B06091.js';
import { B06093 } from '../ct-p06/B06093.js';
import { B06094 } from '../ct-p06/B06094.js';
import { B06094P } from '../ct-p06/B06094P.js';
import { B06099 } from '../ct-p06/B06099.js';
import { B06099P } from '../ct-p06/B06099P.js';
import { B07007 } from '../ct-p07/B07007.js';
import { B07007P } from '../ct-p07/B07007P.js';
import { B07007P2 } from '../ct-p07/B07007P2.js';
import { B07016 } from '../ct-p07/B07016.js';
import { B07016P } from '../ct-p07/B07016P.js';
import { B07016P2 } from '../ct-p07/B07016P2.js';
import { B07018 } from '../ct-p07/B07018.js';
import { B07018P } from '../ct-p07/B07018P.js';
import { B07021 } from '../ct-p07/B07021.js';
import { B07040 } from '../ct-p07/B07040.js';
import { B07056 } from '../ct-p07/B07056.js';
import { B07056P } from '../ct-p07/B07056P.js';
import { B07062 } from '../ct-p07/B07062.js';
import { B07062P } from '../ct-p07/B07062P.js';
import { B07071 } from '../ct-p07/B07071.js';
import { B07074 } from '../ct-p07/B07074.js';
import { B07083 } from '../ct-p07/B07083.js';
import { B07083P } from '../ct-p07/B07083P.js';
import { B07087 } from '../ct-p07/B07087.js';
import { B07087P } from '../ct-p07/B07087P.js';
import { B07088 } from '../ct-p07/B07088.js';
import { B07091 } from '../ct-p07/B07091.js';
import { B07091P } from '../ct-p07/B07091P.js';
import { B07095 } from '../ct-p07/B07095.js';
import { B07095P } from '../ct-p07/B07095P.js';
import { B07101 } from '../ct-p07/B07101.js';
import { B08007 } from '../ct-p08/B08007.js';
import { B08009 } from '../ct-p08/B08009.js';
import { B08015 } from '../ct-p08/B08015.js';
import { B08021 } from '../ct-p08/B08021.js';
import { B08021P } from '../ct-p08/B08021P.js';
import { B08022 } from '../ct-p08/B08022.js';
import { B08030 } from '../ct-p08/B08030.js';
import { B08030P } from '../ct-p08/B08030P.js';
import { B08039 } from '../ct-p08/B08039.js';
import { B08040 } from '../ct-p08/B08040.js';
import { B08056 } from '../ct-p08/B08056.js';
import { B08065 } from '../ct-p08/B08065.js';
import { B08065P } from '../ct-p08/B08065P.js';
import { B08080 } from '../ct-p08/B08080.js';
import { B08080P } from '../ct-p08/B08080P.js';
import { B09006 } from '../ct-p09/B09006.js';
import { B09006P } from '../ct-p09/B09006P.js';
import { B09014 } from '../ct-p09/B09014.js';
import { B09018 } from '../ct-p09/B09018.js';
import { B09025 } from '../ct-p09/B09025.js';
import { B09025P } from '../ct-p09/B09025P.js';
import { B09029 } from '../ct-p09/B09029.js';
import { B09037 } from '../ct-p09/B09037.js';
import { B09037P } from '../ct-p09/B09037P.js';
import { B09042 } from '../ct-p09/B09042.js';
import { B09044 } from '../ct-p09/B09044.js';
import { B09044P } from '../ct-p09/B09044P.js';
import { B09046 } from '../ct-p09/B09046.js';
import { B09046P } from '../ct-p09/B09046P.js';
import { B09049 } from '../ct-p09/B09049.js';
import { B09051 } from '../ct-p09/B09051.js';
import { B09064 } from '../ct-p09/B09064.js';
import { B09083 } from '../ct-p09/B09083.js';
import { B09085 } from '../ct-p09/B09085.js';
import { B09088 } from '../ct-p09/B09088.js';
import { B09093 } from '../ct-p09/B09093.js';
import { B09093P } from '../ct-p09/B09093P.js';
import { B09094 } from '../ct-p09/B09094.js';
import { B09099 } from '../ct-p09/B09099.js';
import { B09100 } from '../ct-p09/B09100.js';
import { B09101 } from '../ct-p09/B09101.js';
import { B09103 } from '../ct-p09/B09103.js';
import { PR006 } from '../pr-01/PR006.js';
import { PR023 } from '../pr-01/PR023.js';
import { PR035 } from '../pr-01/PR035.js';
import { PR043 } from '../pr-01/PR043.js';
import { PR047 } from '../pr-01/PR047.js';
import { PR053 } from '../pr-01/PR053.js';
import { PR056 } from '../pr-01/PR056.js';
import { PR059 } from '../pr-01/PR059.js';
import { PR063 } from '../pr-01/PR063.js';
import { PR101 } from '../pr-01/PR101.js';
import { PR107 } from '../pr-01/PR107.js';
import { PR131 } from '../pr-01/PR131.js';
import { PR147 } from '../pr-01/PR147.js';
import { PR148 } from '../pr-01/PR148.js';
import { PR149 } from '../pr-01/PR149.js';
import { PR150 } from '../pr-01/PR150.js';
import { PR151 } from '../pr-01/PR151.js';
import { PR152 } from '../pr-01/PR152.js';
import { PR156 } from '../pr-01/PR156.js';
import { PR162 } from '../pr-01/PR162.js';
import { PR174 } from '../pr-01/PR174.js';
import { PR177 } from '../pr-01/PR177.js';
import { PR192 } from '../pr-01/PR192.js';
import { PR197 } from '../pr-01/PR197.js';
import { PR198 } from '../pr-01/PR198.js';
import { PR202 } from '../pr-01/PR202.js';
import { PR208 } from '../pr-01/PR208.js';
import { PR235 } from '../pr-01/PR235.js';
import { PR241 } from '../pr-01/PR241.js';

// engine-extension #1 batch (leave:to-remove, 2026-06-05)
import { D03013 } from '../ct-d03/D03013.js';
import { D04010 } from '../ct-d04/D04010.js';
import { B03013 } from '../ct-p03/B03013.js';
import { B03091 } from '../ct-p03/B03091.js';
import { B03130 } from '../ct-p03/B03130.js';
import { B04010 } from '../ct-p04/B04010.js';
import { B06009 } from '../ct-p06/B06009.js';
import { B08084 } from '../ct-p08/B08084.js';
import { B08089 } from '../ct-p08/B08089.js';
import { PR054 } from '../pr-01/PR054.js';

// engine-extension #2 batch (charModifyLevel, 2026-06-05)
import { B07103 } from '../ct-p07/B07103.js';
import { B07103P } from '../ct-p07/B07103P.js';

// engine-extension #3 batch (multi-target Pattern A pick, 2026-06-05)
import { B02021 } from '../ct-p02/B02021.js';

// engine-extension #4 batch (sceneToHand, 2026-06-05)
import { B06069 } from '../ct-p06/B06069.js';
import { B06069P } from '../ct-p06/B06069P.js';

// engine-extension #5a batch (deckRevealUntil maxN + handAddFromDeck, 2026-06-05)
import { D01013 } from '../ct-d01/D01013.js';
// engine-extension #5a batch #2: D01013 同型 5 色違い
import { D02011 } from '../ct-d02/D02011.js';
import { D03009 } from '../ct-d03/D03009.js';
import { D04011 } from '../ct-d04/D04011.js';
import { D05012 } from '../ct-d05/D05012.js';
import { D07019 } from '../ct-d07/D07019.js';

// engine-extension #5b batch (charSetCard fromDeckTop, 2026-06-05)
import { B08054 } from '../ct-p08/B08054.js';
// engine-extension #5b 残課題: charSetCard PA短縮形 (uid pick + fromDeckTop)
import { B02023 } from '../ct-p02/B02023.js';

// engine-extension #1 leave:to-remove batch #2 (2026-06-05 残課題)
import { D03004 } from '../ct-d03/D03004.js';
import { B04030 } from '../ct-p04/B04030.js';
import { B04030P } from '../ct-p04/B04030P.js';
import { B04059 } from '../ct-p04/B04059.js';
import { B08042 } from '../ct-p08/B08042.js';
import { B09007 } from '../ct-p09/B09007.js';
import { B09007P } from '../ct-p09/B09007P.js';

// engine-extension #4 sceneToHand batch #2 (2026-06-05 残課題)
import { D09014 } from '../ct-d09/D09014.js';
import { D09015 } from '../ct-d09/D09015.js';
import { B06076 } from '../ct-p06/B06076.js';
import { PR135 } from '../pr-01/PR135.js';
import { PR141 } from '../pr-01/PR141.js';

// engine-extension #2 charModifyLevel batch #2 (2026-06-05 残課題, a2-only partial)
import { B05066 } from '../ct-p05/B05066.js';
import { B05066P } from '../ct-p05/B05066P.js';
import { B07093 } from '../ct-p07/B07093.js';
import { B07093P } from '../ct-p07/B07093P.js';

// engine-extension #5b charSetCard batch #2 (2026-06-05 残課題)
import { B02020 } from '../ct-p02/B02020.js';
import { B02020P } from '../ct-p02/B02020P.js';
import { B02030 } from '../ct-p02/B02030.js';
import { B02046 } from '../ct-p02/B02046.js';
import { B02046P } from '../ct-p02/B02046P.js';
import { B03061 } from '../ct-p03/B03061.js';

// engine-extension #1 leave:to-remove batch #3 (2026-06-05 残課題)
import { B04018 } from '../ct-p04/B04018.js';
import { B04018P } from '../ct-p04/B04018P.js';
import { B05056 } from '../ct-p05/B05056.js';
import { B06080 } from '../ct-p06/B06080.js';
import { B08079 } from '../ct-p08/B08079.js';
import { B08079P } from '../ct-p08/B08079P.js';
import { B08083 } from '../ct-p08/B08083.js';

// engine-extension #4 sceneToHand batch #3 (2026-06-05 残課題)
import { B06007 } from '../ct-p06/B06007.js';
import { B06007P } from '../ct-p06/B06007P.js';

// engine-extension #5b charSetCard batch #3 (2026-06-05 残課題)
import { B02040 } from '../ct-p02/B02040.js';
import { B02040P } from '../ct-p02/B02040P.js';
import { B03032 } from '../ct-p03/B03032.js';
import { B03032P } from '../ct-p03/B03032P.js';
import { B05029 } from '../ct-p05/B05029.js';

// engine-extension #5a deck-look-N batch #4 (D01013 / D02011 同型)
import { B01013 } from '../ct-p01/B01013.js';
import { B01013P } from '../ct-p01/B01013P.js';
import { B01016 } from '../ct-p01/B01016.js';
import { B01016P } from '../ct-p01/B01016P.js';
import { B01034 } from '../ct-p01/B01034.js';
import { B01034P } from '../ct-p01/B01034P.js';

// engine-extension reasoning-hook batch (2026-06-06 タスクC): 推理反応カード
import { B01017 } from '../ct-p01/B01017.js';
import { B01074 } from '../ct-p01/B01074.js';
// reasoning-hook batch #2: 非 selfOnly (自分の現場のキャラが推理したとき / triggerCharMatches)
import { B03102 } from '../ct-p03/B03102.js';
import { B05011 } from '../ct-p05/B05011.js';
// reasoning-hook batch #3: multi-target pick (B05039) + 捜査1 deckRevealUntil(opp) 代替 (B03096)
import { B05039 } from '../ct-p05/B05039.js';
import { B03096 } from '../ct-p03/B03096.js';
// optional-decision batch: 「〜してもよい」を pendingEffectOptional で surface (B05019)
import { B05019 } from '../ct-p05/B05019.js';
// triggerChar→target batch: 「そのキャラ」($trigger.uid) を effect target に (B05080)
import { B05080 } from '../ct-p05/B05080.js';
// multi-hook 共有【ターン1】batch: 「推理かアクションしたとき」(reasoning:end + action:declare)
import { D03007 } from '../ct-d03/D03007.js';
import { B04039 } from '../ct-p04/B04039.js';
import { B02004 } from '../ct-p02/B02004.js';
import { D10023 } from '../ct-d10/D10023.js';
import { PR173 } from '../pr-01/PR173.js';
// look-top-N batch (2026-06-06 タスクC): sceneEnter enterSleep (スリープ状態で登場)
import { D01012 } from '../ct-d01/D01012.js';
// disguise-hook batch (2026-06-06 タスクC): 変装ゲート条件 + 【変装時】(disguise:into) カード
import { D06012 } from '../ct-d06/D06012.js';
import { B03129 } from '../ct-p03/B03129.js';
import { B02045 } from '../ct-p02/B02045.js';
// event→evidence batch (2026-06-06 タスクC): 「このカードを表向きのまま証拠として得る」(selfToEvidence verb)
import { B04015 } from '../ct-p04/B04015.js';
import { B04028 } from '../ct-p04/B04028.js';
import { B04041 } from '../ct-p04/B04041.js';
import { B04062 } from '../ct-p04/B04062.js';
import { B04086 } from '../ct-p04/B04086.js';
// event→evidence batch #2: PR 再録 12 枚 (PR012-021 = B0401x 再録 2 セット / PR062・PR066 = RUM!! 黒)
import { PR012 } from '../pr-01/PR012.js';
import { PR013 } from '../pr-01/PR013.js';
import { PR014 } from '../pr-01/PR014.js';
import { PR015 } from '../pr-01/PR015.js';
import { PR016 } from '../pr-01/PR016.js';
import { PR017 } from '../pr-01/PR017.js';
import { PR018 } from '../pr-01/PR018.js';
import { PR019 } from '../pr-01/PR019.js';
import { PR020 } from '../pr-01/PR020.js';
import { PR021 } from '../pr-01/PR021.js';
import { PR062 } from '../pr-01/PR062.js';
import { PR066 } from '../pr-01/PR066.js';

// engine-extension #5a deck-look-N batch #5 (ct-p01 早期再録 9 枚)
import { B01048 } from '../ct-p01/B01048.js';
import { B01048P } from '../ct-p01/B01048P.js';
import { B01053 } from '../ct-p01/B01053.js';
import { B01055 } from '../ct-p01/B01055.js';
import { B01055P } from '../ct-p01/B01055P.js';
import { B01072 } from '../ct-p01/B01072.js';
import { B01072P } from '../ct-p01/B01072P.js';
import { B01090 } from '../ct-p01/B01090.js';
import { B01090P } from '../ct-p01/B01090P.js';

export const REUSE_CARDS: CardDef[] = [
  D01003, D01004, D01006, D01010, D01015, D02002, D02009, D02013,
  D02015, D03002, D03010, D03011, D03015, D04002, D04004, D04008,
  D04015, D05002, D05004, D05011, D05015, D06005, D06006, D06010,
  D06011, D06015, D06017, D06018, D06019, D06020, D06022, D06024,
  D07004, D07005, D07016, D07017, D07022, D09006, D09007, D09008,
  D09009, D09022, D09023, D09026, D10012, D10025, B01008, B01027,
  B01028, B01028P, B01029, B01032, B01040, B01040P, B01046, B01049,
  B01063, B01064, B01083, B01087, B01088, B01091, B01094, B01094P,
  B01099, B01099P, B01100, B01100P, B01101, B01101P, B01102, B01102P,
  B02009, B02010, B02032, B02051, B02060, B02061, B02074, B02074P,
  B02082, B02089, B02089P, B02090, B02091, B03004, B03009, B03010,
  B03010P, B03011, B03015, B03015P, B03021, B03021P, B03022, B03022P,
  B03026, B03037, B03043, B03048, B03048P, B03054, B03054P, B03055,
  B03060, B03060P, B03064, B03067, B03067P, B03074, B03082, B03087,
  B03087P, B03100, B03103, B03103P, B03105, B03114, B03114P, B03125,
  B03127, B03136, B03137, B03138, B04005, B04005P, B04008, B04009,
  B04020, B04025, B04035, B04035P, B04036, B04047, B04047P, B04050,
  B04050P, B04052, B04052P, B04054, B04054P, B04056, B04056P, B04060,
  B04070, B04070P, B04071, B04071P, B04080, B04096, B04096P, B05018,
  B05018P, B05037, B05038, B05055, B05067, B05067P, B05069, B05071,
  B05083, B05083P, B05089, B05089P, B05089P2, B05109, B05110, B05110P,
  B05112, B06030, B06030P, B06035, B06040, B06040P, B06056, B06060,
  B06070, B06071, B06071P, B06075, B06075P, B06091, B06093, B06094,
  B06094P, B06099, B06099P, B07007, B07007P, B07007P2, B07016, B07016P,
  B07016P2, B07018, B07018P, B07021, B07040, B07056, B07056P, B07062,
  B07062P, B07071, B07074, B07083, B07083P, B07087, B07087P, B07088,
  B07091, B07091P, B07095, B07095P, B07101, B08007, B08009, B08015,
  B08021, B08021P, B08022, B08030, B08030P, B08039, B08040, B08056,
  B08065, B08065P, B08080, B08080P, B09006, B09006P, B09014, B09018,
  B09025, B09025P, B09029, B09037, B09037P, B09042, B09044, B09044P,
  B09046, B09046P, B09049, B09051, B09064, B09083, B09085, B09088,
  B09093, B09093P, B09094, B09099, B09100, B09101, B09103, PR006,
  PR023, PR035, PR043, PR047, PR053, PR056, PR059, PR063,
  PR101, PR107, PR131, PR147, PR148, PR149, PR150, PR151,
  PR152, PR156, PR162, PR174, PR177, PR192, PR197, PR198,
  PR202, PR208, PR235, PR241,
  // engine-extension #1 batch (leave:to-remove, 2026-06-05)
  D03013, D04010, B03013, B03091, B03130, B04010, B06009, B08084, B08089, PR054,
  // engine-extension #2 batch (charModifyLevel, 2026-06-05)
  B07103, B07103P,
  // engine-extension #3 batch (multi-target Pattern A pick, 2026-06-05)
  B02021,
  // engine-extension #4 batch (sceneToHand, 2026-06-05)
  B06069, B06069P,
  // engine-extension #5a batch (deckRevealUntil maxN + handAddFromDeck, 2026-06-05)
  D01013,
  // engine-extension #5a batch #2: D01013 同型 5 色違い
  D02011, D03009, D04011, D05012, D07019,
  // engine-extension #5b batch (charSetCard fromDeckTop, 2026-06-05)
  B08054,
  // engine-extension #5b 残課題: charSetCard PA短縮形
  B02023,
  // engine-extension #1 leave:to-remove batch #2 (2026-06-05 残課題)
  D03004, B04030, B04030P, B04059, B08042, B09007, B09007P,
  // engine-extension #4 sceneToHand batch #2 (2026-06-05 残課題)
  D09014, D09015, B06076, PR135, PR141,
  // engine-extension #2 charModifyLevel batch #2 (2026-06-05 残課題, a2-only partial)
  B05066, B05066P, B07093, B07093P,
  // engine-extension #5b charSetCard batch #2 (2026-06-05 残課題)
  B02020, B02020P, B02030, B02046, B02046P, B03061,
  // engine-extension #1 leave:to-remove batch #3 (2026-06-05 残課題)
  B04018, B04018P, B05056, B06080, B08079, B08079P, B08083,
  // engine-extension #4 sceneToHand batch #3 (2026-06-05 残課題)
  B06007, B06007P,
  // engine-extension #5b charSetCard batch #3 (2026-06-05 残課題)
  B02040, B02040P, B03032, B03032P, B05029,
  // engine-extension #5a deck-look-N batch #4
  B01013, B01013P, B01016, B01016P, B01034, B01034P,
  // engine-extension #5a deck-look-N batch #5 (ct-p01 早期再録 9 枚)
  B01048, B01048P, B01053, B01055, B01055P, B01072, B01072P, B01090, B01090P,
  // engine-extension reasoning-hook batch (2026-06-06 タスクC)
  B01017, B01074,
  // reasoning-hook batch #2 (非 selfOnly / triggerCharMatches)
  B03102, B05011,
  // reasoning-hook batch #3 (multi-target pick B05039 / 捜査1=deckRevealUntil(opp) 代替 B03096)
  B05039, B03096,
  // optional-decision batch (「〜してもよい」= pendingEffectOptional surface)
  B05019,
  // triggerChar→target batch (「そのキャラ」= $trigger.uid)
  B05080,
  // multi-hook 共有【ターン1】batch (「推理かアクションしたとき」= reasoning:end + action:declare)
  D03007, B04039, B02004, D10023, PR173,
  // look-top-N batch (enterSleep)
  D01012,
  // disguise-hook batch (2026-06-06 タスクC): 変装ゲート条件 + 【変装時】
  D06012, B03129, B02045,
  // event→evidence batch (2026-06-06 タスクC): selfToEvidence (イベント自身を表向き証拠化)
  B04015, B04028, B04041, B04062, B04086,
  // event→evidence batch #2: PR 再録 12 枚 (同 selfToEvidence)
  PR012, PR013, PR014, PR015, PR016, PR017, PR018, PR019, PR020, PR021, PR062, PR066,
];
