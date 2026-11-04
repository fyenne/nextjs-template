/**
 * The story the tree tells. Pure data — no three.js imports — so it can be read
 * (or tested) without a WebGL context.
 *
 * `azimuth` / `tilt` place a hobby branch in 3D:
 *   azimuth = degrees around the trunk (0 = straight at the camera, + = right)
 *   tilt    = degrees away from vertical (90 = horizontal)
 */

export type Story = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  azimuth: number;
  tilt: number;
  length: number;
};

export type Chapter = {
  id: string;
  label: string;
  year: string;
  summary: string;
  color: string;
  /** height on the trunk, in scene units */
  height: number;
  stories: Story[];
};

export const CHAPTERS: Chapter[] = [
  {
    id: "birth",
    label: "出生",
    year: "起点",
    summary: "在一个小城开始。家里有个院子，夏天的晚上能听见虫叫。",
    color: "#bbf7d0",
    height: 1.7,
    stories: [],
  },
  {
    id: "childhood",
    label: "童年",
    year: "6–12 岁",
    summary: "夏天泡在游泳池，冬天抱着漫画不撒手。",
    color: "#86efac",
    height: 4.3,
    stories: [],
  },
  {
    id: "teen",
    label: "中学",
    year: "12–18 岁",
    summary: "球场上和机房里度过，第一次觉得写代码很酷。",
    color: "#4ade80",
    height: 6.9,
    stories: [
      {
        id: "basketball",
        title: "篮球",
        body: "打得不算好，但很喜欢放学后在球场待到天黑。现在跑不动全场了，投篮手感还在。",
        tags: ["篮球", "放学后", "胜负心"],
        azimuth: -74,
        tilt: 70,
        length: 5.2,
      },
      {
        id: "code-first",
        title: "游戏里的代码",
        body: "先是打游戏，后来想知道它是怎么跑起来的，就开始瞎写。第一行代码大概是给游戏改个数值。",
        tags: ["游戏", "折腾", "入门"],
        azimuth: 66,
        tilt: 68,
        length: 4.9,
      },
    ],
  },
  {
    id: "college",
    label: "大学",
    year: "2014–2018 · 上海",
    summary: "上海四年：摄影、英语文学，还有第一次一个人旅行。",
    color: "#34d399",
    height: 9.5,
    stories: [
      {
        id: "photo",
        title: "摄影",
        body: "从一台二手相机开始，拍天空、拍街道、拍路人。现在出门还是会带相机，哪怕最后一张都没拍。",
        tags: ["摄影", "街拍", "天空"],
        azimuth: -40,
        tilt: 60,
        length: 4.2,
      },
      {
        id: "literature",
        title: "英语文学",
        body: "辅修的第二专业。没学成什么本事，只留下一堆摘抄和看句子时的那点偏执。",
        tags: ["文学", "摘抄", "偏执"],
        azimuth: 44,
        tilt: 54,
        length: 3.6,
      },
      {
        id: "solo-trip",
        title: "一个人的旅行",
        body: "第一次自己订票出门，才发现一个人旅行最舒服：想停就停，想走就走。",
        tags: ["旅行", "一个人", "自由"],
        azimuth: 152,
        tilt: 64,
        length: 4.6,
      },
    ],
  },
  {
    id: "grad",
    label: "读研",
    year: "2019–2021 · Madison",
    summary: "两年：咖啡、跑步、和 Kaggle 上的深夜。",
    color: "#a3e635",
    height: 12.1,
    stories: [
      {
        id: "coffee",
        title: "手冲咖啡",
        body: "冬天太长，得给自己找点仪式感。从速溶到磨豆子，现在早上不喝一杯会有点飘。",
        tags: ["手冲", "仪式感", "早起"],
        azimuth: -16,
        tilt: 40,
        length: 2.8,
      },
      {
        id: "running",
        title: "跑步",
        body: "绕着湖跑，一跑就是两年。五公里最舒服，配速不重要，耳机里的歌单很重要。",
        tags: ["夜跑", "歌单", "断网时间"],
        azimuth: 18,
        tilt: 40,
        length: 2.6,
      },
      {
        id: "kaggle",
        title: "Kaggle 比赛",
        body: "第一次把模型刷上榜单，凌晨三点还很兴奋。后来成了职业，但那种兴奋还记得。",
        tags: ["数据", "竞赛", "熬夜"],
        azimuth: -158,
        tilt: 48,
        length: 3.0,
      },
    ],
  },
  {
    id: "work",
    label: "工作",
    year: "2022– 现在",
    summary: "做船期和运费的数据，也终于开始认真学做饭。",
    color: "#22c55e",
    height: 14.7,
    stories: [
      {
        id: "kitchen",
        title: "厨房实验",
        body: "照着食谱常常失败，凭手感反而成功。做菜不看秤，靠尝。周末会认真做一顿。",
        tags: ["做饭", "随性", "不忌口"],
        azimuth: -54,
        tilt: 34,
        length: 1.9,
      },
      {
        id: "iceland",
        title: "冰岛计划",
        body: "存了很久的愿望：冬天去看极光，开一段没有路灯的公路。计划还在，人还没出发。",
        tags: ["旅行", "极光", "待出发"],
        azimuth: 50,
        tilt: 32,
        length: 1.8,
      },
      {
        id: "roadtrip",
        title: "长途公路",
        body: "喜欢开车走长路，副驾有人聊天最好。地图上那些没去过的线，一直记着。",
        tags: ["自驾", "地图", "有人一起"],
        azimuth: 168,
        tilt: 40,
        length: 2.2,
      },
    ],
  },
];

export const ALL_STORIES = CHAPTERS.flatMap((chapter) =>
  chapter.stories.map((story) => ({ ...story, chapterId: chapter.id }))
);
