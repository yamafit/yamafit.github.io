#!/usr/bin/env python3
"""ChatGPTのスケジュール実行用に、日付ごとのフォルダ chatgpt-tasks/<日付>/ を作る。

使い方:
  python3 tools/make-chatgpt-task.py <日付 YYYY-MM-DD> <朝のフォルダ> <昼のフォルダ>
  （朝／昼のフォルダには、daily-ref／noon-ref から取り出した sheet.png と prompt.txt が入っている）

できるもの:
  chatgpt-tasks/<日付>/morning.txt            朝の指示書（末尾に参照画像のURLと共通の決まりを付ける）
  chatgpt-tasks/<日付>/noon.txt               昼の指示書
  chatgpt-tasks/<日付>/morning_reference.png  朝の参照シート
  chatgpt-tasks/<日付>/noon_reference.png     昼の参照シート

朝の prompt.txt を人物禁止の1行つきに直したものを使うときは、先にそのファイルを朝のフォルダへ上書きしておく。
"""
import os
import shutil
import sys

RAW = "https://raw.githubusercontent.com/yamafit/yamafit.github.io/main/chatgpt-tasks"

COMMON = """
【共通の決まり（必ず守る）】
* この指示書と参照画像にない情報・数値・機能は、補わない・作らない。
* 商品の形状・色・細部は、参照画像に忠実に再現する。
* 人物・モデル・顔・手・指は描かない（商品だけを描く）。
* 参照画像の枠・ラベル・文字は、完成画像に描かない。
"""


def build(date, slot, src_dir, out_dir):
    prompt = open(os.path.join(src_dir, "prompt.txt"), encoding="utf-8").read().rstrip("\n")
    ref = f"{RAW}/{date}/{slot}_reference.png"
    text = (
        f"【{date} {'朝' if slot == 'morning' else '昼'}用】\n"
        f"参照画像（これを商品の参照として使う）：{ref}\n\n"
        f"{prompt}\n{COMMON}"
    )
    open(os.path.join(out_dir, f"{slot}.txt"), "w", encoding="utf-8").write(text)
    shutil.copyfile(os.path.join(src_dir, "sheet.png"), os.path.join(out_dir, f"{slot}_reference.png"))


def main():
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(1)
    date, morning_dir, noon_dir = sys.argv[1:4]
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "chatgpt-tasks", date)
    os.makedirs(out_dir, exist_ok=True)
    build(date, "morning", morning_dir, out_dir)
    build(date, "noon", noon_dir, out_dir)
    for n in sorted(os.listdir(out_dir)):
        print(f"{RAW}/{date}/{n}")


if __name__ == "__main__":
    main()
