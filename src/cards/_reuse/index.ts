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
import { B01011 } from '../ct-p01/B01011.js';
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
import { B06029 } from '../ct-p06/B06029.js';
import { B06029P } from '../ct-p06/B06029P.js';
import { B06030 } from '../ct-p06/B06030.js';
import { B06030P } from '../ct-p06/B06030P.js';
import { B06035 } from '../ct-p06/B06035.js';
import { B06040 } from '../ct-p06/B06040.js';
import { B06040P } from '../ct-p06/B06040P.js';
import { B06049 } from '../ct-p06/B06049.js';
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
// set-card 除去 batch: charRemoveSetCard verb (B08034)
import { B08034 } from '../ct-p08/B08034.js';
import { B08034P } from '../ct-p08/B08034P.js';
// evidence 抑制 batch: evidenceToDeck verb + optional triggerPayload 引継ぎ (B03038)
import { B03038 } from '../ct-p03/B03038.js';
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

// exact-reprint batch (2026-06-06 タスクA): 既存実装カードと公式テキスト byte 一致の色違い/パラレル/再録 11 枚
import { B02004P } from '../ct-p02/B02004P.js';
import { B02043 } from '../ct-p02/B02043.js';
import { B03006 } from '../ct-p03/B03006.js';
import { B03006P } from '../ct-p03/B03006P.js';
import { B03122 } from '../ct-p03/B03122.js';
import { B03129P } from '../ct-p03/B03129P.js';
import { B04081 } from '../ct-p04/B04081.js';
import { B04081P } from '../ct-p04/B04081P.js';
import { B05029P } from '../ct-p05/B05029P.js';
import { PR055 } from '../pr-01/PR055.js';
import { PR057 } from '../pr-01/PR057.js';

import { B04024 } from '../ct-p04/B04024.js';
import { B05057 } from '../ct-p05/B05057.js';
import { B06088 } from '../ct-p06/B06088.js';
import { B05060 } from '../ct-p05/B05060.js';
import { B03007 } from '../ct-p03/B03007.js';
import { PR061 } from '../pr-01/PR061.js';
import { PR065 } from '../pr-01/PR065.js';
import { PR180 } from '../pr-01/PR180.js';
import { PR186 } from '../pr-01/PR186.js';
import { PR084 } from '../pr-01/PR084.js';
import { PR090 } from '../pr-01/PR090.js';
import { B05034 } from '../ct-p05/B05034.js';
import { B07042 } from '../ct-p07/B07042.js';
import { B09015 } from '../ct-p09/B09015.js';
import { B04007 } from '../ct-p04/B04007.js';
import { B03099 } from '../ct-p03/B03099.js';
import { B03012 } from '../ct-p03/B03012.js';
import { PR155 } from '../pr-01/PR155.js';
import { PR161 } from '../pr-01/PR161.js';
import { PR230 } from '../pr-01/PR230.js';
import { B02053 } from '../ct-p02/B02053.js';
import { B02083 } from '../ct-p02/B02083.js';
import { D05006 } from '../ct-d05/D05006.js';
import { B06052 } from '../ct-p06/B06052.js';
import { PR138 } from '../pr-01/PR138.js';
import { PR144 } from '../pr-01/PR144.js';
import { B01050 } from '../ct-p01/B01050.js';
import { B01069 } from '../ct-p01/B01069.js';
import { B03014 } from '../ct-p03/B03014.js';
import { B03018 } from '../ct-p03/B03018.js';
import { B03069 } from '../ct-p03/B03069.js';
import { B03081 } from '../ct-p03/B03081.js';
import { B03101 } from '../ct-p03/B03101.js';
import { B03120 } from '../ct-p03/B03120.js';
import { B04023 } from '../ct-p04/B04023.js';
import { B04049 } from '../ct-p04/B04049.js';
import { B04082 } from '../ct-p04/B04082.js';
import { B05017 } from '../ct-p05/B05017.js';
import { B05073 } from '../ct-p05/B05073.js';
import { B05074 } from '../ct-p05/B05074.js';
import { B05090 } from '../ct-p05/B05090.js';
import { B05094 } from '../ct-p05/B05094.js';
import { B05098 } from '../ct-p05/B05098.js';
import { B05076P } from '../ct-p05/B05076P.js';
import { B06010 } from '../ct-p06/B06010.js';
import { B06102 } from '../ct-p06/B06102.js';
import { B07072 } from '../ct-p07/B07072.js';
import { B07073 } from '../ct-p07/B07073.js';
import { B07073P } from '../ct-p07/B07073P.js';
import { B07075 } from '../ct-p07/B07075.js';
import { B07077 } from '../ct-p07/B07077.js';
import { B07077P } from '../ct-p07/B07077P.js';
import { B07082 } from '../ct-p07/B07082.js';
import { B07082P } from '../ct-p07/B07082P.js';
import { B07089 } from '../ct-p07/B07089.js';
import { B07094 } from '../ct-p07/B07094.js';
import { B07094P } from '../ct-p07/B07094P.js';
import { B08011 } from '../ct-p08/B08011.js';
import { B08024 } from '../ct-p08/B08024.js';
import { B08044 } from '../ct-p08/B08044.js';
import { B08044P } from '../ct-p08/B08044P.js';
import { B08052 } from '../ct-p08/B08052.js';
import { B08070 } from '../ct-p08/B08070.js';
import { B08088 } from '../ct-p08/B08088.js';
import { B08090 } from '../ct-p08/B08090.js';
import { B09013 } from '../ct-p09/B09013.js';
import { B09057 } from '../ct-p09/B09057.js';
import { B09058 } from '../ct-p09/B09058.js';
import { B09058P } from '../ct-p09/B09058P.js';
import { B09062 } from '../ct-p09/B09062.js';
import { B09065 } from '../ct-p09/B09065.js';
import { B09075 } from '../ct-p09/B09075.js';
import { B09075P } from '../ct-p09/B09075P.js';
import { B09082 } from '../ct-p09/B09082.js';
import { B09084 } from '../ct-p09/B09084.js';
import { B09102 } from '../ct-p09/B09102.js';
import { B09106 } from '../ct-p09/B09106.js';
import { B09106P } from '../ct-p09/B09106P.js';
import { D02004 } from '../ct-d02/D02004.js';
import { D05007 } from '../ct-d05/D05007.js';
import { D07008 } from '../ct-d07/D07008.js';
import { D07009 } from '../ct-d07/D07009.js';
import { D07014 } from '../ct-d07/D07014.js';
import { D07015 } from '../ct-d07/D07015.js';
import { D09025 } from '../ct-d09/D09025.js';
import { D09027 } from '../ct-d09/D09027.js';
import { PR041 } from '../pr-01/PR041.js';
import { PR045 } from '../pr-01/PR045.js';
import { PR049 } from '../pr-01/PR049.js';
import { PR098 } from '../pr-01/PR098.js';
import { PR104 } from '../pr-01/PR104.js';
import { PR117 } from '../pr-01/PR117.js';
import { PR118 } from '../pr-01/PR118.js';
import { PR137 } from '../pr-01/PR137.js';
import { PR143 } from '../pr-01/PR143.js';
import { PR157 } from '../pr-01/PR157.js';
import { PR163 } from '../pr-01/PR163.js';
import { PR175 } from '../pr-01/PR175.js';
import { PR178 } from '../pr-01/PR178.js';
import { PR184 } from '../pr-01/PR184.js';
import { PR199 } from '../pr-01/PR199.js';
import { PR205 } from '../pr-01/PR205.js';
import { PR262 } from '../pr-01/PR262.js';
import { PR268 } from '../pr-01/PR268.js';
import { PR276 } from '../pr-01/PR276.js';
import { B06101 } from '../ct-p06/B06101.js';
import { D10011 } from '../ct-d10/D10011.js';
import { B09008 } from '../ct-p09/B09008.js';

// Task D engine拡張 wave#1 batch (2026-06-12): 4 gate + pick-bind で解禁 35枚
import { B09092 } from '../ct-p09/B09092.js';
import { B09092P } from '../ct-p09/B09092P.js';
import { B07081 } from '../ct-p07/B07081.js';
import { B04064 } from '../ct-p04/B04064.js';
import { B07080 } from '../ct-p07/B07080.js';
import { B07080P } from '../ct-p07/B07080P.js';
import { B04011 } from '../ct-p04/B04011.js';
import { B08058 } from '../ct-p08/B08058.js';
import { B08058P } from '../ct-p08/B08058P.js';
import { B09021 } from '../ct-p09/B09021.js';
import { B09021P } from '../ct-p09/B09021P.js';
import { B04068 } from '../ct-p04/B04068.js';
import { B04068P } from '../ct-p04/B04068P.js';
import { B05050 } from '../ct-p05/B05050.js';
import { PR100 } from '../pr-01/PR100.js';
import { PR106 } from '../pr-01/PR106.js';
import { B08037 } from '../ct-p08/B08037.js';
import { B08037P } from '../ct-p08/B08037P.js';
import { B09028 } from '../ct-p09/B09028.js';
import { PR181 } from '../pr-01/PR181.js';
import { PR187 } from '../pr-01/PR187.js';
import { B09054 } from '../ct-p09/B09054.js';
import { B09054P } from '../ct-p09/B09054P.js';
import { B09041 } from '../ct-p09/B09041.js';
import { B09041P } from '../ct-p09/B09041P.js';
import { B07090 } from '../ct-p07/B07090.js';
import { B07090P } from '../ct-p07/B07090P.js';
import { B08029 } from '../ct-p08/B08029.js';
import { B08029P } from '../ct-p08/B08029P.js';
import { B08032 } from '../ct-p08/B08032.js';
import { B08032P } from '../ct-p08/B08032P.js';
import { B09032 } from '../ct-p09/B09032.js';
import { B07079 } from '../ct-p07/B07079.js';
import { B07079P } from '../ct-p07/B07079P.js';
import { B02014 } from '../ct-p02/B02014.js';

import { B05076 } from '../ct-p05/B05076.js';
import { D09016 } from '../ct-d09/D09016.js';
import { D09017 } from '../ct-d09/D09017.js';

import { B08020 } from '../ct-p08/B08020.js';
import { B08020P } from '../ct-p08/B08020P.js';
// engine拡張 wave#2 cluster2 (2026-06-12): ability-presence filter (X1/X1b/X6/X7/X8) 解禁 10枚
import { B03128 } from '../ct-p03/B03128.js';
import { B03131 } from '../ct-p03/B03131.js';
import { B08005 } from '../ct-p08/B08005.js';
import { B08005P } from '../ct-p08/B08005P.js';
import { B08016 } from '../ct-p08/B08016.js';
import { B08094 } from '../ct-p08/B08094.js';
import { B08094P } from '../ct-p08/B08094P.js';
import { B09073 } from '../ct-p09/B09073.js';
import { B09073P } from '../ct-p09/B09073P.js';
import { B09104 } from '../ct-p09/B09104.js';

import { B01036 } from '../ct-p01/B01036.js';
import { B01037 } from '../ct-p01/B01037.js';
import { B01068 } from '../ct-p01/B01068.js';
import { B01067 } from '../ct-p01/B01067.js';
import { B02068 } from '../ct-p02/B02068.js';
import { B03097 } from '../ct-p03/B03097.js';
import { B03073 } from '../ct-p03/B03073.js';
import { D04005 } from '../ct-d04/D04005.js';
import { D04007 } from '../ct-d04/D04007.js';
import { B08012 } from '../ct-p08/B08012.js';
import { B08012P } from '../ct-p08/B08012P.js';
import { B08048 } from '../ct-p08/B08048.js';
import { B05108 } from '../ct-p05/B05108.js';
import { PR086 } from '../pr-01/PR086.js';
import { PR092 } from '../pr-01/PR092.js';

import { B08051 } from '../ct-p08/B08051.js';
import { B08051P } from '../ct-p08/B08051P.js';
import { B08066 } from '../ct-p08/B08066.js';
import { B08066P } from '../ct-p08/B08066P.js';
import { B08027 } from '../ct-p08/B08027.js';
import { B03059 } from '../ct-p03/B03059.js';
import { B02063 } from '../ct-p02/B02063.js';
import { B04034 } from '../ct-p04/B04034.js';
import { B09017 } from '../ct-p09/B09017.js';
import { B09034 } from '../ct-p09/B09034.js';
import { B09034P } from '../ct-p09/B09034P.js';
import { B07067 } from '../ct-p07/B07067.js';
import { B07070 } from '../ct-p07/B07070.js';

import { B07052 } from '../ct-p07/B07052.js';
import { B07055 } from '../ct-p07/B07055.js';
import { B07055P } from '../ct-p07/B07055P.js';
import { B07058 } from '../ct-p07/B07058.js';
import { B07058P } from '../ct-p07/B07058P.js';

import { B07047 } from '../ct-p07/B07047.js';
import { B07031 } from '../ct-p07/B07031.js';
import { B07038 } from '../ct-p07/B07038.js';

import { B07034 } from '../ct-p07/B07034.js';
import { B07034P } from '../ct-p07/B07034P.js';
import { PR231 } from '../pr-01/PR231.js';
// engine拡張 wave#2 cluster11 (enter-source-level filter, BUG-146 coupled)
import { B01014 } from '../ct-p01/B01014.js';
import { B01015 } from '../ct-p01/B01015.js';
import { B01021 } from '../ct-p01/B01021.js';
import { B07019 } from '../ct-p07/B07019.js';

import { D01014 } from '../ct-d01/D01014.js';
import { B04013 } from '../ct-p04/B04013.js';
import { D02014 } from '../ct-d02/D02014.js';
import { B04026 } from '../ct-p04/B04026.js';
import { D03014 } from '../ct-d03/D03014.js';
import { B04040 } from '../ct-p04/B04040.js';
import { D04014 } from '../ct-d04/D04014.js';
import { B04061 } from '../ct-p04/B04061.js';
import { D05014 } from '../ct-d05/D05014.js';
import { B04083 } from '../ct-p04/B04083.js';
import { D07023 } from '../ct-d07/D07023.js';
import { B03132 } from '../ct-p03/B03132.js';
import { B03132P } from '../ct-p03/B03132P.js';
import { B08060 } from '../ct-p08/B08060.js';
import { B08060P } from '../ct-p08/B08060P.js';

import { D05005 } from '../ct-d05/D05005.js';
import { D07010 } from '../ct-d07/D07010.js';
import { D07011 } from '../ct-d07/D07011.js';
import { B01038 } from '../ct-p01/B01038.js';
import { B01038P } from '../ct-p01/B01038P.js';
import { B02012 } from '../ct-p02/B02012.js';
import { B03075 } from '../ct-p03/B03075.js';
import { B07044 } from '../ct-p07/B07044.js';
import { B09009 } from '../ct-p09/B09009.js';
import { PR274 } from '../pr-01/PR274.js';
import { PR275 } from '../pr-01/PR275.js';

import { B09010 } from '../ct-p09/B09010.js';
import { B09010P } from '../ct-p09/B09010P.js';
import { PR042 } from '../pr-01/PR042.js';
import { PR046 } from '../pr-01/PR046.js';

import { B01018 } from '../ct-p01/B01018.js';
import { B01062 } from '../ct-p01/B01062.js';
import { B01062P } from '../ct-p01/B01062P.js';
import { B01066 } from '../ct-p01/B01066.js';
import { B01066P } from '../ct-p01/B01066P.js';
import { B02003 } from '../ct-p02/B02003.js';
import { B02003P } from '../ct-p02/B02003P.js';
import { B02005 } from '../ct-p02/B02005.js';
import { B02005P } from '../ct-p02/B02005P.js';
import { B02019 } from '../ct-p02/B02019.js';
import { B02019P } from '../ct-p02/B02019P.js';
import { B02044 } from '../ct-p02/B02044.js';
import { B02044P } from '../ct-p02/B02044P.js';
import { B02077 } from '../ct-p02/B02077.js';
import { B02077P } from '../ct-p02/B02077P.js';
import { PR080 } from '../pr-01/PR080.js';
import { B03005 } from '../ct-p03/B03005.js';
import { D10020 } from '../ct-d10/D10020.js';
import { D10021 } from '../ct-d10/D10021.js';
import { B03025 } from '../ct-p03/B03025.js';
import { B03086 } from '../ct-p03/B03086.js';
import { B03086P } from '../ct-p03/B03086P.js';
import { B03089 } from '../ct-p03/B03089.js';
import { B03089P } from '../ct-p03/B03089P.js';
import { D09020 } from '../ct-d09/D09020.js';
import { B04014 } from '../ct-p04/B04014.js';
import { B04014P } from '../ct-p04/B04014P.js';
import { B04017 } from '../ct-p04/B04017.js';
import { B04017P } from '../ct-p04/B04017P.js';
import { B05006 } from '../ct-p05/B05006.js';
import { B05006P } from '../ct-p05/B05006P.js';
import { B05006P2 } from '../ct-p05/B05006P2.js';
import { B05020 } from '../ct-p05/B05020.js';
import { B05020P } from '../ct-p05/B05020P.js';
import { B05046 } from '../ct-p05/B05046.js';
import { B05046P } from '../ct-p05/B05046P.js';
import { B05046P2 } from '../ct-p05/B05046P2.js';
import { B06011 } from '../ct-p06/B06011.js';
import { B06011P } from '../ct-p06/B06011P.js';
import { B06013 } from '../ct-p06/B06013.js';
import { B06013P } from '../ct-p06/B06013P.js';
import { PR170 } from '../pr-01/PR170.js';
import { B07004 } from '../ct-p07/B07004.js';
import { B07004P } from '../ct-p07/B07004P.js';
import { B07020 } from '../ct-p07/B07020.js';
import { B07020P } from '../ct-p07/B07020P.js';
import { B07023 } from '../ct-p07/B07023.js';
import { B07023P } from '../ct-p07/B07023P.js';
import { B07098 } from '../ct-p07/B07098.js';
import { B07098P } from '../ct-p07/B07098P.js';
import { D09004 } from '../ct-d09/D09004.js';
import { D09005 } from '../ct-d09/D09005.js';
import { PR193 } from '../pr-01/PR193.js';
import { PR060 } from '../pr-01/PR060.js';
import { PR064 } from '../pr-01/PR064.js';
import { PR154 } from '../pr-01/PR154.js';

import { B01052 } from '../ct-p01/B01052.js';
import { D06016 } from '../ct-d06/D06016.js';
import { B02025 } from '../ct-p02/B02025.js';
import { B02025P } from '../ct-p02/B02025P.js';
import { B04022 } from '../ct-p04/B04022.js';
import { B04022P } from '../ct-p04/B04022P.js';
import { B04031 } from '../ct-p04/B04031.js';
import { B04031P } from '../ct-p04/B04031P.js';

import { B03079 } from '../ct-p03/B03079.js';
import { B03079P } from '../ct-p03/B03079P.js';

import { B01065 } from '../ct-p01/B01065.js';
import { B01065P } from '../ct-p01/B01065P.js';
import { B02038 } from '../ct-p02/B02038.js';
import { B02038P } from '../ct-p02/B02038P.js';
import { B03031 } from '../ct-p03/B03031.js';
import { B03031P } from '../ct-p03/B03031P.js';
import { B05024 } from '../ct-p05/B05024.js';
import { B05024P } from '../ct-p05/B05024P.js';
import { B07041 } from '../ct-p07/B07041.js';
import { B07041P } from '../ct-p07/B07041P.js';
import { B01076 } from '../ct-p01/B01076.js';
import { B01076P } from '../ct-p01/B01076P.js';
import { B02041 } from '../ct-p02/B02041.js';
import { B02041P } from '../ct-p02/B02041P.js';
import { B04051 } from '../ct-p04/B04051.js';
import { B04051P } from '../ct-p04/B04051P.js';
import { B07057 } from '../ct-p07/B07057.js';
import { B07057P } from '../ct-p07/B07057P.js';
import { PR237 } from '../pr-01/PR237.js';
import { PR243 } from '../pr-01/PR243.js';

import { B05028 } from '../ct-p05/B05028.js';
import { B05028P } from '../ct-p05/B05028P.js';
import { B09038 } from '../ct-p09/B09038.js';
import { B09038P } from '../ct-p09/B09038P.js';

import { D10007 } from '../ct-d10/D10007.js';
import { D10008 } from '../ct-d10/D10008.js';
import { B01007 } from '../ct-p01/B01007.js';
import { B01010 } from '../ct-p01/B01010.js';
import { B01010P } from '../ct-p01/B01010P.js';
import { B06031 } from '../ct-p06/B06031.js';
import { B06031P } from '../ct-p06/B06031P.js';
import { B06051 } from '../ct-p06/B06051.js';
import { B06051P } from '../ct-p06/B06051P.js';
import { B07017 } from '../ct-p07/B07017.js';
import { B07017P } from '../ct-p07/B07017P.js';
import { B07084 } from '../ct-p07/B07084.js';
import { B07084P } from '../ct-p07/B07084P.js';
import { B07097 } from '../ct-p07/B07097.js';
import { B07097P } from '../ct-p07/B07097P.js';
import { B09023 } from '../ct-p09/B09023.js';
import { B09023P } from '../ct-p09/B09023P.js';
import { D09010 } from '../ct-d09/D09010.js';
import { D09011 } from '../ct-d09/D09011.js';
import { B06067 } from '../ct-p06/B06067.js';
import { B06067P } from '../ct-p06/B06067P.js';
import { B09026 } from '../ct-p09/B09026.js';
import { B01030 } from '../ct-p01/B01030.js';
import { B01030P } from '../ct-p01/B01030P.js';
import { B01031 } from '../ct-p01/B01031.js';
import { B01031P } from '../ct-p01/B01031P.js';

import { B03016 } from '../ct-p03/B03016.js';
import { B03016P } from '../ct-p03/B03016P.js';
import { B03053 } from '../ct-p03/B03053.js';
import { B03113 } from '../ct-p03/B03113.js';
import { B03113P } from '../ct-p03/B03113P.js';
import { B04012 } from '../ct-p04/B04012.js';
import { PR026 } from '../pr-01/PR026.js';
import { PR030 } from '../pr-01/PR030.js';
import { B06081 } from '../ct-p06/B06081.js';
import { B07035 } from '../ct-p07/B07035.js';
import { B07035P } from '../ct-p07/B07035P.js';
import { PR280 } from '../pr-01/PR280.js';
import { B06087 } from '../ct-p06/B06087.js';
import { B06087P } from '../ct-p06/B06087P.js';
import { B07051 } from '../ct-p07/B07051.js';
import { B06038 } from '../ct-p06/B06038.js';
import { B06038P } from '../ct-p06/B06038P.js';
import { B06039 } from '../ct-p06/B06039.js';
import { B06039P } from '../ct-p06/B06039P.js';
import { B08010 } from '../ct-p08/B08010.js';
import { B09071 } from '../ct-p09/B09071.js';
import { B09071P } from '../ct-p09/B09071P.js';
import { B09071P2 } from '../ct-p09/B09071P2.js';

import { B05078 } from '../ct-p05/B05078.js';
import { B05078P } from '../ct-p05/B05078P.js';
import { B03056 } from '../ct-p03/B03056.js';
import { B03056P } from '../ct-p03/B03056P.js';

import { B07066 } from '../ct-p07/B07066.js';
import { B07066P } from '../ct-p07/B07066P.js';
import { PR194 } from '../pr-01/PR194.js';

import { B02026 } from '../ct-p02/B02026.js';
import { B04004 } from '../ct-p04/B04004.js';
import { B04004P } from '../ct-p04/B04004P.js';
import { B09097 } from '../ct-p09/B09097.js';
import { B09097P } from '../ct-p09/B09097P.js';

import { B08067 } from '../ct-p08/B08067.js';
import { B08067P } from '../ct-p08/B08067P.js';
import { PR236 } from '../pr-01/PR236.js';
import { PR242 } from '../pr-01/PR242.js';

import { B03077 } from '../ct-p03/B03077.js';

import { PR085 } from '../pr-01/PR085.js';
import { PR091 } from '../pr-01/PR091.js';

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
  // set-card 除去 batch (charRemoveSetCard verb)
  B08034, B08034P,
  // evidence 抑制 batch (evidenceToDeck verb、「この推理で証拠を得ない」)
  B03038,
  // look-top-N batch (enterSleep)
  D01012,
  // disguise-hook batch (2026-06-06 タスクC): 変装ゲート条件 + 【変装時】
  D06012, B03129, B02045,
  // event→evidence batch (2026-06-06 タスクC): selfToEvidence (イベント自身を表向き証拠化)
  B04015, B04028, B04041, B04062, B04086,
  // event→evidence batch #2: PR 再録 12 枚 (同 selfToEvidence)
  PR012, PR013, PR014, PR015, PR016, PR017, PR018, PR019, PR020, PR021, PR062, PR066,
  // exact-reprint batch (2026-06-06 タスクA): 既存実装カードの色違い/パラレル/再録 11 枚 (engine 不変)
  B02004P, B02043, B03006, B03006P, B03122, B03129P, B04081, B04081P, B05029P, PR055, PR057,
  // Task A batch#2 (2026-06-09): A.enter+hirameki クラスタ — 自己スリープ登場 (enter→sceneSetState{$self,sleep}) + ヒラメキdraw
  B01011,
  // Task A batch#2 wave1 (2026-06-10): look-N→hand クラスタ — deckRevealUntil+handAddFromDeck+deckToBottomBound (B01013/D01013 同型) + hirameki/enterSleep/leave-hook/cutin
  B04024, B05057, B06088, B05060, B03007, PR061, PR065, PR180, PR186, PR084, PR090,
  // Task A batch#2 wave2 (2026-06-10): leave→hand (handAddFromRemove) / reanimate (sceneEnter from:remove|hand ± enterSleep) / forEach-all sleep (B06071 同型) — B02004/D08024/B05112/D01012/D03013 同型
  B05034, B07042, B09015, B04007, B03099, B03012, PR155, PR161, PR230,
  // Task A batch#2 certify-harvest #1 (2026-06-11): adversarial-certify workflow verified greens — B01050 (enterSleep+look1白+hirameki) / B01069 (opt 相手証拠+draw) / B02053 (event reanimate白怪盗+hirameki, __eventUse closure)
  B02053, B02083,
  // Task A batch#2 wave3 (2026-06-11): opt-cost reanimate — optional{chain[(self-sleep,)discard1,sceneEnter from:remove]} (B05019 optional + D08003 chain 同型) — D05006/B06052(+cutin)/PR138/PR144(+hirameki sleep-pick)
  D05006, B06052, PR138, PR144,
  // Task A batch#2 certify-harvest #1b (2026-06-11): canary verified greens — B01050 (enterSleep+look1白→hand+hirameki draw) / B01069 (【登場時】opt 相手証拠1+draw)
  B01050, B01069,
  // Task A batch#2 certify-harvest #2 (2026-06-11): chunkB workflow verified greens 15枚 (B03014/B03018/B03069/B03081/B03101/B03120/B04023/B04049/B04082/B05017/B05073/B05074/B05090/B05094/B05098)
  B03014, B03018, B03069, B03081, B03101, B03120, B04023, B04049, B04082, B05017, B05073, B05074, B05090, B05094, B05098,
  // Task A batch#2 certify-harvest #3 (2026-06-11): chunkC workflow verified greens 3枚 (B05076P/B06010/B06102)
  B05076P, B06010, B06102,
  // Task A batch#2 certify-harvest #4 (2026-06-12): chunkD partial workflow verified greens 16枚 (B07072/B07073/P/B07075/B07077/P/B07082/P/B07089/B07094/P/B08011/B08024/B08044/P/B08052)
  B07072, B07073, B07073P, B07075, B07077, B07077P, B07082, B07082P, B07089, B07094, B07094P, B08011, B08024, B08044, B08044P, B08052,
  // Task A batch#2 certify-harvest #5 (2026-06-12): workflow verified greens 23枚 (B08070/B08088/B08090/B09013/B09057/B09058系/B09062/B09065/B09075系/B09082/B09084/B09102/B09106系/D02004/D05007/D07008/D07009/D07014/D07015/D09025)
  B08070, B08088, B08090, B09013, B09057, B09058, B09058P, B09062, B09065, B09075, B09075P, B09082, B09084, B09102, B09106, B09106P, D02004, D05007, D07008, D07009, D07014, D07015, D09025,
  // Task A batch#2 certify-harvest #6 final (2026-06-12): workflow verified greens 20枚 (D09027/PR041/PR045/PR049/PR098/PR104/PR117/PR118/PR137/PR143/PR157/PR163/PR175/PR178/PR184/PR199/PR205/PR262/PR268/PR276) — certify 254/254 完了
  D09027, PR041, PR045, PR049, PR098, PR104, PR117, PR118, PR137, PR143, PR157, PR163, PR175, PR178, PR184, PR199, PR205, PR262, PR268, PR276,
  // Task A batch#2 certify-harvest needsManual 手書き3枚 (2026-06-12): B06101(cutin contactTargetMatches黒)/D10011(declared reanimate毛利蘭+cutin)/B09008(continuous apAtLeast突撃+opt charRemoveSetCard)。B07052=yellow(event-trait gate) / B08020=defer(色matcher要shared)
  B06101, D10011, B09008,
  // Task D engine拡張 wave#1 (2026-06-12): hand-count/scene→deck/FILE-zone/textual-grant + pick-bind 解禁 35枚
  // (敵対検証 workflow 通過。B09028/B09054系=sleepGuard+自己ガード除外、B09032=charGrantKeyword短縮形で解禁)
  B09092, B09092P, B07081, B04064, B07080, B07080P, B04011, B08058, B08058P, B09021, B09021P, B04068, B04068P, B05050, PR100, PR106, B08037, B08037P, B09028, PR181, PR187, B09054, B09054P, B09041, B09041P, B07090, B07090P, B08029, B08029P, B08032, B08032P, B09032, B07079, B07079P, B02014,
  // Task A wave#2 codegen3 (D09016/D09017 FILE6行動 / B05076 解決編)。B08020/P は共有 engine gap で defer (BUG-132)
  B05076, D09016, D09017,
  // engine拡張 wave#2 — BUG-132 GAP-1/2 修正後の B08020/P 再採用
  B08020, B08020P,
  // engine拡張 wave#2 cluster2 (2026-06-12): ability-presence filter 解禁 10枚
  // (現場リムーブ時/疾風/カットイン presence — X1 述語 + X1b 窓/bound filter + X6 boundToRemove + X7/X8 骨格バグ修正)
  B03128, B03131, B08005, B08005P, B08016, B08094, B08094P, B09073, B09073P, B09104,
  // engine拡張 wave#2 cluster3 — action-lifecycle trigger 15枚
  B01036, B01037, B01068, B01067, B02068, B03097, B03073, D04005, D04007, B08012, B08012P, B08048, B05108, PR086, PR092,
  // engine拡張 wave#2 cluster4 (2026-06-14): remove-area → deck-bottom 解禁6枚 (B08051/P 赤井秀一・B08066/P 上原由衣・B03059 土井塔克樹・B08027 長門秀臣)
  B08051, B08051P, B08066, B08066P, B08027, B03059,
  // engine拡張 wave#2 cluster5 (2026-06-14): usage-restriction aura 3枚 (B02063 羽田秀吉=相手カットイン不可・B04034 京極真=相手カットイン不可+変装時不発動・B09017 吉田歩美=条件付き相手カットイン不可)
  B02063, B04034, B09017,
  // engine拡張 wave#2 cluster6 (2026-06-14): usage-restriction (event-use ban) 2枚 (B09034/B09034P「黄金千枚二千杯」緑イベント=リムーブのイベント2枚まで回収+このターン自分はイベント使用不可)
  B09034, B09034P,
  // engine拡張 wave#2 cluster8 (2026-06-15): ヒラメキ抑止窓 1枚 (B06049 佐々木小次郎 a2「アクション[事件]したとき、アクション終了時まで相手の【ヒラメキ】は発動しない」= setHiramekiSuppress verb + turnState.hiramekiSuppressed + action-end 清掃)
  B06049,
  // cluster7 (2026-06-14、engine変更0 card-authoring): hand-count condition 初消費 2枚 (B07067 沖矢昴=【パートナー赤】登場時 相手手札≥自分手札でレベル8以下リムーブ + 宣言 sleepChar-pick / B07070 新出智明=登場時 手札2枚以下でレベル7以上赤に AP+1000・突撃 + カットイン)
  B07067, B07070,
  // 赤魔術 trait family (B07052 ルシュファー + B07055/P 紅の盟約 + B07058/P 心を盗む + B07062/P caseTraits)
  B07052, B07055, B07055P, B07058, B07058P,
  // 赤魔術 family残 (B07031/B07038/B07047)
  B07047, B07031, B07038,
  // engine拡張 wave#2 cluster9 (setcard:leave hook)
  B07034, B07034P, PR231,
  // engine拡張 wave#2 cluster11 (enter-source-level filter, BUG-146 coupled)
  B01014, B01015, B01021, B07019,
  // engine拡張 wave#2 cluster12 — nested-filter-dyn (FILE-level enter events)
  D01014, B04013, D02014, B04026, D03014, B04040, D04014, B04061, D05014, B04083, D07023, B03132, B03132P, B08060, B08060P,
  // engine拡張 wave#2 cluster13 — aura-grant (他キャラ AP buff)
  D05005, D07010, D07011, B01038, B01038P, B02012, B03075, B07044, B09009, PR274, PR275,
  // engine拡張 wave#2 cluster14 — multi-card sceneEnter
  B09010, B09010P, PR042, PR046,
  // Task A batch
  B01018, B01062, B01062P, B01066, B01066P, B02003, B02003P, B02005, B02005P, B02019, B02019P, B02044, B02044P, B02077, B02077P, PR080, B03005, D10020, D10021, B03025, B03086, B03086P, B03089, B03089P, D09020, B04014, B04014P, B04017, B04017P, B05006, B05006P, B05006P2, B05020, B05020P, B05046, B05046P, B05046P2, B06011, B06011P, B06013, B06013P, PR170, B07004, B07004P, B07020, B07020P, B07023, B07023P, B07098, B07098P, D09004, D09005, PR193, PR060, PR064, PR154,
  // triage-batch2 (window4 confirmed greens: B01052/B02025/B04022/B04031 + byte-identical clones)
  B01052, D06016, B02025, B02025P, B04022, B04022P, B04031, B04031P,
  // triage batch#3 (window4 verified green B03079 + clone)
  B03079, B03079P,
  // トリアージ出荷バッチ#4 — window5 certify verified green 10 + clone 10 = 20枚 (engine変更0)
  // (B05028/B05028P/B09038/B09038P は BUG-111 #2 修正 commit a682b20b で解禁 — B05028=誤診断/B09038=修正で発火)
  B01065, B01065P, B02038, B02038P, B03031, B03031P, B05024, B05024P, B07041, B07041P, B01076, B01076P, B02041, B02041P, B04051, B04051P, B07057, B07057P, PR237, PR243,
  // BUG-111 #2 修正で解禁 — B05028 (誤診断) + B09038 (修正) + clones
  B05028, B05028P, B09038, B09038P,
  // Task A batch
  D10007, D10008, B01007, B01010, B01010P, B06031, B06031P, B06051, B06051P, B07017, B07017P, B07084, B07084P, B07097, B07097P, B09023, B09023P, D09010, D09011, B06067, B06067P, B09026, B01030, B01030P, B01031, B01031P,
  // wave#2 cluster16 — filter-predicate ship (cardNameNot + deckReveal filterAny)
  B03016, B03016P, B03053, B03113, B03113P, B04012, PR026, PR030, B06081, B07035, B07035P,
  // wave#2 cluster16 — self-remove removal-observer (萩原千速 trio: contact-self removal observer + cardNameNot summon)
  PR280, B06087, B06087P,
  // wave#2 cluster16 G2 follow-up — deckReveal filterAny (桃井恵子: 怪盗キッド/高校生 reveal, B03016 exact twin)
  B07051,
  // wave#2 cluster15 follow-up — removal-observer + keyword-grant closure (partnerColorKeyword / 絆 bond grant + contact-self removal observer)
  B06038, B06038P, B06039, B06039P, B08010, B09071, B09071P, B09071P2,
  // wave-deckLook-bottom: 上から見て手札+残りデッキ下 (engine変更0)
  B05078, B05078P, B03056, B03056P,
  // Task A batch
  B07066, B07066P, PR194,
  // wave dsl-reauthor — B02026 / B04004 / B09097 再author (engine変更0)
  B02026, B04004, B04004P, B09097, B09097P,
  // distinct-name-count micro-cluster (2026-06-21): sceneHas query.distinctNames を計数 honor
  //   (「それぞれカード名の異なる〚特徴X〛がN枚以上」rules/19)。諸伏高明 enter gate + 大和敢助 declared a2 gate。
  B08067, B08067P, PR236, PR242,
  // handToEvidence micro-cluster (2026-06-21): 手札⇔証拠 swap (「証拠1つ選び手札へ。そうした場合、手札1枚を
  //   裏向きで証拠として得る」chain[evidenceToHand, handToEvidence])。ヘビ男 (新 verb handToEvidence)。
  B06029, B06029P,
  // evidence-top-to-hand micro-cluster (2026-06-21)
  B03077,
  // evidence-self→hand wave (hirameki このカード手札に加える)
  PR085, PR091,
];
