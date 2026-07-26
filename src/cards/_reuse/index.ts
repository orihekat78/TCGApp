// cards/_reuse — エンジン既存機能を流用するカード群の barrel (手書き集約)。
// 構成: catalog-reuse 基底バッチ (card-condition-catalog 流用、.tmp/reuse/build-barrel.cjs でスキャン生成) +
//   以降に追記された engine-extension / Task / cluster / wave / micro-cluster 各バッチ (すべて手書き)。
// 正準枚数は末尾 REUSE_CARDS 配列の長さ (現 802 枚、wave 追加で増える)。各バッチの内訳は配列ゾーンの section マーカ参照。
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
import { D10026 } from '../ct-d10/D10026.js';
import { B01008 } from '../ct-p01/B01008.js';
import { B01006 } from '../ct-p01/B01006.js';
import { B01006P } from '../ct-p01/B01006P.js';
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
import { B01082 } from '../ct-p01/B01082.js';
import { B01087 } from '../ct-p01/B01087.js';
import { B01088 } from '../ct-p01/B01088.js';
import { B01091 } from '../ct-p01/B01091.js';
import { B01092 } from '../ct-p01/B01092.js';
import { B01092P } from '../ct-p01/B01092P.js';
import { B02086 } from '../ct-p02/B02086.js';
import { B02039 } from '../ct-p02/B02039.js';
import { B02052 } from '../ct-p02/B02052.js';
import { B02052P } from '../ct-p02/B02052P.js';
import { B05033 } from '../ct-p05/B05033.js';
import { B02086P } from '../ct-p02/B02086P.js';
import { B08074 } from '../ct-p08/B08074.js';
import { B07011 } from '../ct-p07/B07011.js';
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
import { B02022 } from '../ct-p02/B02022.js';
import { B02022P } from '../ct-p02/B02022P.js';
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
import { B04046 } from '../ct-p04/B04046.js';
import { B04046P } from '../ct-p04/B04046P.js';
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
import { B06033 } from '../ct-p06/B06033.js';
import { B06033P } from '../ct-p06/B06033P.js';
import { B06030 } from '../ct-p06/B06030.js';
import { B06030P } from '../ct-p06/B06030P.js';
import { B06047 } from '../ct-p06/B06047.js';
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
import { B07012 } from '../ct-p07/B07012.js';
import { B07012P } from '../ct-p07/B07012P.js';
import { B07016 } from '../ct-p07/B07016.js';
import { B07016P } from '../ct-p07/B07016P.js';
import { B07016P2 } from '../ct-p07/B07016P2.js';
import { B07048 } from '../ct-p07/B07048.js';
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
import { B08049 } from '../ct-p08/B08049.js';
import { B08049P } from '../ct-p08/B08049P.js';
import { B08056 } from '../ct-p08/B08056.js';
import { B08065 } from '../ct-p08/B08065.js';
import { B08065P } from '../ct-p08/B08065P.js';
import { B08080 } from '../ct-p08/B08080.js';
import { B08080P } from '../ct-p08/B08080P.js';
import { B09006 } from '../ct-p09/B09006.js';
import { B09006P } from '../ct-p09/B09006P.js';
import { B09014 } from '../ct-p09/B09014.js';
import { B09018 } from '../ct-p09/B09018.js';
import { B09024 } from '../ct-p09/B09024.js';
import { B03030 } from '../ct-p03/B03030.js';
import { B03030P } from '../ct-p03/B03030P.js';
import { B05008 } from '../ct-p05/B05008.js';
import { B05008P } from '../ct-p05/B05008P.js';
import { B05048 } from '../ct-p05/B05048.js';
import { B08017 } from '../ct-p08/B08017.js';
import { B08017P } from '../ct-p08/B08017P.js';
import { B09025 } from '../ct-p09/B09025.js';
import { B09025P } from '../ct-p09/B09025P.js';
import { B09029 } from '../ct-p09/B09029.js';
import { B09036 } from '../ct-p09/B09036.js';
import { B09036P } from '../ct-p09/B09036P.js';
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
import { B09067 } from '../ct-p09/B09067.js';
import { B09067P } from '../ct-p09/B09067P.js';
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
// wave engine0-triage-0628 (engine変更0、triage→adversarial-verify 通過)
import { B03020 } from '../ct-p03/B03020.js';
import { B03023 } from '../ct-p03/B03023.js';
import { B06057 } from '../ct-p06/B06057.js';
import { B07104 } from '../ct-p07/B07104.js';
import { B07104P } from '../ct-p07/B07104P.js';
import { B08071 } from '../ct-p08/B08071.js';
import { B08091 } from '../ct-p08/B08091.js';
import { B09080 } from '../ct-p09/B09080.js';
import { PR264 } from '../pr-01/PR264.js';
import { PR270 } from '../pr-01/PR270.js';

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
import { B05062 } from '../ct-p05/B05062.js';
import { B06103 } from '../ct-p06/B06103.js';
import { B06103P } from '../ct-p06/B06103P.js';
import { B08078 } from '../ct-p08/B08078.js';
import { B08078P } from '../ct-p08/B08078P.js';
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
import { B07076 } from '../ct-p07/B07076.js';
import { B07076P } from '../ct-p07/B07076P.js';
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
import { B09078 } from '../ct-p09/B09078.js';
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
import { PR158 } from '../pr-01/PR158.js';
import { PR164 } from '../pr-01/PR164.js';
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
import { B04055 } from '../ct-p04/B04055.js';
import { B07080 } from '../ct-p07/B07080.js';
import { B07080P } from '../ct-p07/B07080P.js';
import { B04011 } from '../ct-p04/B04011.js';
import { B08058 } from '../ct-p08/B08058.js';
import { B08058P } from '../ct-p08/B08058P.js';
import { B09021 } from '../ct-p09/B09021.js';
import { B09021P } from '../ct-p09/B09021P.js';
import { B04068 } from '../ct-p04/B04068.js';
import { B04068P } from '../ct-p04/B04068P.js';
import { B04069 } from '../ct-p04/B04069.js';
import { B04069P } from '../ct-p04/B04069P.js';
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
// engine変更0 wave (2026-06-24): engine additive wave a206e9dc で解放された DEFER を card-session が出荷
import { B08023 } from '../ct-p08/B08023.js';
import { B08023P } from '../ct-p08/B08023P.js';
import { B08050 } from '../ct-p08/B08050.js';
import { B08050P } from '../ct-p08/B08050P.js';
import { B08059 } from '../ct-p08/B08059.js';
import { B08059P } from '../ct-p08/B08059P.js';
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
import { B02067 } from '../ct-p02/B02067.js';
import { B02067P } from '../ct-p02/B02067P.js';
import { B04003 } from '../ct-p04/B04003.js';
import { B04003P } from '../ct-p04/B04003P.js';
import { B08081 } from '../ct-p08/B08081.js';
import { B08081P } from '../ct-p08/B08081P.js';
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
import { B07033 } from '../ct-p07/B07033.js';
import { B07033P } from '../ct-p07/B07033P.js';
import { B07033P2 } from '../ct-p07/B07033P2.js';
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
import { B04042 } from '../ct-p04/B04042.js';
import { B04042P } from '../ct-p04/B04042P.js';
import { B04084 } from '../ct-p04/B04084.js';
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
import { B09072 } from '../ct-p09/B09072.js';
import { B09072P } from '../ct-p09/B09072P.js';
import { B09072P2 } from '../ct-p09/B09072P2.js';
import { B07002 } from '../ct-p07/B07002.js';
import { B07002P } from '../ct-p07/B07002P.js';
import { B03085 } from '../ct-p03/B03085.js';
import { B03085P } from '../ct-p03/B03085P.js';
import { B05032 } from '../ct-p05/B05032.js';
import { B05111 } from '../ct-p05/B05111.js';
import { B07059 } from '../ct-p07/B07059.js';
import { B07059P } from '../ct-p07/B07059P.js';
import { B07060 } from '../ct-p07/B07060.js';
import { B07060P } from '../ct-p07/B07060P.js';
import { PR195 } from '../pr-01/PR195.js';
import { PR196 } from '../pr-01/PR196.js';
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
import { B06005 } from '../ct-p06/B06005.js';
import { B06005P } from '../ct-p06/B06005P.js';
import { B06012 } from '../ct-p06/B06012.js';
import { B06012P } from '../ct-p06/B06012P.js';
import { B08008 } from '../ct-p08/B08008.js';
import { B08003 } from '../ct-p08/B08003.js';
import { B08003P } from '../ct-p08/B08003P.js';
import { B06013 } from '../ct-p06/B06013.js';
import { B06013P } from '../ct-p06/B06013P.js';
import { B06064 } from '../ct-p06/B06064.js';
import { B06064P } from '../ct-p06/B06064P.js';
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
import { B08063 } from '../ct-p08/B08063.js';
import { B08063P } from '../ct-p08/B08063P.js';
import { PR236 } from '../pr-01/PR236.js';
import { PR242 } from '../pr-01/PR242.js';

import { B03077 } from '../ct-p03/B03077.js';

import { PR085 } from '../pr-01/PR085.js';
import { PR091 } from '../pr-01/PR091.js';

import { B05102 } from '../ct-p05/B05102.js';

import { B01071 } from '../ct-p01/B01071.js';
import { B02079 } from '../ct-p02/B02079.js';
import { B03058 } from '../ct-p03/B03058.js';
import { B07050 } from '../ct-p07/B07050.js';

import { B07064 } from '../ct-p07/B07064.js';
import { B03076 } from '../ct-p03/B03076.js';
import { B08085 } from '../ct-p08/B08085.js';
import { B09076 } from '../ct-p09/B09076.js';
import { B09076P } from '../ct-p09/B09076P.js';

import { B05013 } from '../ct-p05/B05013.js';
import { B06017 } from '../ct-p06/B06017.js';
import { B06017P } from '../ct-p06/B06017P.js';
import { B06019 } from '../ct-p06/B06019.js';

import { B01044 } from '../ct-p01/B01044.js';
import { B01044P } from '../ct-p01/B01044P.js';
import { B03094 } from '../ct-p03/B03094.js';
import { B03094P } from '../ct-p03/B03094P.js';
import { B05061 } from '../ct-p05/B05061.js';
import { B05061P } from '../ct-p05/B05061P.js';
import { B06016 } from '../ct-p06/B06016.js';
import { B06016P } from '../ct-p06/B06016P.js';

import { B02075 } from '../ct-p02/B02075.js';
import { B02075P } from '../ct-p02/B02075P.js';
import { B02066 } from '../ct-p02/B02066.js';
import { B02066P } from '../ct-p02/B02066P.js';
import { B05091 } from '../ct-p05/B05091.js';
import { B05091P } from '../ct-p05/B05091P.js';
import { B05099 } from '../ct-p05/B05099.js';
import { B05099P } from '../ct-p05/B05099P.js';
import { B05058 } from '../ct-p05/B05058.js';
import { B05116 } from '../ct-p05/B05116.js';

import { B07069 } from '../ct-p07/B07069.js';
import { B07069P } from '../ct-p07/B07069P.js';
import { PR099 } from '../pr-01/PR099.js';
import { B05030 } from '../ct-p05/B05030.js';

import { B05035 } from '../ct-p05/B05035.js';

import { B05016 } from '../ct-p05/B05016.js';
import { B05016P } from '../ct-p05/B05016P.js';
import { B09079 } from '../ct-p09/B09079.js';
import { B06048 } from '../ct-p06/B06048.js';
import { B06048P } from '../ct-p06/B06048P.js';

import { B06053 } from '../ct-p06/B06053.js';
import { B06053P } from '../ct-p06/B06053P.js';

import { B01075 } from '../ct-p01/B01075.js';
import { B01089 } from '../ct-p01/B01089.js';
import { B03092 } from '../ct-p03/B03092.js';
import { B03092P } from '../ct-p03/B03092P.js';
import { B05059 } from '../ct-p05/B05059.js';
import { B05059P } from '../ct-p05/B05059P.js';

import { B05021 } from '../ct-p05/B05021.js';
import { B03019 } from '../ct-p03/B03019.js';
import { B05077 } from '../ct-p05/B05077.js';
import { B07086 } from '../ct-p07/B07086.js';
import { B07043 } from '../ct-p07/B07043.js';
import { B02058 } from '../ct-p02/B02058.js';
import { B02058P } from '../ct-p02/B02058P.js';
import { B02050 } from '../ct-p02/B02050.js';
import { B05114 } from '../ct-p05/B05114.js';
import { B05082 } from '../ct-p05/B05082.js';
import { B05082P } from '../ct-p05/B05082P.js';
import { B07010 } from '../ct-p07/B07010.js';
import { B09074 } from '../ct-p09/B09074.js';
import { B09074P } from '../ct-p09/B09074P.js';
import { B09074P2 } from '../ct-p09/B09074P2.js';
import { D10003 } from '../ct-d10/D10003.js';
import { D10004 } from '../ct-d10/D10004.js';
import { B03115 } from '../ct-p03/B03115.js';
import { B03115P } from '../ct-p03/B03115P.js';
import { B03036 } from '../ct-p03/B03036.js';
import { B03036P } from '../ct-p03/B03036P.js';

import { B06100 } from '../ct-p06/B06100.js';
import { B06100P } from '../ct-p06/B06100P.js';

import { B06079 } from '../ct-p06/B06079.js';
import { B03124 } from '../ct-p03/B03124.js';
import { B03068 } from '../ct-p03/B03068.js';
import { PR094 } from '../pr-01/PR094.js';

import { B08075 } from '../ct-p08/B08075.js';
import { B08075P } from '../ct-p08/B08075P.js';
import { B08092 } from '../ct-p08/B08092.js';
import { B08043 } from '../ct-p08/B08043.js';
import { B08043P } from '../ct-p08/B08043P.js';
import { B07037 } from '../ct-p07/B07037.js';
import { B07045 } from '../ct-p07/B07045.js';
import { B02033 } from '../ct-p02/B02033.js';
import { B03095 } from '../ct-p03/B03095.js';
import { B04019 } from '../ct-p04/B04019.js';
import { B04079 } from '../ct-p04/B04079.js';
import { B05014 } from '../ct-p05/B05014.js';
import { B09063 } from '../ct-p09/B09063.js';
import { B09066 } from '../ct-p09/B09066.js';
import { D01008 } from '../ct-d01/D01008.js';

import { B02008 } from '../ct-p02/B02008.js';
import { B02073 } from '../ct-p02/B02073.js';
import { B07024 } from '../ct-p07/B07024.js';
import { D07018 } from '../ct-d07/D07018.js';
import { D02005 } from '../ct-d02/D02005.js';
import { PR036 } from '../pr-01/PR036.js';

import { B03035 } from '../ct-p03/B03035.js';
import { B03088 } from '../ct-p03/B03088.js';
import { B04037 } from '../ct-p04/B04037.js';
import { B06058 } from '../ct-p06/B06058.js';

import { B03066 } from '../ct-p03/B03066.js';
import { B03066P } from '../ct-p03/B03066P.js';
import { B09061 } from '../ct-p09/B09061.js';
import { B09096 } from '../ct-p09/B09096.js';
import { B09096P } from '../ct-p09/B09096P.js';

import { B02057 } from '../ct-p02/B02057.js';
import { B02057P } from '../ct-p02/B02057P.js';
import { B03062 } from '../ct-p03/B03062.js';
import { B03062P } from '../ct-p03/B03062P.js';
import { B03088P } from '../ct-p03/B03088P.js';
import { B04085 } from '../ct-p04/B04085.js';
import { B04085P } from '../ct-p04/B04085P.js';
import { B06004 } from '../ct-p06/B06004.js';
import { B06004P } from '../ct-p06/B06004P.js';
import { B06021 } from '../ct-p06/B06021.js';
import { B06021P } from '../ct-p06/B06021P.js';
import { B06077 } from '../ct-p06/B06077.js';
import { B06077P } from '../ct-p06/B06077P.js';
import { B07031P } from '../ct-p07/B07031P.js';
import { B07047P } from '../ct-p07/B07047P.js';
import { B09056 } from '../ct-p09/B09056.js';
import { B09056P } from '../ct-p09/B09056P.js';

import { B03051 } from '../ct-p03/B03051.js';
import { B03033 } from '../ct-p03/B03033.js';
import { B03033P } from '../ct-p03/B03033P.js';
import { B03118 } from '../ct-p03/B03118.js';
import { B04075 } from '../ct-p04/B04075.js';
import { B04092 } from '../ct-p04/B04092.js';
import { B08086 } from '../ct-p08/B08086.js';

import { B06006 } from '../ct-p06/B06006.js';

import { B09086 } from '../ct-p09/B09086.js';
import { B04090 } from '../ct-p04/B04090.js';

import { PR136 } from '../pr-01/PR136.js';
import { PR142 } from '../pr-01/PR142.js';
import { B08036 } from '../ct-p08/B08036.js';
import { B05049 } from '../ct-p05/B05049.js';
import { B05049P } from '../ct-p05/B05049P.js';
import { B03084 } from '../ct-p03/B03084.js';
import { B03084P } from '../ct-p03/B03084P.js';
import { B05045 } from '../ct-p05/B05045.js';
import { B05045P } from '../ct-p05/B05045P.js';
import { B05079 } from '../ct-p05/B05079.js';
import { B03057 } from '../ct-p03/B03057.js';
import { B03057P } from '../ct-p03/B03057P.js';
import { B08087 } from '../ct-p08/B08087.js';
import { B09040 } from '../ct-p09/B09040.js';
import { B09040P } from '../ct-p09/B09040P.js';
import { B03052 } from '../ct-p03/B03052.js';
import { B03052P } from '../ct-p03/B03052P.js';
import { B02047 } from '../ct-p02/B02047.js';
import { B05115 } from '../ct-p05/B05115.js';
import { B09004 } from '../ct-p09/B09004.js';
import { B08035 } from '../ct-p08/B08035.js';
import { B01012 } from '../ct-p01/B01012.js';
import { B06008 } from '../ct-p06/B06008.js';
import { B06008P } from '../ct-p06/B06008P.js';
import { B09048 } from '../ct-p09/B09048.js';
import { B08006 } from '../ct-p08/B08006.js';
import { B07096 } from '../ct-p07/B07096.js';
import { B05041 } from '../ct-p05/B05041.js';
import { B05041P } from '../ct-p05/B05041P.js';
import { B08028 } from '../ct-p08/B08028.js';
import { B04074 } from '../ct-p04/B04074.js';
import { B04074P } from '../ct-p04/B04074P.js';
import { B04088 } from '../ct-p04/B04088.js';
import { B04088P } from '../ct-p04/B04088P.js';
import { B04072 } from '../ct-p04/B04072.js';
import { B03046 } from '../ct-p03/B03046.js';
import { B08014 } from '../ct-p08/B08014.js';
import { B09090 } from '../ct-p09/B09090.js';
import { B01058 } from '../ct-p01/B01058.js';
import { B08069 } from '../ct-p08/B08069.js';
import { B03126 } from '../ct-p03/B03126.js';
import { B02088 } from '../ct-p02/B02088.js';
import { B07026 } from '../ct-p07/B07026.js';
import { B05042 } from '../ct-p05/B05042.js';
import { B08026 } from '../ct-p08/B08026.js';
import { D10005 } from '../ct-d10/D10005.js';
import { B07014 } from '../ct-p07/B07014.js';
import { B01039 } from '../ct-p01/B01039.js';
import { B09070 } from '../ct-p09/B09070.js';
import { B09108 } from '../ct-p09/B09108.js';
import { B09108P } from '../ct-p09/B09108P.js';
import { B09003 } from '../ct-p09/B09003.js';
import { B09003P } from '../ct-p09/B09003P.js';
import { PR105 } from '../pr-01/PR105.js';
import { B06085 } from '../ct-p06/B06085.js';
import { B04093 } from '../ct-p04/B04093.js';
import { D10006 } from '../ct-d10/D10006.js';
import { PR029 } from '../pr-01/PR029.js';
import { PR033 } from '../pr-01/PR033.js';
import { PR281 } from '../pr-01/PR281.js';
import { PR282 } from '../pr-01/PR282.js';
import { PR283 } from '../pr-01/PR283.js';
import { PR286 } from '../pr-01/PR286.js';
import { PR293 } from '../pr-01/PR293.js';
import { PR294 } from '../pr-01/PR294.js';
import { PR299 } from '../pr-01/PR299.js';
import { PR300 } from '../pr-01/PR300.js';
import { PR301 } from '../pr-01/PR301.js';
import { PR303 } from '../pr-01/PR303.js';
import { B02088P } from '../ct-p02/B02088P.js';
import { B03046P } from '../ct-p03/B03046P.js';
import { B08014P } from '../ct-p08/B08014P.js';
import { B09004P } from '../ct-p09/B09004P.js';
import { B09070P } from '../ct-p09/B09070P.js';
import { B09090P } from '../ct-p09/B09090P.js';
import { B09090P2 } from '../ct-p09/B09090P2.js';
import { B04058 } from '../ct-p04/B04058.js';
import { PR028 } from '../pr-01/PR028.js';
import { PR032 } from '../pr-01/PR032.js';
import { B01035 } from '../ct-p01/B01035.js';
import { D06009 } from '../ct-d06/D06009.js';
import { B02049 } from '../ct-p02/B02049.js';
import { PR039 } from '../pr-01/PR039.js';
import { B06086 } from '../ct-p06/B06086.js';
import { PR288 } from '../pr-01/PR288.js';
import { PR179 } from '../pr-01/PR179.js';
import { PR185 } from '../pr-01/PR185.js';
import { PR291 } from '../pr-01/PR291.js';
import { PR297 } from '../pr-01/PR297.js';
import { PR277 } from '../pr-01/PR277.js';
import { D02008 } from '../ct-d02/D02008.js';
import { B03104 } from '../ct-p03/B03104.js';
import { B03098 } from '../ct-p03/B03098.js';
import { B06086P } from '../ct-p06/B06086P.js';
import { B03098P } from '../ct-p03/B03098P.js';
import { B01051 } from '../ct-p01/B01051.js';
import { B01084 } from '../ct-p01/B01084.js';
import { B01085 } from '../ct-p01/B01085.js';
import { B01095 } from '../ct-p01/B01095.js';
import { B02062 } from '../ct-p02/B02062.js';
import { B03070 } from '../ct-p03/B03070.js';
import { B05031 } from '../ct-p05/B05031.js';
import { B05103 } from '../ct-p05/B05103.js';
import { B06018 } from '../ct-p06/B06018.js';
import { B06028 } from '../ct-p06/B06028.js';
import { B06043 } from '../ct-p06/B06043.js';
import { B06065 } from '../ct-p06/B06065.js';
import { B06095 } from '../ct-p06/B06095.js';
import { B06068 } from '../ct-p06/B06068.js';
import { B06082 } from '../ct-p06/B06082.js';
import { B06098 } from '../ct-p06/B06098.js';
import { B07022 } from '../ct-p07/B07022.js';
import { B07032 } from '../ct-p07/B07032.js';
import { B07036 } from '../ct-p07/B07036.js';
import { B09016 } from '../ct-p09/B09016.js';
import { B09022 } from '../ct-p09/B09022.js';
import { B09089 } from '../ct-p09/B09089.js';
import { PR302 } from '../pr-01/PR302.js';
import { B05012 } from '../ct-p05/B05012.js';
import { B01084P } from '../ct-p01/B01084P.js';
import { B03070P } from '../ct-p03/B03070P.js';
import { B05031P } from '../ct-p05/B05031P.js';
import { B05103P } from '../ct-p05/B05103P.js';
import { B06018P } from '../ct-p06/B06018P.js';
import { B06028P } from '../ct-p06/B06028P.js';
import { B06043P } from '../ct-p06/B06043P.js';
import { B06065P } from '../ct-p06/B06065P.js';
import { B06095P } from '../ct-p06/B06095P.js';
import { B06068P } from '../ct-p06/B06068P.js';
import { B06082P } from '../ct-p06/B06082P.js';
import { B06098P } from '../ct-p06/B06098P.js';
import { B07032P } from '../ct-p07/B07032P.js';
import { B07036P } from '../ct-p07/B07036P.js';
import { B09022P } from '../ct-p09/B09022P.js';
import { B09089P } from '../ct-p09/B09089P.js';
import { B02006 } from '../ct-p02/B02006.js';
import { B02080 } from '../ct-p02/B02080.js';
import { B02076 } from '../ct-p02/B02076.js';
import { B04038 } from '../ct-p04/B04038.js';
import { B05072 } from '../ct-p05/B05072.js';
import { B07039 } from '../ct-p07/B07039.js';
import { B07046 } from '../ct-p07/B07046.js';
import { PR132 } from '../pr-01/PR132.js';
import { PR201 } from '../pr-01/PR201.js';
import { PR200 } from '../pr-01/PR200.js';
import { PR278 } from '../pr-01/PR278.js';
import { PR133 } from '../pr-01/PR133.js';
import { PR027 } from '../pr-01/PR027.js';
import { PR031 } from '../pr-01/PR031.js';
import { PR213 } from '../pr-01/PR213.js';
import { PR285 } from '../pr-01/PR285.js';
import { PR207 } from '../pr-01/PR207.js';
import { PR206 } from '../pr-01/PR206.js';
import { B01047 } from '../ct-p01/B01047.js';
import { B01081 } from '../ct-p01/B01081.js';
import { B03003 } from '../ct-p03/B03003.js';
import { B03024 } from '../ct-p03/B03024.js';
import { B05022 } from '../ct-p05/B05022.js';
import { B05068 } from '../ct-p05/B05068.js';
import { B06062 } from '../ct-p06/B06062.js';
import { B06078 } from '../ct-p06/B06078.js';
import { B06104 } from '../ct-p06/B06104.js';
import { B08025 } from '../ct-p08/B08025.js';
import { B08076 } from '../ct-p08/B08076.js';
import { B01023 } from '../ct-p01/B01023.js';
import { D10024 } from '../ct-d10/D10024.js';

import { PR289 } from '../pr-01/PR289.js';
import { PR295 } from '../pr-01/PR295.js';
import { PR292 } from '../pr-01/PR292.js';
import { PR298 } from '../pr-01/PR298.js';
import { B03047 } from '../ct-p03/B03047.js';
import { B03050 } from '../ct-p03/B03050.js';
import { B03080 } from '../ct-p03/B03080.js';
import { B03134 } from '../ct-p03/B03134.js';
import { B04027 } from '../ct-p04/B04027.js';
import { B04032 } from '../ct-p04/B04032.js';
import { B04077 } from '../ct-p04/B04077.js';
import { B05051 } from '../ct-p05/B05051.js';
import { B05081 } from '../ct-p05/B05081.js';
import { B05086 } from '../ct-p05/B05086.js';
import { B05086P } from '../ct-p05/B05086P.js';
import { B06063 } from '../ct-p06/B06063.js';
import { B06072 } from '../ct-p06/B06072.js';
import { B06074 } from '../ct-p06/B06074.js';
import { B06084 } from '../ct-p06/B06084.js';
import { B07015 } from '../ct-p07/B07015.js';
import { B08062 } from '../ct-p08/B08062.js';
import { B08064 } from '../ct-p08/B08064.js';
import { B08072 } from '../ct-p08/B08072.js';
import { B08073 } from '../ct-p08/B08073.js';
import { B09002 } from '../ct-p09/B09002.js';
import { PR304 } from '../pr-01/PR304.js';
import { PR290 } from '../pr-01/PR290.js';
import { PR296 } from '../pr-01/PR296.js';
import { B05023 } from '../ct-p05/B05023.js';
import { B07005 } from '../ct-p07/B07005.js';
import { PR067 } from '../pr-01/PR067.js';
import { B07054 } from '../ct-p07/B07054.js';
import { B01045 } from '../ct-p01/B01045.js';
import { B01054 } from '../ct-p01/B01054.js';
import { B04063 } from '../ct-p04/B04063.js';
import { B01005 } from '../ct-p01/B01005.js';
import { B03002 } from '../ct-p03/B03002.js';
import { B05005 } from '../ct-p05/B05005.js';
import { B03110 } from '../ct-p03/B03110.js';
import { B03133 } from '../ct-p03/B03133.js';
import { B05092 } from '../ct-p05/B05092.js';
import { B01009 } from '../ct-p01/B01009.js';
import { B01009P } from '../ct-p01/B01009P.js';
import { B09095 } from '../ct-p09/B09095.js';
import { B09095P } from '../ct-p09/B09095P.js';
import { B01005P } from '../ct-p01/B01005P.js';
import { B01023P } from '../ct-p01/B01023P.js';
import { B01047P } from '../ct-p01/B01047P.js';
import { B01054P } from '../ct-p01/B01054P.js';
import { B01081P } from '../ct-p01/B01081P.js';
import { B02006P } from '../ct-p02/B02006P.js';
import { B02076P } from '../ct-p02/B02076P.js';
import { B03002P } from '../ct-p03/B03002P.js';
import { B03003P } from '../ct-p03/B03003P.js';
import { B03024P } from '../ct-p03/B03024P.js';
import { B03047P } from '../ct-p03/B03047P.js';
import { B03080P } from '../ct-p03/B03080P.js';
import { B03110P } from '../ct-p03/B03110P.js';
import { B04027P } from '../ct-p04/B04027P.js';
import { B04032P } from '../ct-p04/B04032P.js';
import { B04063P } from '../ct-p04/B04063P.js';
import { B04077P } from '../ct-p04/B04077P.js';
import { B05005P } from '../ct-p05/B05005P.js';
import { B05005P2 } from '../ct-p05/B05005P2.js';
import { B05023P } from '../ct-p05/B05023P.js';
import { B06062P } from '../ct-p06/B06062P.js';
import { B06063P } from '../ct-p06/B06063P.js';
import { B06072P } from '../ct-p06/B06072P.js';
import { B06074P } from '../ct-p06/B06074P.js';
import { B06078P } from '../ct-p06/B06078P.js';
import { B06084P } from '../ct-p06/B06084P.js';
import { B06085P } from '../ct-p06/B06085P.js';
import { B06104P } from '../ct-p06/B06104P.js';
import { B07014P } from '../ct-p07/B07014P.js';
import { B07015P } from '../ct-p07/B07015P.js';
import { B07026P } from '../ct-p07/B07026P.js';
import { B07039P } from '../ct-p07/B07039P.js';
import { B07054P } from '../ct-p07/B07054P.js';
import { B08025P } from '../ct-p08/B08025P.js';
import { B08062P } from '../ct-p08/B08062P.js';
import { B08076P } from '../ct-p08/B08076P.js';
import { B08092P } from '../ct-p08/B08092P.js';
import { B09002P } from '../ct-p09/B09002P.js';
import { B09086P } from '../ct-p09/B09086P.js';

import { B05047 } from '../ct-p05/B05047.js';
import { B03049 } from '../ct-p03/B03049.js';
import { B03049P } from '../ct-p03/B03049P.js';
import { B01022 } from '../ct-p01/B01022.js';
import { B01093 } from '../ct-p01/B01093.js';
import { B02072 } from '../ct-p02/B02072.js';
import { B02072P } from '../ct-p02/B02072P.js';
import { B08057 } from '../ct-p08/B08057.js';

import { PR263 } from '../pr-01/PR263.js';
import { PR269 } from '../pr-01/PR269.js';
import { B03029 } from '../ct-p03/B03029.js';
import { B05120 } from '../ct-p05/B05120.js';
import { B06109 } from '../ct-p06/B06109.js';
import { B07068 } from '../ct-p07/B07068.js';
import { B08038 } from '../ct-p08/B08038.js';
import { B09111 } from '../ct-p09/B09111.js';
import { B09110 } from '../ct-p09/B09110.js';
import { PR284 } from '../pr-01/PR284.js';
import { B05118 } from '../ct-p05/B05118.js';
import { B05119 } from '../ct-p05/B05119.js';
import { B06106 } from '../ct-p06/B06106.js';
import { B06107 } from '../ct-p06/B06107.js';
import { B06108 } from '../ct-p06/B06108.js';
import { B03135 } from '../ct-p03/B03135.js';
import { D07024 } from '../ct-d07/D07024.js';
import { B02002 } from '../ct-p02/B02002.js';
import { B02013 } from '../ct-p02/B02013.js';
import { B02018 } from '../ct-p02/B02018.js';
import { B02031 } from '../ct-p02/B02031.js';
import { B03028 } from '../ct-p03/B03028.js';
import { B03078 } from '../ct-p03/B03078.js';
import { B05015 } from '../ct-p05/B05015.js';
import { B05027 } from '../ct-p05/B05027.js';
import { B05087 } from '../ct-p05/B05087.js';
import { B05088 } from '../ct-p05/B05088.js';
import { B05106 } from '../ct-p05/B05106.js';
import { B06026 } from '../ct-p06/B06026.js';
import { D06013 } from '../ct-d06/D06013.js';
import { B06027 } from '../ct-p06/B06027.js';
import { B06025 } from '../ct-p06/B06025.js';
import { B06090 } from '../ct-p06/B06090.js';
import { B07053 } from '../ct-p07/B07053.js';
import { B07013 } from '../ct-p07/B07013.js';
import { B07065 } from '../ct-p07/B07065.js';
import { B08004 } from '../ct-p08/B08004.js';
import { B08033 } from '../ct-p08/B08033.js';
import { B08082 } from '../ct-p08/B08082.js';
import { PR096 } from '../pr-01/PR096.js';
import { B02013P } from '../ct-p02/B02013P.js';
import { B02018P } from '../ct-p02/B02018P.js';
import { B02031P } from '../ct-p02/B02031P.js';
import { B03028P } from '../ct-p03/B03028P.js';
import { B03029P } from '../ct-p03/B03029P.js';
import { B03078P } from '../ct-p03/B03078P.js';
import { B03135P } from '../ct-p03/B03135P.js';
import { B05027P } from '../ct-p05/B05027P.js';
import { B05087P } from '../ct-p05/B05087P.js';
import { B05087P2 } from '../ct-p05/B05087P2.js';
import { B05088P } from '../ct-p05/B05088P.js';
import { B05088P2 } from '../ct-p05/B05088P2.js';
import { B05106P } from '../ct-p05/B05106P.js';
import { B05118P } from '../ct-p05/B05118P.js';
import { B05119P } from '../ct-p05/B05119P.js';
import { B05120P } from '../ct-p05/B05120P.js';
import { B06090P } from '../ct-p06/B06090P.js';
import { B06106P } from '../ct-p06/B06106P.js';
import { B06107P } from '../ct-p06/B06107P.js';
import { B06108P } from '../ct-p06/B06108P.js';
import { B06109P } from '../ct-p06/B06109P.js';
import { B07065P } from '../ct-p07/B07065P.js';
import { B07068P } from '../ct-p07/B07068P.js';
import { B08004P } from '../ct-p08/B08004P.js';
import { B08033P } from '../ct-p08/B08033P.js';
import { B08038P } from '../ct-p08/B08038P.js';
import { B09111P } from '../ct-p09/B09111P.js';
import { B09110P } from '../ct-p09/B09110P.js';
// CARD PHASE M2 attribution mini-wave (2026-07-10): byPlayer 束 6 + costPaid 束 6
import { B03112 } from '../ct-p03/B03112.js';
import { B03116 } from '../ct-p03/B03116.js';
import { B04089 } from '../ct-p04/B04089.js';
import { B04091 } from '../ct-p04/B04091.js';
import { B04094 } from '../ct-p04/B04094.js';
import { B05107 } from '../ct-p05/B05107.js';
import { B07025 } from '../ct-p07/B07025.js';
import { B08041 } from '../ct-p08/B08041.js';
import { B08068 } from '../ct-p08/B08068.js';
import { B09005 } from '../ct-p09/B09005.js';
import { B09050 } from '../ct-p09/B09050.js';
import { B09060 } from '../ct-p09/B09060.js';

import { D06003 } from '../ct-d06/D06003.js';
import { D06004 } from '../ct-d06/D06004.js';
import { D06021 } from '../ct-d06/D06021.js';
import { D06023 } from '../ct-d06/D06023.js';
import { B07100 } from '../ct-p07/B07100.js';
import { PR234 } from '../pr-01/PR234.js';
import { PR240 } from '../pr-01/PR240.js';
import { B01057 } from '../ct-p01/B01057.js';
import { B05063 } from '../ct-p05/B05063.js';
import { PR265 } from '../pr-01/PR265.js';
import { PR271 } from '../pr-01/PR271.js';
import { B09019 } from '../ct-p09/B09019.js';
import { B04048 } from '../ct-p04/B04048.js';
import { B06003 } from '../ct-p06/B06003.js';
import { B07008 } from '../ct-p07/B07008.js';
import { B08047 } from '../ct-p08/B08047.js';
import { B06066 } from '../ct-p06/B06066.js';
import { B01057P } from '../ct-p01/B01057P.js';
import { B03112P } from '../ct-p03/B03112P.js';
import { B03116P } from '../ct-p03/B03116P.js';
import { B04048P } from '../ct-p04/B04048P.js';
import { B04089P } from '../ct-p04/B04089P.js';
import { B04091P } from '../ct-p04/B04091P.js';
import { B04094P } from '../ct-p04/B04094P.js';
import { B05063P } from '../ct-p05/B05063P.js';
import { B05107P } from '../ct-p05/B05107P.js';
import { B06003P } from '../ct-p06/B06003P.js';
import { B06066P } from '../ct-p06/B06066P.js';
import { B08047P } from '../ct-p08/B08047P.js';
import { B08068P } from '../ct-p08/B08068P.js';
import { B09019P } from '../ct-p09/B09019P.js';
import { B06037 } from '../ct-p06/B06037.js';
import { B06037P } from '../ct-p06/B06037P.js';
import { B08046 } from '../ct-p08/B08046.js';
import { B08046P } from '../ct-p08/B08046P.js';
import { B08093 } from '../ct-p08/B08093.js';
import { B08093P } from '../ct-p08/B08093P.js';




import { B01020 } from '../ct-p01/B01020.js';
import { B01077 } from '../ct-p01/B01077.js';
import { B03111 } from '../ct-p03/B03111.js';
import { B05052 } from '../ct-p05/B05052.js';
import { B05117 } from '../ct-p05/B05117.js';
import { B07099 } from '../ct-p07/B07099.js';
import { B07102 } from '../ct-p07/B07102.js';
import { B08019 } from '../ct-p08/B08019.js';
import { B08019P } from '../ct-p08/B08019P.js';
import { B09027 } from '../ct-p09/B09027.js';
import { B09027P } from '../ct-p09/B09027P.js';
import { B03111P } from '../ct-p03/B03111P.js';
import { B05117P } from '../ct-p05/B05117P.js';
import { B07049 } from '../ct-p07/B07049.js';
import { D10009 } from '../ct-d10/D10009.js';
import { D10010 } from '../ct-d10/D10010.js';
import { B07063 } from '../ct-p07/B07063.js';
import { B07063P } from '../ct-p07/B07063P.js';
import { B04073 } from '../ct-p04/B04073.js';
import { B03008 } from '../ct-p03/B03008.js';
import { B03040 } from '../ct-p03/B03040.js';
import { B02084 } from '../ct-p02/B02084.js';
import { B02084P } from '../ct-p02/B02084P.js';
import { B03041 } from '../ct-p03/B03041.js';
import { B03041P } from '../ct-p03/B03041P.js';
import { B03042 } from '../ct-p03/B03042.js';
import { B09107 } from '../ct-p09/B09107.js';
import { B09107P } from '../ct-p09/B09107P.js';
import { B02087 } from '../ct-p02/B02087.js';
import { B02087P } from '../ct-p02/B02087P.js';
import { B05007 } from '../ct-p05/B05007.js';
import { B05007P } from '../ct-p05/B05007P.js';
import { B05097 } from '../ct-p05/B05097.js';
import { B07030 } from '../ct-p07/B07030.js';
import { B07030P } from '../ct-p07/B07030P.js';
import { B07030P2 } from '../ct-p07/B07030P2.js';
import { B07061 } from '../ct-p07/B07061.js';
import { B07061P } from '../ct-p07/B07061P.js';
import { B09055 } from '../ct-p09/B09055.js';
import { B09047 } from '../ct-p09/B09047.js';
import { B09052 } from '../ct-p09/B09052.js';
import { B09052P } from '../ct-p09/B09052P.js';
import { B09055P } from '../ct-p09/B09055P.js';
import { B09055P2 } from '../ct-p09/B09055P2.js';
import { B03063 } from '../ct-p03/B03063.js';
import { B09011 } from '../ct-p09/B09011.js';
import { B09112 } from '../ct-p09/B09112.js';
import { B09112P } from '../ct-p09/B09112P.js';
import { B09113 } from '../ct-p09/B09113.js';
import { B09113P } from '../ct-p09/B09113P.js';
import { B05009 } from '../ct-p05/B05009.js';
import { B05009P } from '../ct-p05/B05009P.js';
import { D10022 } from '../ct-d10/D10022.js';
import { B01070 } from '../ct-p01/B01070.js';
import { B05075 } from '../ct-p05/B05075.js';
import { B09011P } from '../ct-p09/B09011P.js';
// night-wC (2026-07-11): charGrantAbility declared 解禁 + hirameki optional humanChooser
import { B06042 } from '../ct-p06/B06042.js';
import { B06042P } from '../ct-p06/B06042P.js';
import { B06046 } from '../ct-p06/B06046.js';
import { B06046P } from '../ct-p06/B06046P.js';
import { B06032 } from '../ct-p06/B06032.js';
import { B06032P } from '../ct-p06/B06032P.js';
import { B09081 } from '../ct-p09/B09081.js';


import { B05093 } from '../ct-p05/B05093.js';
import { B05093P } from '../ct-p05/B05093P.js';
import { B06023 } from '../ct-p06/B06023.js';
import { B06034 } from '../ct-p06/B06034.js';
import { B03093 } from '../ct-p03/B03093.js';
import { B05101 } from '../ct-p05/B05101.js';
import { B06036 } from '../ct-p06/B06036.js';
import { B06036P } from '../ct-p06/B06036P.js';
import { B06105 } from '../ct-p06/B06105.js';
import { B06105P } from '../ct-p06/B06105P.js';
import { B07001 } from '../ct-p07/B07001.js';
import { B07001P } from '../ct-p07/B07001P.js';
import { B07001P2 } from '../ct-p07/B07001P2.js';
import { B08002 } from '../ct-p08/B08002.js';
import { B08002P } from '../ct-p08/B08002P.js';
import { B09039 } from '../ct-p09/B09039.js';
import { B09105 } from '../ct-p09/B09105.js';
import { B09105P } from '../ct-p09/B09105P.js';
import { B09109 } from '../ct-p09/B09109.js';
import { B09109P } from '../ct-p09/B09109P.js';
import { PR279 } from '../pr-01/PR279.js';

import { B06020 } from '../ct-p06/B06020.js';
import { B07003 } from '../ct-p07/B07003.js';
import { B07003P } from '../ct-p07/B07003P.js';
import { B09033 } from '../ct-p09/B09033.js';
import { B09033P } from '../ct-p09/B09033P.js';
import { B10001, B10001P } from '../ct-p10/B10001.js';
import { B10002, B10002P } from '../ct-p10/B10002.js';
import { B10003, B10003P } from '../ct-p10/B10003.js';
import { B10004, B10004P } from '../ct-p10/B10004.js';
import { B10005, B10005P } from '../ct-p10/B10005.js';
import { B10006 } from '../ct-p10/B10006.js';
import { B10007, B10007P } from '../ct-p10/B10007.js';
import { B10008 } from '../ct-p10/B10008.js';
import { B10009 } from '../ct-p10/B10009.js';
import { B10010 } from '../ct-p10/B10010.js';
import { B10011 } from '../ct-p10/B10011.js';
import { B10012, B10012P } from '../ct-p10/B10012.js';
import { B10013, B10013P } from '../ct-p10/B10013.js';
import { B10014, B10014P } from '../ct-p10/B10014.js';
import { B10015 } from '../ct-p10/B10015.js';
import { B10016 } from '../ct-p10/B10016.js';
import { B10017, B10017P } from '../ct-p10/B10017.js';
import { B10018, B10018P } from '../ct-p10/B10018.js';
import { B10019, B10019P } from '../ct-p10/B10019.js';
import { B10020, B10020P } from '../ct-p10/B10020.js';
import { B10021, B10021P } from '../ct-p10/B10021.js';
import { B10022, B10022P } from '../ct-p10/B10022.js';
import { B10023, B10023P } from '../ct-p10/B10023.js';
import { B10024, B10024P } from '../ct-p10/B10024.js';
import { B10025 } from '../ct-p10/B10025.js';
import { B10026, B10026P } from '../ct-p10/B10026.js';
import { B10027, B10027P } from '../ct-p10/B10027.js';
import { B10028 } from '../ct-p10/B10028.js';
import { B10029 } from '../ct-p10/B10029.js';
import { B10030 } from '../ct-p10/B10030.js';
import { B10031 } from '../ct-p10/B10031.js';
import { B10032, B10032P } from '../ct-p10/B10032.js';
import { B10033, B10033P } from '../ct-p10/B10033.js';
import { B10034, B10034P } from '../ct-p10/B10034.js';
import { B10035, B10035P } from '../ct-p10/B10035.js';
import { B10036, B10036P } from '../ct-p10/B10036.js';
import { B10037, B10037P } from '../ct-p10/B10037.js';
import { B10038, B10038P } from '../ct-p10/B10038.js';
import { B10039, B10039P } from '../ct-p10/B10039.js';
import { B10040 } from '../ct-p10/B10040.js';
import { B10041 } from '../ct-p10/B10041.js';
import { B10042 } from '../ct-p10/B10042.js';
import { B10043 } from '../ct-p10/B10043.js';
import { B10044 } from '../ct-p10/B10044.js';
import { B10045 } from '../ct-p10/B10045.js';
import { B10046 } from '../ct-p10/B10046.js';
import { B10047 } from '../ct-p10/B10047.js';
import { B10048, B10048P } from '../ct-p10/B10048.js';
import { B10049, B10049P } from '../ct-p10/B10049.js';
import { B10050, B10050P } from '../ct-p10/B10050.js';
import { B10051 } from '../ct-p10/B10051.js';
import { B10052, B10052P } from '../ct-p10/B10052.js';
import { B10053 } from '../ct-p10/B10053.js';
import { B10054, B10054P } from '../ct-p10/B10054.js';
import { B10055 } from '../ct-p10/B10055.js';
import { B10056 } from '../ct-p10/B10056.js';
import { B10057 } from '../ct-p10/B10057.js';
import { B10058 } from '../ct-p10/B10058.js';
import { B10059 } from '../ct-p10/B10059.js';
import { B10060, B10060P } from '../ct-p10/B10060.js';
import { B10061, B10061P } from '../ct-p10/B10061.js';
import { B10062Sec1, B10062Sec2 } from '../ct-p10/B10062.js';
import { B10063, B10063P, B10063Sec1, B10063Sec2 } from '../ct-p10/B10063.js';
import { B10064, B10064P } from '../ct-p10/B10064.js';
import { B10065, B10065P, B10065P2 } from '../ct-p10/B10065.js';
import { B10066, B10066P, B10066P2 } from '../ct-p10/B10066.js';
import { B10067, B10067P, B10067P2, B10067P3 } from '../ct-p10/B10067.js';
import { B10068, B10068P, B10068P2 } from '../ct-p10/B10068.js';
import { B10069 } from '../ct-p10/B10069.js';
import { B10070, B10070P } from '../ct-p10/B10070.js';
import { B10071, B10071P } from '../ct-p10/B10071.js';
import { B10072 } from '../ct-p10/B10072.js';
import { B10073 } from '../ct-p10/B10073.js';
import { B10074 } from '../ct-p10/B10074.js';
import { B10075 } from '../ct-p10/B10075.js';
import { B10076 } from '../ct-p10/B10076.js';
import { B10077 } from '../ct-p10/B10077.js';
import { B10078 } from '../ct-p10/B10078.js';
import { B10079 } from '../ct-p10/B10079.js';
import { B10080 } from '../ct-p10/B10080.js';
import { B10081, B10081P } from '../ct-p10/B10081.js';
import { B10082, B10082P } from '../ct-p10/B10082.js';
import { B10083, B10083P } from '../ct-p10/B10083.js';
import { B10084, B10084P } from '../ct-p10/B10084.js';
import { B10085, B10085P } from '../ct-p10/B10085.js';
import { B10086, B10086P } from '../ct-p10/B10086.js';
import { B10087 } from '../ct-p10/B10087.js';
import { B10088, B10088P } from '../ct-p10/B10088.js';
import { B10089 } from '../ct-p10/B10089.js';
import { B10090 } from '../ct-p10/B10090.js';
import { B10091 } from '../ct-p10/B10091.js';
import { B10092 } from '../ct-p10/B10092.js';
import { B10093 } from '../ct-p10/B10093.js';
import { B10094 } from '../ct-p10/B10094.js';
import { B10095 } from '../ct-p10/B10095.js';
import { B10096, B10096P } from '../ct-p10/B10096.js';
import { B10097, B10097P } from '../ct-p10/B10097.js';
import { B10098 } from '../ct-p10/B10098.js';
import { B10098P } from '../ct-p10/B10098P.js';
import { B10099, B10099P } from '../ct-p10/B10099.js';
import { B10100, B10100P } from '../ct-p10/B10100.js';
import { B10101, B10101P } from '../ct-p10/B10101.js';
import { B10102 } from '../ct-p10/B10102.js';
import { B10102P } from '../ct-p10/B10102P.js';

export const REUSE_CARDS: CardDef[] = [
  D01003, D01004, D01006, D01010, D01015, D02002, D02009, D02013,
  D02015, D03002, D03010, D03011, D03015, D04002, D04004, D04008,
  D04015, D05002, D05004, D05011, D05015, D06005, D06006, D06010,
  D06011, D06015, D06017, D06018, D06019, D06020, D06022, D06024,
  D07004, D07005, D07016, D07017, D07022, D09006, D09007, D09008,
  D09009, D09022, D09023, D09026, D10012, D10025, D10026, B01008, B01027,
  B01028, B01028P, B01029, B01032, B01040, B01040P, B01046, B01049,
  B01063, B01064, B01083, B01087, B01088, B01091, B01092, B01092P, B01094, B01094P,
  B01099, B01099P, B01100, B01100P, B01101, B01101P, B01102, B01102P,
  B02009, B02010, B02022, B02022P, B02032, B02051, B02060, B02061, B02074, B02074P,
  B02082, B02086, B02086P, B02089, B02089P, B02090, B02091, B03004, B03009, B03010,
  B03010P, B03011, B03015, B03015P, B03021, B03021P, B03022, B03022P,
  B03026, B03037, B03043, B03048, B03048P, B03054, B03054P, B03055,
  B03060, B03060P, B03064, B03067, B03067P, B03074, B03082, B03087,
  B03087P, B03100, B03103, B03103P, B03105, B03114, B03114P, B03125,
  B03127, B03136, B03137, B03138, B04005, B04005P, B04008, B04009,
  B04020, B04025, B04035, B04035P, B04036, B04046, B04046P, B04047, B04047P, B04050,
  B04050P, B04052, B04052P, B04054, B04054P, B04056, B04056P, B04060,
  B04070, B04070P, B04071, B04071P, B04080, B04096, B04096P, B05018,
  B05018P, B05037, B05038, B05055, B05067, B05067P, B05069, B05071,
  B05083, B05083P, B05089, B05089P, B05089P2, B05109, B05110, B05110P,
  B05112, B06030, B06030P, B06035, B06040, B06040P, B06047, B06056, B06060,
  B06070, B06071, B06071P, B06075, B06075P, B06091, B06093, B06094,
  B06094P, B06099, B06099P, B07007, B07007P, B07007P2, B07012, B07012P,
  B07016, B07016P,
  B07016P2, B07018, B07018P, B07021, B07040, B07048, B07056, B07056P, B07062,
  B07062P, B07071, B07074, B07083, B07083P, B07087, B07087P, B07088,
  B07091, B07091P, B07095, B07095P, B07101, B08007, B08009, B08015,
  B08021, B08021P, B08022, B08030, B08030P, B08039, B08040, B08056,
  B08065, B08065P, B08080, B08080P, B09006, B09006P, B09014, B09018, B09024,
  B09025, B09025P, B09029, B09037, B09037P, B09042, B09044, B09044P,
  B09046, B09046P, B09049, B09051, B09064, B09067, B09067P, B09083, B09085, B09088,
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
  B04024, B05057, B06088, B05060, B05062, B06103, B06103P, B08078, B08078P, B03007, PR061, PR065, PR180, PR186, PR084, PR090,
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
  B09092, B09092P, B07081, B04064, B04055, B07080, B07080P, B04011, B08058, B08058P, B09021, B09021P, B04068, B04068P, B04069, B04069P, B05050, PR100, PR106, B08037, B08037P, B09028, PR181, PR187, B09054, B09054P, B09041, B09041P, B07090, B07090P, B08029, B08029P, B08032, B08032P, B09032, B07079, B07079P, B02014,
  // Task A wave#2 codegen3 (D09016/D09017 FILE6行動 / B05076 解決編)。B08020/P は共有 engine gap で defer (BUG-132)
  B05076, D09016, D09017,
  // engine拡張 wave#2 — BUG-132 GAP-1/2 修正後の B08020/P 再採用
  B08020, B08020P,
  // engine変更0 wave (2026-06-24): engine additive wave a206e9dc 解放分。B08023/P=carrier-reuse×3 choice /
  // B08050/P=【解決編】lvlDelta+3 + 登場時 deck-look(boundToRemove + cardNameNot discard)
  B08023, B08023P, B08050, B08050P, B08059, B08059P,
  // engine拡張 wave#2 cluster2 (2026-06-12): ability-presence filter 解禁 10枚
  // (現場リムーブ時/疾風/カットイン presence — X1 述語 + X1b 窓/bound filter + X6 boundToRemove + X7/X8 骨格バグ修正)
  B03128, B03131, B08005, B08005P, B08016, B08094, B08094P, B09073, B09073P, B09104,
  // engine拡張 wave#2 cluster3 — action-lifecycle trigger 15枚
  B01036, B01037, B01068, B01067, B02067, B02067P, B04003, B04003P, B08081, B08081P, B02068, B03097, B03073, D04005, D04007, B08012, B08012P, B08048, B05108, PR086, PR092,
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
  B07033, B07033P, B07033P2, B07034, B07034P, PR231,
  // engine拡張 wave#2 cluster11 (enter-source-level filter, BUG-146 coupled)
  B01014, B01015, B01021, B07019,
  // engine拡張 wave#2 cluster12 — nested-filter-dyn (FILE-level enter events)
  D01014, B04013, D02014, B04026, D03014, B04040, D04014, B04061, D05014, B04083, B04042, B04042P, B04084, D07023, B03132, B03132P, B08060, B08060P,
  // engine拡張 wave#2 cluster13 — aura-grant (他キャラ AP buff)
  D05005, D07010, D07011, B01038, B01038P, B02012, B03075, B07044, B09009, PR274, PR275,
  // engine拡張 wave#2 cluster14 — multi-card sceneEnter
  B09010, B09010P, PR042, PR046,
  // engine拡張 wave-9 (2026-07-02) — wave-8 shippuFiredThisTurn flag 初 consumer + carrier-reuse (engine変更0)
  B09072, B09072P, B09072P2,
  // engine拡張 wave-11 (2026-07-02) — hirameki actor payload ($trigger.byUid「アクション中のキャラ」) consumer
  B03085, B03085P, B05032, B05111,
  // Task A batch
  B01018, B01062, B01062P, B01066, B01066P, B02003, B02003P, B02005, B02005P, B02019, B02019P, B02044, B02044P, B02077, B02077P, PR080, B03005, D10020, D10021, B03025, B03086, B03086P, B03089, B03089P, D09020, B04014, B04014P, B04017, B04017P, B05006, B05006P, B05006P2, B05020, B05020P, B05046, B05046P, B05046P2, B06005, B06005P, B06011, B06011P, B06012, B06012P, B06013, B06013P, B06064, B06064P, PR170, B07004, B07004P, B07020, B07020P, B07023, B07023P, B07098, B07098P, D09004, D09005, PR193, PR060, PR064, PR154, B08003, B08003P, B08008,
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
  B08063, B08063P,
  // handToEvidence micro-cluster (2026-06-21): 手札⇔証拠 swap (「証拠1つ選び手札へ。そうした場合、手札1枚を
  //   裏向きで証拠として得る」chain[evidenceToHand, handToEvidence])。ヘビ男 (新 verb handToEvidence)。
  B06029, B06029P,
  B06033, B06033P,
  // evidence-top-to-hand micro-cluster (2026-06-21)
  B03077,
  // evidence-self→hand wave (hirameki このカード手札に加える)
  PR085, PR091,
  // turn-scope levelDelta wave — 小五郎の弟子 (engine変更0)
  B05102,
  // Task A batch
  B01071, B02079, B03058,
  // wave-trigdraw — triggered-draw 4枚
  B07050,
  // engine拡張 wave evidence-flip-faceup (2026-06-23)
  B07064, B03076, B08085, B09076, B09076P,
  // wave evidence-flip-facedown — 表向き証拠を裏向き 4枚
  B05013, B06017, B06017P, B06019,
  // wave deck-mill-gated-chain (2026-06-23)
  B01044, B01044P, B03094, B03094P, B05061, B05061P, B06016, B06016P,
  // wave leave-from-remove — 現場リムーブ時→リムーブエリアから登場/手札 10枚
  B02075, B02075P, B02066, B02066P, B05091, B05091P, B05099, B05099P, B05058, B05116,
  // wave codegen-handcount-setevent (2026-06-23)
  B07069, B07069P, PR099, B05030,
  // BUG-153 解禁 B05035 (set-facedown host-check)
  B05035,
  // wave decklook-enter-handadd — deck-look→hand-add 7枚 (engine変更0、B06053/P は YAIBA event trait backfill で解禁)
  B05016, B05016P, B09079, B06048, B06048P,
  // wave decklook-enter-handadd — B06053/P 追加 (YAIBA event trait backfill 解禁)
  B06053, B06053P,
  // engine拡張 wave removedFilter (removedCharMatches.removedFilter) — 離場キャラ属性 observer 6枚
  B01075, B01089, B03092, B03092P, B05059, B05059P,
  // wave leave-reveal-until 2026-06-23 (7 cards, engine変更0)
  B05021, B03019, B05077, B07086, B07043, B02058, B02058P,
  // wave reveal-handadd — reveal/deck-look→hand-add 10枚 (engine変更0)
  B02050, B05114, B05082, B05082P, B07010, B09074, B09074P, B09074P2, D10003, D10004,
  // wave decklook-remove-discard — 越水七槻/ラム 4枚 (engine変更0)
  B03115, B03115P, B03036, B03036P,
  // .tmp/wave-new.json
  B06100, B06100P,
  // .tmp/final-specs-v2.json
  B06079, B03124, B03068, PR094,
  // wave event-choose3 — B08075 ブライダルは女が主役 2枚 (engine変更0)
  B08075, B08075P,
  // Task A batch
  B08092, B02033, B03095, B04019, B04079, B05014, B09063, B09066, D01008,
  // Task A batch
  B02008, B02073, B07024, D07018,
  // Task A batch
  D02005, PR036,
  // wave engine0-triage-0628 — 70 未certify候補を triage(9 GREEN)→敵対verify(6 CONFIRMED+2 NEEDS_FIX, 1 REFUTED=B08059)。engine変更0
  //   B03023 脇田兼則(enter観測 log no-op + hirameki) / B06057 ゲロ田(白YAIBAイベント使用reaction draw + hirameki) /
  //   B08071 佐藤正義(宣言 removeFromScene self + deck-look佐藤美和子 + cutin contactTargetMatches) /
  //   B08091 マッドサイエンティスト(事件青&黒 enter conditional colorNot→現場リムーブ時revive + leave evidenceFlipDown) /
  //   B09080 高木渉(絆佐藤美和子 突撃grant + aura cardName AP+1000) / PR264/PR270 宮野明美(突撃[キャラ]印字 + 解決編lvlDelta+2 + enter突撃[事件]grant) /
  //   B07104/P ミステリーコースター(sceneRemove + 突撃grant短縮形(BUG-158 fix) + forEach mill) / B03020 毛利蘭(action blind-mill3 → AP+1000)
  B03020, B03023, B06057, B07104, B07104P, B08071, B08091, B09080, PR264, PR270,
  // Task A batch
  B03035, B04037, B06058, B03088,
  // wave engine0 tierA (2026-06-29) — G15 relative-AP filter: certify-yellow が cluster12 nested-filter-dyn
  //   解禁前の stale だった。apMin/apMax:{dyn:'$self.ap'} で「このキャラと同じAP」を pick 列挙前 literalize
  //   (probe 3/3 pass、engine変更0)。B09096/P キャンティ。
  B09096, B09096P,
  // ENGINE0 wave (2026-06-29) — B09061 ジェイムズ・ブラック (FBI)。a1 登場時 = handReveal exact-N gate
  //   (n:3 FBI 候補<3 で chainStepNoApply→draw skip、core.ts atomHandReveal、本カードのために 2026-06-28 導入) + draw。
  //   a2 ヒラメキ = handAddFromRemove(max:1 trait FBI) → 加えた場合 discard 1 (chain gating、B03053 a2 同型)。engine変更0。
  B09061,
  // ENGINE0 wave (2026-06-29) — B03066/P 赤井秀一。a1=partnerColorKeyword(赤,突撃[事件]) /
  //   a2 登場時=optional[evidenceGain opp, sceneRemove lv7以下 1まで either] (B01069+B07080 twin)。engine変更0。
  B03066, B03066P,
  // wave engine0 0629 — certify greens + P-clones (engine変更0)
  B02057, B02057P, B03062, B03062P, B03088P, B04085, B04085P, B06004, B06004P, B06021, B06021P, B06077, B06077P, B07047P, B09056, B09056P,
  // engine additive wave-7 exemplar (2026-07-02, P17 actedCharThisTurn) — B08049 ジョディ・スターリング
  //   (a1 turn-end FBI≥4 draw = 既存 sceneHas / a2 宣言 sleepSelf → 今ターン アクション[キャラ]した FBI を activate)。
  //   B08049P は同効果 clone → 2026-07-02 B3-1 で出荷済 (下記)。
  B08049,
  // engine additive wave-10 exemplar (2026-07-02) — B07002/P 江戸川コナン
  //   (a1 draw2→discard2 bind→boundDistinctColorCount→sceneRemove apMax8000 / a2 宣言 cost sleepChar 探偵 →
  //   setCutinBan+setDisguiseBan opp)。boundDistinctColorCount + turn-scoped cutin/変装 ban + BUG-165 fix の初 consumer。
  B07002, B07002P,
  // B3-1 conflict canonical 化 unlock (2026-07-02) — P printing clone 2枚 (base 出荷済・同テキスト、engine変更0):
  //   B07031P (小泉紅子 SRP、faceUp:false 行の conflict 解消で compile 可化) / B08049P (ジョディ RP、DEFERRED-INDEX 予告分)。
  B07031P, B08049P,
  // engine wave-12 exemplar (2026-07-02, G39 PA 一般カード枠) — 「このカードをパートナーエリアに移す」族
  //   6 printings (移動4テキスト全数): B07059/P 赤い涙 (【パートナー白】sceneRemove apMax8000 → toPartnerArea) /
  //   B07060/P クリスタル・マザー (draw + sceneEnter levelMax dyn fileCount → toPartnerArea) /
  //   PR195/196 ブルーサファイア (deckRevealUntil 中森青子 → toPartnerArea)。全カード a2 ヒラメキ = toPartnerArea。
  //   新 verb toPartnerArea + PlayerState.partnerAreaCards の初 consumer。特徴[ビッグジュエル] は公式 API category1 由来。
  B07059, B07059P, B07060, B07060P, PR195, PR196,
  // engine additive wave-13 exemplar (2026-07-02, A2 lane) — $self.removeNameCount dyn 初 consumer。
  //   犯人 PR158/PR164 (同一 0627・別アート) カットイン「自分のリムーブエリアの[犯人]1枚につき AP+2000
  //   （このカードも含める）」= D08007 sceneTrait dyn カットインと同型。自身は resolve 時点で remove 内 (計数される)。
  PR158, PR164,
  // engine additive wave-14 exemplar (2026-07-02, A2 lane) — $self.sceneMaxLp dyn 初 consumer。
  //   B08043/B08043P 手のこんだ悪巧み (イベント) 「相手の現場のキャラが自分の現場で LP がもっとも高い
  //   キャラの LP 以下の場合リムーブ」= lpMax:{dyn:'$self.sceneMaxLp'} (G15 相対AP と同経路の相対LP filter)。
  B08043, B08043P,
  // engine wave A1 exemplar (2026-07-02, G39 PA 計数・消費) — 新 verb partnerAreaRemove + PA-read sceneHas。
  //   B07037 黒羽快斗 (【登場時】PA の[ビッグジュエル]2枚リムーブしてもよい→そうした場合 remove の中森青子
  //   を1枚までスリープ登場、optional{chain[partnerAreaRemove n:2, sceneEnter from:remove]}) /
  //   B07045 セリザベス女王 (engine0: ミスリード1 + ターン終了時 PA に[ビッグジュエル]あれば自身 active、
  //   conditional{sceneHas area:'partner-area'})。
  B07037, B07045,
  // card-authoring wave15 — stale-DEFER 解禁 (handAddFromDeckBottom sole-gate)
  B03051,
  B03033, B03033P,
  // card-authoring wave16 — cutin:used observer 初 consumer ($contact.byUid AP+, engine変更0)
  B03118,
  // card-authoring wave17 — $self.oppSceneCount aura + D11013型cutin (engine変更0)
  B08086,
  // CARD PHASE #2 B06006 江戸川コナン
  B06006,
  // engine wave-18 exemplar (2026-07-03, inContact TargetQuery + contact emit enrichment) — contact-participant pick 初 consumer:
  //   B04075 白鳥任三郎 (【ターン1】相手 cutin/変装 → コンタクト中キャラ1枚 AP-1000、multi-hook + triggerPlayerIs opp + inContact pick) /
  //   B04092 キャンティ (自分の他キャラ contact:start → optional self-sleep → コンタクト中キャラ1枚 AP+2000、or payloadKey + inContact pick)。
  //   parked inContact 軸 land + disguise:into/contact:start emit に player/contactBindings 追加。残 clone (PR029/PR033/B04093) は card-phase。
  B04075, B04092,
  // CARD PHASE #3 — cutin:used ペア (B09086 諸伏高明 / B04090 ライ、engine変更0)
  B09086, B04090,
  // engine mega-wave W1 — 5 primitive exemplar (PR136/PR142 deckOwner / B08036 setCard-remove-src / B05049/P revealHandToDeckTop / B03084/P sceneToEvidence+evidenceToDeckBottom / B05045/P handToFileBottom)
  PR136, PR142, B08036, B05049, B05049P, B03084, B03084P, B05045, B05045P,
  // engine mega-wave W2 — restriction/observer exemplar (B05079 hirameki-deny / B03057+P untargetable+ability:declared)
  B05079, B03057, B03057P,
  // engine mega-wave W2b — UI重 restriction exemplar (B08087 mustBeSelectedByOppEvent / B09040+P mustGuard)
  B08087, B09040, B09040P,
  // engine mega-wave W3 — observer hook exemplar (B03052+P disguise:replaced / B02047 disguiseReplacedMatches /
  // B05115 hand:removed / B09004 hand:reveal)
  B03052, B03052P, B02047, B05115, B09004,
  // engine mega-wave W4 step1 — r82 bindPick exemplar (B08035 怪盗キッド: 共有 pick → 排他 conditional
  // sleep→stun/active→sleep + 裏向きセット限定 charRemoveSetCard faceDownOnly)
  B08035,
  // engine mega-wave W4 step2 — r83 enter:group + fromGroup exemplar (B01012 阿笠博士:
  // 効果登場 batch 集約 →「その中から1枚」active + 迅速 rider。
  B01012,
  // engine mega-wave W4 step3 — r5 charStackCard fromSelf exemplar (B06008+P 仮面ヤイバー:
  // アクション終了時 self を host の下に重ねる = mutate.scene.toStack 非リムーブ離場 + chain draw)
  B06008, B06008P,
  // engine mega-wave W4 step4 — r6/r7 stack-under cost exemplar (B09048 中森銀三 sceneStackUnderSelf /
  // B08006 小嶋元太 handStackUnder + ヒラメキ $trigger.byUid スタン)
  B09048, B08006,
  // engine mega-wave W4 step6 — r62 filtered-突撃 exemplar (B07096 ウォッカ: partnerColorFilteredAssault
  // 突撃[レベル4以下のキャラ] + removedCharMatches observer + cutin。B08074 は trait-declare 未実装で DEFER)
  B07096,
  // engine mega-wave W4 step7 — r1 P01 protection rider exemplar (B05041+P「オレのそばから離れんなや…」:
  // charSetCard fromSelf + on-set-host opponentRestrict[remove,sleep,stun] + ヒラメキ self-to-hand)
  B05041, B05041P,
  // engine mega-wave W5 — r38 evidenceFlip mirror-count bind exemplar (B08028 日向幸)
  B08028,
  // engine mega-wave W5 — r47 levelInBound exemplar (B04074/P 降谷零)
  B04074, B04074P,
  // engine mega-wave W5 — r37 removeDeckTop.n dyn exemplar (B04088/P スコッチ)
  B04088, B04088P,
  // CARD PHASE step12 batch1
  B04072,
  // CARD PHASE step12 batch1
  B03046, B08014, B09090, B01058, B08069, B03126, B02088, B07026, B05042, B08026, D10005, B07014, B01039,
  // CARD PHASE step12 batch1 (B09070)
  B09070,
  // CARD PHASE step12 batch2 — declareName family (B09108/B09003/PR105、DeclareCardNameModal 配線と同 commit)
  B09108, B09108P, B09003, B09003P, PR105,
  // CARD PHASE step12 batch3 (2026-07-04): B06085 松田陣平 — evidenceGain faceUp 初 consumer
  B06085,
  // CARD PHASE step12 batch3 (2026-07-04): compiler T0/T1 batch 15枚 + parallel spread 7枚
  B04093, D10006, PR029, PR033, PR281, PR282, PR283, PR286, PR293, PR294, PR299, PR300, PR301, PR303, B02088P, B03046P, B08014P, B09004P, B09070P, B09090P, B09090P2,
  // .tmp/_hybrid_specs.json
  B04058, PR028, PR032, B01035, D06009, B02049, PR039, B06086, PR288, PR179, PR185, PR291, PR297, PR277, D02008, B03104, B03098,
  // hybrid-pilot-1 P variants
  B06086P, B03098P,
  // Task A batch
  B01051, B01084, B01085, B01095, B02062, B03070, B05031, B05103, B06018, B06028, B06043, B06046, B06065, B06068, B06082, B06095, B06098, B07022, B07032, B07036, B09016, B09022, B09089, PR302,
  // Task A batch
  B05012,
  // CARD PHASE hybrid-batch2 P spread
  B01084P, B03070P, B05031P, B05103P, B06018P, B06028P, B06043P, B06046P, B06065P, B06068P, B06082P, B06095P, B06098P, B07032P, B07036P, B09022P, B09089P,
  // Task A batch
  B02006, B02080, B02076, B04038, B05072, B07039, B07046, PR132, PR200, PR201,
  // Task A batch
  PR278, PR133, PR027, PR031, PR213, PR285, PR206, PR207,
  // CARD PHASE hybrid batch
  B01047, B01081, B03003, B03024, B05022, B05068, B06062, B06078, B06104, B08025, B08076, B01023, D10024,
  // CARD PHASE hybrid-batch4
  PR289, PR295, PR292, PR298, B03047, B03050, B03080, B03134, B04027, B04032, B04077, B05051, B05081, B05086, B05086P, B06063, B06072, B06074, B06084,
  // CARD PHASE hybrid-batch5
  B07015, B08062, B08064, B08072, B08073, B09002, PR304,
  // CARD PHASE hybrid-batch6
  PR290, PR296, B05023, B07005, PR067, B07054,
  // CARD PHASE miniwave-lp consumers
  B01045, B01054, B04063,
  // CARD PHASE miniwave2-nexthint consumers
  B01005, B03002, B05005,
  // CARD PHASE miniwave3 consumers
  B03110, B03133, B05092,
  // CARD PHASE miniwave4 consumers (hand 内 continuous level)
  B01009, B01009P, B09095, B09095P,
  // CARD PHASE P-spread sweep 2026-07-10 (base 出荷済 + TSV 全列同文の slim clone 39 枚)
  B01005P, B01023P, B01047P, B01054P, B01081P, B02006P, B02076P, B03002P,
  B03003P, B03024P, B03047P, B03080P, B03110P, B04027P, B04032P, B04063P,
  B04077P, B05005P, B05005P2, B05023P, B06062P, B06063P, B06072P, B06074P,
  B06078P, B06084P, B06085P, B06104P, B07014P, B07015P, B07026P, B07039P,
  B07054P, B08025P, B08062P, B08076P, B08092P, B09002P, B09086P,
  // CARD PHASE mini-wave #5 deck-reveal
  B05047,
  // CARD PHASE mini-wave #5 deck-reveal
  B03049, B03049P,
  // CARD PHASE S2 deck cluster (deck-window multi-deploy / souza dyn X / 非所有者 deck-place / remove 3-tier)
  B01022, B01093, B02072, B02072P, B08057,
  // CARD PHASE M1 mega-sweep
  PR263, PR269, B03029, B05120, B06109, B07068, B08038, B09110, B09111, PR284, B05118, B05119, B06106, B06107, B06108, B03135, D07024, B02002, B02013, B02018, B02031, B03028, B03078, B05015, B05027, B05087, B05088, B05106, B06026, B06090, B07053, B07065, B08004, B08033, B08082, PR096,
  // CARD PHASE P-spread sweep 2026-07-10 (base 出荷済 + TSV 全列同文の slim clone 25 枚)
  B02013P, B02018P, B02031P, B03028P, B03029P, B03078P, B03135P, B05027P,
  B05087P, B05087P2, B05088P, B05088P2, B05106P, B05118P, B05119P, B05120P, B06090P, B06106P,
  B06107P, B06108P, B06109P, B07065P, B07068P, B08004P, B08033P, B08038P,
  B09110P, B09111P,
  // CARD PHASE M2 attribution mini-wave (byPlayer emit + costPaid write)
  B03112, B03116, B04089, B04091, B04094, B05107,
  B07025, B08041, B08068, B09005, B09050, B09060,
  // M2 latter batch (2026-07-10): set-card + dyn-counter + cutin-filter 15 unit
  D06003, D06004, D06021, D06023, B07100, PR234, PR240, B01057, B05063, PR265, PR271, B09019, B04048, B06003, B07008, B08047, B06066,
  // CARD PHASE P-spread sweep 2026-07-10 (base 出荷済 + TSV 全列同文の slim clone 0 枚)

  // CARD PHASE P-spread sweep 2026-07-10 (base 出荷済 + TSV 全列同文の slim clone 0 枚)

  // CARD PHASE P-spread sweep 2026-07-10 (base 出荷済 + TSV 全列同文の slim clone 0 枚)

  // CARD PHASE P-spread sweep 2026-07-10 (base 出荷済 + TSV 全列同文の slim clone 14 枚)
  B01057P, B03112P, B03116P, B04048P, B04089P, B04091P, B04094P, B05063P,
  B05107P, B06003P, B06066P, B08047P, B08068P, B09019P,
  // M3 PA batch (2026-07-10): PA宣言 MR 3 unit + P twin (scope on-partner-area 解禁)
  B06037, B06037P, B08046, B08046P, B08093, B08093P,
  // night-w0: stale-DEFER GREEN 6 + cost-choice UI 2 + multi-pick UI 1 (2026-07-11)
  B01020, B01077, B03111, B05052, B05117, B07099, B07102, B08019, B08019P, B09027, B09027P,
  // night-w0 P spread (B03111P/B05117P)
  B03111P, B05117P,
  // night-wA: engine additive wave A (verb/hook/cond/dyn/cost) exemplar 19 printings (2026-07-11)
  B07049, D10009, D10010, B07063, B07063P, B04073, B03008, B03040, B02084, B02084P, B03041, B03041P, B03042, B09107, B09107P, B02087, B02087P, B05007, B05007P, B05097,
  // night-wB: param 拡張 wave B exemplar 12 printings (2026-07-11)
  B07030, B07030P, B07030P2, B07061, B07061P, B09055, B09055P, B09055P2, B03063, B09011, B09112, B09112P, B09113, B09113P, B05009, B05009P, D10022, B01070, B05075,
  // night-wB P spread 補完 (B09011P)
  B09011P,
  // night-wC (2026-07-11): charGrantAbility declared 解禁 (B06042) + hirameki optional humanChooser (B06032/B09081)
  B06042, B06042P, B06032, B06032P, B09081,
  // CARD PHASE P-spread sweep 2026-07-10 (base 出荷済 + TSV 全列同文の slim clone 0 枚)

  // WC2a: B05093/P opp-chooser deck-reveal (chooser opp-of-owner)
  B05093, B05093P,
  // night-wC2b invokeHiramekiOfCard (B06023/B06034)
  B06023, B06034,
  // S1/S2 deferred-card completion
  B03093, B05101, B06036, B06036P, B06105, B06105P, B07001, B07001P, B07001P2, B08002, B08002P, B09039, B09105, B09105P, B09109, B09109P, PR279,
  // S3 hand-zone cutin aura
  B06020, B07003, B07003P,
  // T3 repeat deck window
  B09033, B09033P,
  // Wave D: opponent-effect target protection
  B01006, B01006P, B03030, B03030P, B05008, B05008P, B05048, B08017, B08017P,
  // deferred T3 wave: bearer guard ban, exact evidence return, self-inclusive level
  B01082, B06025,
  B06027,
  B07013,
  B09047,
  B09052, B09052P,
  D06013,
  // CT-P10 wave 1
  B10001, B10001P, B10002, B10002P, B10003, B10003P, B10004, B10004P, B10005, B10005P, B10006, B10007, B10007P, B10008, B10009, B10010, B10011, B10012, B10012P, B10013, B10013P, B10014, B10014P, B10015, B10016, B10017, B10017P, B10018, B10018P, B10019, B10019P, B10020, B10020P, B10021, B10021P, B10022, B10022P, B10023, B10023P, B10024, B10024P, B10025, B10026, B10026P, B10027, B10027P,
  B10028, B10029, B10030, B10031, B10032, B10032P, B10033, B10033P, B10034, B10034P, B10035, B10035P, B10036, B10036P, B10037, B10037P, B10038, B10038P, B10039, B10039P, B10040,
  B10041, B10042, B10043, B10044, B10045, B10046, B10047, B10048, B10048P, B10049, B10049P, B10050, B10050P, B10051, B10052, B10052P, B10053, B10054, B10054P, B10055, B10056, B10057,
  B10058, B10059, B10060, B10060P, B10061, B10061P, B10062Sec1, B10062Sec2, B10063, B10063P, B10063Sec1, B10063Sec2, B10064, B10064P, B10065, B10065P, B10065P2, B10066, B10066P, B10066P2,
  B10067, B10067P, B10067P2, B10067P3, B10068, B10068P, B10068P2, B10069, B10070, B10070P, B10071, B10071P, B10072, B10073,
  B10074, B10075, B10076, B10077, B10078, B10079, B10080, B10081, B10082, B10083,
  B10081P, B10082P, B10083P, B10084, B10084P, B10085, B10085P, B10086, B10086P, B10087, B10088, B10088P, B10089, B10090, B10091, B10092, B10093, B10094, B10095, B10096, B10096P, B10097, B10097P, B10098, B10098P, B10099, B10099P, B10100, B10100P, B10101, B10101P, B10102, B10102P,
  // T3 same-effective-name count / hand-reveal nameOverride
  B09036, B09036P,
  // Remaining-27 Wave 2: discard-down level-sum event.
  B07076, B07076P,
  B09078,
  B08074,
  B07011,
  B02039,
  B02052, B02052P,
  B05033,
];
