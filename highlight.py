import datetime
import json
import uvicorn
import jieba

import pandas as pd

from fastapi import FastAPI
import requests

Authorization = ""

app = FastAPI()


@app.get("/parse/{clip_id}")
def parse_comments(clip_id: str):
    comments_data = requests.get(
        "http://localhost:3000/clip/{}/comments".format(clip_id)
    ).json()
    comments = comments_data.get("data")
    parsed = parse(comments)
    requests.post(
        "http://localhost:3000/spider/upload_highlights",
        headers={"Authorization": Authorization},
        json=dict(clip_id=clip_id, highlights=parsed),
    )
    return {"status": 0}


def symbol_in_message(symbols, msg):
    for symbol in symbols:
        if symbol in msg.lower():
            return True
    return False


def parse(data):
    symbols_mark = [{"key": "草", "symbols": ["草"]}, {"key": "?", "symbols": ["?", "？"]}]
    # 剔除礼物信息
    message_list = []
    f_l = []
    for message in data:
        if "text" in message:
            message_list.append(message)
            f_l.append(message.get("text"))
    if len(message_list) == 0:
        return []

    d = {}
    for c in f_l:
        k = jieba.cut(c)
        for b in list(k):
            try:
                d[b] += 1
            except KeyError:
                d[b] = 1
    blacklist_keys = ["/", "\\", ",", "，", ":", "：", "~", ".", "。", " ", "?", "？", "草"]
    for key in blacklist_keys:
        d.pop(key, None)
    for k in list(d.keys()):
        if len(k) <= 1:
            d.pop(k, None)
    final = dict(sorted(d.items(), key=lambda item: item[1], reverse=True))
    rl = list(final.keys())[0:20]

    for n in rl:
        symbols_mark.append({"key": n, "symbols": [n.lower(), n.upper()]})

    df = pd.DataFrame(message_list)
    df["time"] = df["time"].apply(
        lambda x: pd.Timestamp(x, unit="ms", tz="Asia/Shanghai")
    )
    concat_list = []
    for symbol_mark in symbols_mark:
        df[symbol_mark.get("key")] = df["text"].apply(
            lambda msg: symbol_in_message(symbol_mark.get("symbols"), msg)
        )
        has_symbol_df = df[df[symbol_mark.get("key")]]
        symbol_final = has_symbol_df.groupby(pd.Grouper(key="time", freq="60s")).count()
        if len(symbol_final) > 0:
            concat_list.append(symbol_final[symbol_mark.get("key")])
    try:
        final = pd.concat(concat_list, axis=1)
        rr = final.to_json(orient="table")
        rr = json.loads(rr)
    except ValueError:
        rr = {"data": []}
    final_list = []
    for row in rr["data"]:
        r = {}
        for k, v in row.items():
            if k == "time":
                v = (
                    int(
                        (
                            datetime.datetime.strptime(v, "%Y-%m-%dT%H:%M:%S.%fZ")
                            + datetime.timedelta(hours=8)
                        ).timestamp()
                    )
                    * 1000
                )
            if v is None:
                v = 0
            else:
                v = int(v)
            r[k] = v
        final_list.append(r)
    return final_list


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=33222)
