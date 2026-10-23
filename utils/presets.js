/**
 * 预设习惯库
 *
 * 纯数据 + 纯函数，不引用 wx，可以直接在 node 里单测。
 *
 * 为什么要有这个：新建习惯完全靠手打名字的话，用户面对空白输入框
 * 根本想不出该定什么 —— 这是习惯类应用最主要的流失点。
 * 给一份现成的清单，点一下就加上，决策成本几乎为零。
 *
 * ⚠️ **名字必须 ≤ 12 个字**。pages/habits 的 add() 有 12 字上限，
 * 超了会被拦下来、点了没反应。自检里有断言钉住这一条。
 *
 * 颜色取自 store.js 的 COLORS，保持和用户自建习惯同一个色系。
 */

const CATEGORIES = [
  {
    key: 'study',
    name: '学习',
    items: [
      { name: '背 20 个单词', icon: '📖', color: '#4a7ab5' },
      { name: '读书 30 分钟', icon: '📚', color: '#8a6bb5' },
      { name: '复习笔记', icon: '✍', color: '#4a7ab5' },
      { name: '练听力 20 分钟', icon: '🎧', color: '#4a9e6f' },
      { name: '刷题 1 小时', icon: '📝', color: '#c79a3a' },
      { name: '看网课', icon: '💻', color: '#4a7ab5' }
    ]
  },
  {
    key: 'work',
    name: '工作',
    items: [
      { name: '清空今日待办', icon: '✅', color: '#4a9e6f' },
      { name: '写工作日报', icon: '📋', color: '#c79a3a' },
      { name: '深度工作 2 小时', icon: '⏱', color: '#e8674a' },
      { name: '整理收件箱', icon: '📥', color: '#4a7ab5' },
      { name: '复盘今天的工作', icon: '🔍', color: '#8a6bb5' }
    ]
  },
  {
    key: 'fitness',
    name: '健身',
    items: [
      { name: '跑步 3 公里', icon: '🏃', color: '#e8674a' },
      { name: '力量训练', icon: '💪', color: '#c25a7a' },
      { name: '拉伸 10 分钟', icon: '🧘', color: '#4a9e6f' },
      { name: '走满 8000 步', icon: '👟', color: '#c79a3a' },
      { name: '控制饮食', icon: '🥗', color: '#4a9e6f' }
    ]
  },
  {
    key: 'life',
    name: '生活',
    items: [
      { name: '早起', icon: '☀', color: '#c79a3a' },
      { name: '早睡', icon: '🌙', color: '#8a6bb5' },
      { name: '喝够 8 杯水', icon: '💧', color: '#4a7ab5' },
      { name: '吃早餐', icon: '🍳', color: '#c79a3a' },
      { name: '记账', icon: '💰', color: '#4a9e6f' },
      { name: '冥想 10 分钟', icon: '🧘', color: '#8a6bb5' }
    ]
  }
]

/** 首装时自动加上的习惯。四个类别各挑一两条，覆盖到，但别塞太多 */
const SEED_NAMES = ['早起', '喝够 8 杯水', '读书 30 分钟', '背 20 个单词', '跑步 3 公里', '写工作日报']

/**
 * 首装时一并铺上的**示例打卡记录**，和 SEED_NAMES 一一对应。
 * 数组里是相对今天的天数偏移（0 = 今天）。
 *
 * 为什么要有：只给空习惯的话，首屏是三条零、热力图全空、成就墙全锁着 ——
 * 用户看不出这个 app 在干什么。铺一段历史，第一次打开就有东西可看。
 *
 * ⚠️ **这是示例数据，不是用户真做过的**，界面上必须说明（见 stats 页）。
 *
 * 这组偏移量是**手挑的而不是随机生成**的，因为它要刚好演示出四种情况：
 *   1. 有习惯正在连着（早起 16 天），今日页的「连续 N 天」不为零
 *   2. 有习惯**已经断了两天、但历史最长有 19 天**（读书）——
 *      这正是 `streak` 和 `longestStreak` 的区别，界面上唯一直观看得出来的地方
 *   3. 今天已完成 5/6，首屏不是空进度条
 *   4. 累计 90 次、最长 19 天：解锁 8 个成就，而「21 天养成」差 2 天就到 ——
 *      今日页那条进度条才有东西可推
 * 改动这些数字会让自检里的演示状态断言失败，改之前先看那条断言。
 */
const SEED_RECORDS = [
  // 早起：连着 16 天（含今天）→ 当前连续 16，历史最长 16
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],

  // 喝够 8 杯水：今天打了，但前面断断续续
  [0, 1, 3, 4, 5, 7, 8, 9, 10, 12, 14, 15, 17, 18, 19, 21, 22],

  // 读书 30 分钟：**断了两天**，之前有过一段 19 天的长连续
  //   → 当前连续 0，历史最长 19
  [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],

  // 背 20 个单词：今天打了，连续 5 天
  [0, 1, 2, 3, 4, 9, 10, 11, 20, 21],

  // 跑步 3 公里：隔天跑
  [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20],

  // 写工作日报：工作日为主
  [0, 1, 4, 5, 6, 7, 8, 11, 12, 13, 14, 15, 18, 19, 20, 21, 22]
]

/** 全部预设拍平成一维，按名字查的时候用 */
function allItems() {
  const out = []
  CATEGORIES.forEach(function (c) {
    c.items.forEach(function (it) {
      out.push({
        name: it.name,
        icon: it.icon,
        color: it.color,
        category: c.key,
        categoryName: c.name
      })
    })
  })
  return out
}

function byName(name) {
  const all = allItems()
  for (let i = 0; i < all.length; i++) {
    if (all[i].name === name) return all[i]
  }
  return null
}

function seedHabits() {
  return SEED_NAMES.map(byName).filter(Boolean)
}

/**
 * 给推荐清单标上「已经加过了」。
 *
 * **按名字判断，不是按 id** —— 用户完全可能自己手打过一个「早起」，
 * 那也该算已经有了，不能让他看到两条一样的。
 */
function markAdded(categories, existingNames) {
  const has = {}
  ;(existingNames || []).forEach(function (n) { has[n] = true })

  return (categories || []).map(function (c) {
    return {
      key: c.key,
      name: c.name,
      items: c.items.map(function (it) {
        return {
          name: it.name,
          icon: it.icon,
          color: it.color,
          added: !!has[it.name]
        }
      })
    }
  })
}

module.exports = {
  CATEGORIES: CATEGORIES,
  SEED_NAMES: SEED_NAMES,
  SEED_RECORDS: SEED_RECORDS,
  allItems: allItems,
  byName: byName,
  seedHabits: seedHabits,
  markAdded: markAdded
}
