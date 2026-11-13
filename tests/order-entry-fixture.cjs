const names=['2mm² 1C 電線 白色','2mm² 1C 電線 黑色','2mm² 1C 電線 紅色','3.5mm² 2C 電纜 黑色','8mm² 1C 電線 綠色','LED E40公園燈 75W 白光','LED E27 燈泡 35W','LED E27 燈泡 75W','ELCB 2P 15AT 30mA 0.1S','束帶 120CM','電源 65W','電源 130W','保護套'];
const catalog=names.map((name,i)=>({id:'ENTRY-'+i,name,displayName:name,unit:i<5?'M':i===9?'條':'個',vendor:'伸泰',minQty:i<5?100:1,stepQty:i<5?100:1,requiresRemarks:false,tags:[],aliases:[],category:i<5?'線材':'照明及五金',subcategory:'',...(i===6?{packUnit:'箱',unitsPerPack:12}:i===7?{packUnit:'箱',unitsPerPack:24}:{})}));
const note='以上電線每棧版請堆疊勿超過850公斤，搬運前請聯絡現場。';
const text=[...names.slice(0,5).map(n=>n+' 100M*5卷'),note,'LED 40公園燈 75W 白光 1箱',names[6]+' 1箱',names[7]+' 1箱',names[8]+' 50只',names[9]+' 50條',names[10]+' 80個',names[11]+' 50個',names[12]+' 100只'].join('\n');
module.exports={catalog,names,note,text};
