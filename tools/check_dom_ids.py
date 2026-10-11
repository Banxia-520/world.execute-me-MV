"""web/tools/check_dom_ids.py — 校验 app.js 引用的 DOM id 是否都在 index.html 中"""
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(HERE)

html = open(os.path.join(WEB, "index.html"), encoding="utf-8").read()
app = open(os.path.join(WEB, "js", "app.js"), encoding="utf-8").read()

ids = re.findall(r'id="([^"]+)"', html)
idset = set(ids)
used = set(re.findall(r"\$\('([^']+)'\)", app))
missing = sorted(used - idset)
unused = sorted(idset - used)

print(f"  index.html 元素 id（{len(ids)}）：{', '.join(ids)}")
print(f"  app.js 引用 id（{len(used)}）：{', '.join(sorted(used))}")
if missing:
    print(f"  ★ 引用了但 html 中没有：{missing}")
else:
    print("  OK  app.js 引用的 id 全部存在")
if unused:
    print(f"  （html 中未被 app.js 引用：{unused}）")
sys.exit(1 if missing else 0)
