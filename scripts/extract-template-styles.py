"""Read legacy XLS files; emit template metadata without altering the originals."""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '.tools', 'xls-reader'))
import xlrd

output = os.path.join(os.path.dirname(__file__), '..', '.tools', 'template-source')
os.makedirs(output, exist_ok=True)
for vendor, key, filename in [('伸泰', 'shentai', '高雄-維運-材料清單_20260916-伸泰範本.xls'), ('益詮', 'yiquan', '高雄-換裝-材料清單_20260916-益詮範本.xls')]:
    book = xlrd.open_workbook('D:/維運材料需求管理/excel範本/' + filename, formatting_info=True)
    sheet = book.sheet_by_index(0)
    last_row = max(r for r in range(sheet.nrows) if any(value != '' for value in sheet.row_values(r))) + 1
    def color(index):
        rgb = book.colour_map.get(index)
        return '#%02X%02X%02X' % rgb if rgb else None
    styles = []
    for xf in book.xf_list:
        font = book.font_list[xf.font_index]
        styles.append({'font': {'name': font.name, 'size': font.height / 20, 'bold': bool(font.bold), 'italic': bool(font.italic), 'color': color(font.colour_index), 'underline': bool(font.underlined), 'strike': bool(font.struck_out)}, 'fill': color(xf.background.pattern_colour_index) if xf.background.fill_pattern == 1 else None, 'alignment': {'horizontal': xf.alignment.hor_align, 'vertical': xf.alignment.vert_align, 'wrap': bool(xf.alignment.text_wrapped), 'rotation': xf.alignment.rotation, 'indent': xf.alignment.indent_level}, 'numberFormat': book.format_map[xf.format_key].format_str, 'borders': {side: {'style': getattr(xf.border, side + '_line_style'), 'color': color(getattr(xf.border, side + '_colour_index'))} for side in ['left', 'right', 'top', 'bottom']}})
    cells = [[{'value': sheet.cell_value(r, c) if sheet.cell_type(r, c) not in [xlrd.XL_CELL_EMPTY, xlrd.XL_CELL_BLANK] else None, 'style': sheet.cell_xf_index(r, c)} for c in range(sheet.ncols)] for r in range(last_row)]
    columns = [{'column': c, 'width': (sheet.colinfo_map[c].width / 256 if c in sheet.colinfo_map else (sheet.defcolwidth or 8)), 'hidden': bool(sheet.colinfo_map[c].hidden) if c in sheet.colinfo_map else False} for c in range(sheet.ncols)]
    rows = [{'row': r, 'height': (sheet.rowinfo_map[r].height if r in sheet.rowinfo_map and sheet.rowinfo_map[r].has_default_height == 0 else sheet.default_row_height) / 20, 'hidden': bool(sheet.rowinfo_map[r].hidden) if r in sheet.rowinfo_map else False} for r in range(last_row)]
    data = {'key': key, 'vendor': vendor, 'source': filename, 'sheetName': sheet.name, 'cells': cells, 'styles': styles, 'columns': columns, 'rows': rows, 'merges': sheet.merged_cells, 'showGridLines': bool(sheet.show_grid_lines)}
    with open(os.path.join(output, key + '.json'), 'w', encoding='utf-8') as stream:
        json.dump(data, stream, ensure_ascii=False)
    print(json.dumps({'key': key, 'rows': last_row, 'columns': sheet.ncols, 'styles': len(styles), 'horizontalAlignments': sorted(set(s['alignment']['horizontal'] for s in styles)), 'verticalAlignments': sorted(set(s['alignment']['vertical'] for s in styles)), 'borderStyles': sorted(set(v['style'] for s in styles for v in s['borders'].values()))}))
