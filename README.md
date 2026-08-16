# 校園社團爭預算（pg-clubbudg）

八週校園社團經營遊戲。分配幹部工時、以企劃與聲望密封申請場地、經營社員興趣，最後和三個 AI 社團競逐年度預算。

## 執行

純 HTML／CSS／JavaScript，無 build：

```sh
python3 -m http.server 4173
```

開啟 <http://localhost:4173>。

## 測試

```sh
npx vitest run
```

## 規則摘要

- 每週剛好 3 點幹部工時，可分配到招募、練習、活動籌備、企劃撰寫、器材保養。
- 場地以聲望＋企劃品質同時密封評選，不以金錢出價；落選可接受備選場地。
- 活動成敗由準備、練習、場地契合、校園事件、安全與固定種子共同決定。
- 期末依參與 30%、成果 30%、財務 20%、安全 20% 評鑑；任一項低於 3 分會將總評封頂於 49。
- 最佳分數與徽章透過 `clubbudg:best`、`clubbudg:unlocks` 保存；沒有 Playgrounds KV 時仍可玩。

## 授權

程式碼 MIT。第三方美術、音效、音樂與字型見 [ATTRIBUTION.md](./ATTRIBUTION.md)。
