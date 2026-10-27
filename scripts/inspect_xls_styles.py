import json
import os
import sys
sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '.tools', 'xls-reader'))
import xlrd

for filename in os.listdir('D:/維運材料需求管理/excel範本'):
    if not filename.endswith('.xls'):
        continue
    book = xlrd.open_workbook('D:/維運材料需求管理/excel範本/' + filename, formatting_info=True)
    sheet = book.sheet_by_index(0)
    occupied = []
    for r in range(sheet.nrows):
        values = sheet.row_values(r)
        if any(value != '' for value in values):
            occupied.append((r + 1, values))
    print(json.dumps({'file': filename, 'occupiedRows': len(occupied), 'lastRows': occupied[-5:], 'fonts': [{'name': f.name, 'size': f.height / 20, 'bold': f.bold, 'colorIndex': f.colour_index} for f in book.font_list], 'styles': len(book.xf_list), 'firstStyles': [{'cell': (r + 1, c + 1), 'xf': sheet.cell_xf_index(r, c), 'font': book.xf_list[sheet.cell_xf_index(r, c)].font_index} for r in range(4) for c in [0, 1, 4, 7, 9]], 'materialRows': sum(1 for _, values in occupied if len(values) > 1 and str(values[0]).strip().replace('.0', '').isdigit() and values[1])}, ensure_ascii=False))
