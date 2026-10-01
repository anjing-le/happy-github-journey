// All entries below are fictional UI samples. Their IDs are local demo references,
// not links to real repositories, articles, implementations, or test evidence.
export const content = {
  demoLabel: "结构演示",
  demoNotice: "虚构示例，仅用于讨论页面结构；没有真实项目结论或验证结果。",
  sourceTypes: {
    all: "全部",
    project: "开源项目",
    article: "文章",
  },
  levels: {
    sources: {
      label: "学习条目",
      heading: "学习条目",
      description: "看清材料的场景与用途，再沿引用拆解设计。",
    },
    designs: {
      label: "关键设计",
      heading: "关键设计",
      description: "观察一个选择要解决什么，以及它牺牲了什么。",
    },
    technologies: {
      label: "技术与原理",
      heading: "技术与原理",
      description: "记录支撑设计的机制、适用条件和待验证点。",
    },
  },
  items: {
    sources: [
      {
        id: "demo-project-a",
        kind: "project",
        title: "虚构项目 A：纸舟记录台",
        summary: "演示如何从一个假想的开源项目入口，记录问题、设计与技术线索。",
        tags: ["虚构项目", "待验证"],
        blocks: [
          { title: "演示场景", text: "假设一个人常收藏项目，却很难在需要时想起其中的设计选择。这个条目只示范该怎样记录观察。" },
          { title: "证据边界", text: "这里没有对应的真实仓库、源码位置或运行记录。任何具体实现判断都需要以后查证。" },
        ],
        references: [
          { level: "designs", id: "demo-design-trace" },
          { level: "technologies", id: "demo-tech-ids" },
        ],
      },
      {
        id: "demo-article-b",
        kind: "article",
        title: "虚构文章 B：从摘录到判断",
        summary: "演示一篇假想文章怎样提供问题视角，同时保留未核实的边界。",
        tags: ["虚构文章", "待验证"],
        blocks: [
          { title: "演示场景", text: "假设文章提出：摘录、自己的推断和待验证问题应分开记录。此处只用来展示文章入口。" },
          { title: "证据边界", text: "没有真实文章链接、作者或引文；页面不会把这段示意文字当成已发表观点。" },
        ],
        references: [
          { level: "designs", id: "demo-design-boundary" },
          { level: "technologies", id: "demo-tech-markdown" },
        ],
      },
    ],
    designs: [
      {
        id: "demo-design-trace",
        title: "先保留来路，再写下理解",
        summary: "用来源 ID 连接观察和后续判断，演示可回看的关系。",
        tags: ["来源关联", "待验证"],
        blocks: [
          { title: "想解决的问题", text: "只留一句结论时，日后很难知道它来自哪里，也无法重新检查。" },
          { title: "演示取舍", text: "每条判断多留一个来源 ID，会增加记录动作，但让回溯路径更明确。是否值得采用尚待实践检验。" },
        ],
        references: [
          { level: "sources", id: "demo-project-a" },
          { level: "technologies", id: "demo-tech-ids" },
        ],
      },
      {
        id: "demo-design-boundary",
        title: "把观察、推断和疑问分开",
        summary: "让未证实的理解保持可见，不被误读成事实。",
        tags: ["证据边界", "待验证"],
        blocks: [
          { title: "想解决的问题", text: "读完一份材料后，转述与个人解释容易混在一起。" },
          { title: "演示取舍", text: "分栏记录会稍慢，却能在回看时看出哪些需要继续核对。具体格式仍是讨论中的示意。" },
        ],
        references: [
          { level: "sources", id: "demo-article-b" },
          { level: "technologies", id: "demo-tech-markdown" },
        ],
      },
      {
        id: "demo-design-dual-view",
        title: "同一实践，按阅读任务展开",
        summary: "先给人一个短版，再给 AI 一个可复制的结构化详版。",
        tags: ["双视图", "待验证"],
        blocks: [
          { title: "想解决的问题", text: "人快速判断是否适用，与 AI 获取完整约束，所需信息密度不同。" },
          { title: "演示取舍", text: "两个视图共享一条实践数据，减少结论漂移；同时需要检查详版是否仍易读。" },
        ],
        references: [
          { level: "sources", id: "demo-project-a" },
          { level: "technologies", id: "demo-tech-views" },
        ],
      },
    ],
    technologies: [
      {
        id: "demo-tech-ids",
        title: "稳定 ID 与内部引用",
        summary: "用演示 ID 指向条目，使来源、设计和技术之间可跳转。",
        tags: ["引用机制", "待验证"],
        blocks: [
          { title: "机制示意", text: "每个条目有本地唯一 ID，引用记录层级和目标 ID；点击时定位到对应卡片。" },
          { title: "适用边界", text: "这里只证明页面交互可表达关系，不证明任何未来内容的准确性或长期稳定性。" },
        ],
        references: [
          { level: "sources", id: "demo-project-a" },
          { level: "designs", id: "demo-design-trace" },
        ],
      },
      {
        id: "demo-tech-markdown",
        title: "结构化文本记录",
        summary: "用可读的小标题与清单，保留问题、依据和待核对项。",
        tags: ["文本结构", "待验证"],
        blocks: [
          { title: "机制示意", text: "一条记录可以拆成场景、取舍、步骤、验证和来源；格式只是演示，并未确定为正式内容规范。" },
          { title: "适用边界", text: "结构化格式不能自动保证引用真实，也不能代替对原始材料的核对。" },
        ],
        references: [
          { level: "sources", id: "demo-article-b" },
          { level: "designs", id: "demo-design-boundary" },
        ],
      },
      {
        id: "demo-tech-views",
        title: "同一数据的两种呈现",
        summary: "从同一条实践对象生成简版和详版，展示阅读深度切换。",
        tags: ["呈现机制", "待验证"],
        blocks: [
          { title: "机制示意", text: "简版只展示场景、做法与边界；详版展开约束、步骤和验证清单。" },
          { title: "适用边界", text: "这是交互原型，不意味着最终会采用此字段或保证内容可直接用于实际项目。" },
        ],
        references: [
          { level: "designs", id: "demo-design-dual-view" },
          { level: "sources", id: "demo-project-a" },
        ],
      },
    ],
  },
  practices: [
    {
      id: "demo-practice-record",
      title: "把收藏变成可复用的学习记录",
      status: "结构演示 · 待验证",
      intro: "一篇虚构实践示例，展示简版阅读与 AI 详版如何来自同一条记录。",
      scenario: "假设收藏了项目或文章，过一阵却说不清它解决了什么问题。",
      goal: "回看时能快速找到来源、自己的判断和下一步需要核对的事。",
      approach: "先记材料 ID 与观察，再写取舍和疑问；形成做法前返回来源重新核对。",
      boundary: "以下步骤没有在真实项目中执行，效果与适用范围均待验证。",
      constraints: [
        "只使用可追溯的材料 ID，不把演示文本写成真实来源。",
        "观察、推断和未验证问题分开记录。",
      ],
      tradeoffs: [
        "增加一次记录动作，换取之后能回到材料检查。",
        "短版易浏览，详版保留更多约束；两者由同一记录生成。",
      ],
      steps: [
        "给材料一个本地 ID，记录它的类型和待核对状态。",
        "写下场景、观察与个人推断，并连接相关设计。",
        "提出验证问题；核对后再修订做法。",
      ],
      verification: [
        "能否从实践跳回材料、设计和技术条目？此原型只验证跳转交互。",
        "来源真实性、做法效果与长期使用成本：待真实材料和实践验证。",
      ],
      references: [
        { level: "sources", id: "demo-project-a" },
        { level: "designs", id: "demo-design-boundary" },
        { level: "technologies", id: "demo-tech-views" },
      ],
    },
  ],
}
