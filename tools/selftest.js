/**
 * 打卡逻辑自检
 *
 *   node tools/selftest.js
 *
 * 重点测日期。日期逻辑错了很难发现 ——
 * 界面上永远显示一个看着挺合理的数字，用户不会察觉，
 * 只有跨月、跨年、闰年那几天才会暴露。所以这里把边界都钉死。
 */

const path = require('path')
const h = require(path.join(__dirname, '..', 'utils', 'habit.js'))
const ach = require(path.join(__dirname, '..', 'utils', 'achievement.js'))
const presets = require(path.join(__dirname, '..', 'utils', 'presets.js'))

let failed = 0

function check(label, ok, detail) {
  if (ok) {
    console.log('  ok    ' + label + (detail ? '  ' + detail : ''))
  } else {
    failed++
    console.log('  FAIL  ' + label + (detail ? '  ' + detail : ''))
  }
}

/** 造一条记录：从 today 往前，把 offset 天都标成已打卡 */
function rec(today, offsets) {
  const r = {}
  offsets.forEach(function (o) {
    r[h.dateKey(h.shiftDays(today, -o))] = true
  })
  return r
}

// ── 日期基础 ────────────────────────────────────────

console.log('\n日期基础')

const d1 = new Date(2026, 0, 5) // 2026-01-05
check('dateKey 补零', h.dateKey(d1) === '2026-01-05', h.dateKey(d1))

// 跨月
check('1月31日 +1 → 2月1日',
  h.dateKey(h.shiftDays(new Date(2026, 0, 31), 1)) === '2026-02-01',
  h.dateKey(h.shiftDays(new Date(2026, 0, 31), 1)))

// 跨年
check('12月31日 +1 → 次年1月1日',
  h.dateKey(h.shiftDays(new Date(2026, 11, 31), 1)) === '2027-01-01',
  h.dateKey(h.shiftDays(new Date(2026, 11, 31), 1)))

check('1月1日 −1 → 上年12月31日',
  h.dateKey(h.shiftDays(new Date(2026, 0, 1), -1)) === '2025-12-31',
  h.dateKey(h.shiftDays(new Date(2026, 0, 1), -1)))

// 闰年：2026 不是闰年，2月28日 +1 应该是 3月1日
check('平年 2月28日 +1 → 3月1日',
  h.dateKey(h.shiftDays(new Date(2026, 1, 28), 1)) === '2026-03-01',
  h.dateKey(h.shiftDays(new Date(2026, 1, 28), 1)))

// 2024 是闰年，2月28日 +1 应该是 2月29日
check('闰年 2月28日 +1 → 2月29日',
  h.dateKey(h.shiftDays(new Date(2024, 1, 28), 1)) === '2024-02-29',
  h.dateKey(h.shiftDays(new Date(2024, 1, 28), 1)))

check('闰年 2月29日 +1 → 3月1日',
  h.dateKey(h.shiftDays(new Date(2024, 1, 29), 1)) === '2024-03-01')

// 时分秒必须归零，否则夏令时地区会算出 23/25 小时的一天
const dirty = new Date(2026, 5, 15, 23, 59, 59)
check('带时分秒的输入也要正确跨天',
  h.dateKey(h.shiftDays(dirty, 1)) === '2026-06-16',
  h.dateKey(h.shiftDays(dirty, 1)))

// ── 连续天数 ────────────────────────────────────────

console.log('\n连续天数')

const today = new Date(2026, 9, 2) // 2026-10-02

check('空记录 → 0', h.streak({}, today) === 0)

check('今天打了 → 1', h.streak(rec(today, [0]), today) === 1)

check('今天+前两天 → 3', h.streak(rec(today, [0, 1, 2]), today) === 3)

// 关键行为：今天还没打卡，要从昨天数起，不能显示 0
check('今天没打、昨天起连打 3 天 → 3（不是 0）',
  h.streak(rec(today, [1, 2, 3]), today) === 3,
  'streak=' + h.streak(rec(today, [1, 2, 3]), today))

// 中间断了就停
check('中间断了一天 → 只数到断点',
  h.streak(rec(today, [0, 1, 3, 4]), today) === 2,
  'streak=' + h.streak(rec(today, [0, 1, 3, 4]), today))

check('今天没打且昨天也没打 → 0',
  h.streak(rec(today, [2, 3]), today) === 0)

// 跨月：9月29、30 + 10月1、2 应该算连续 4 天
const crossMonth = {}
;['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'].forEach(function (k) {
  crossMonth[k] = true
})
check('跨月连续 → 4', h.streak(crossMonth, today) === 4,
  'streak=' + h.streak(crossMonth, today))

// 跨年
const crossYear = {}
;['2025-12-30', '2025-12-31', '2026-01-01'].forEach(function (k) { crossYear[k] = true })
check('跨年连续 → 3', h.streak(crossYear, new Date(2026, 0, 1)) === 3,
  'streak=' + h.streak(crossYear, new Date(2026, 0, 1)))

// ── 完成率 ──────────────────────────────────────────

console.log('\n完成率')

const r7 = h.completionRate(rec(today, [0, 2, 4, 6]), 7, today)
check('7 天内打了 4 天 → 57%', r7.done === 4 && r7.pct === 57,
  r7.done + '/' + r7.total + ' = ' + r7.pct + '%')

check('全勤 → 100%', h.completionRate(rec(today, [0, 1, 2]), 3, today).pct === 100)

check('全没打 → 0%', h.completionRate({}, 7, today).pct === 0)

// ── 日历网格 ────────────────────────────────────────

console.log('\n日历网格')

// 2026-10-02 是周五。取 3 周，最后一列的周五应该是今天
const weeks = h.calendarWeeks(rec(today, [0, 1]), 3, today)

check('返回 3 列（3 周）', weeks.length === 3)
check('每列 7 天', weeks.every(function (w) { return w.length === 7 }))

// 每列第一格必须是周一
let mondayOk = true
weeks.forEach(function (w) {
  const d = new Date(w[0].key.replace(/-/g, '/'))
  if (d.getDay() !== 1) mondayOk = false
})
check('每列从周一开始', mondayOk, '首列 ' + weeks[0][0].key + ' 末列 ' + weeks[2][6].key)

check('最后一列包含今天', weeks[2].some(function (c) { return c.isToday }))
check('今天这一天标记正确', weeks[2].some(function (c) { return c.isToday && c.done }))

// 未来的日期要标出来（渲染时画成空的）
const hasFuture = weeks.some(function (w) {
  return w.some(function (c) { return c.future })
})
check('未来日期有 future 标记', hasFuture)

// ── summarize ───────────────────────────────────────

console.log('\n汇总')

const sum = h.summarize(rec(today, [0, 1, 2, 5]), today)
check('连续天数正确', sum.streak === 3, sum.streak)
check('七天完成率正确', sum.week.done === 4, sum.week.done + '/7')
check('累计次数正确', sum.total === 4, sum.total)

// ── 边界 ────────────────────────────────────────────

console.log('\n边界')

// 空记录不能崩
try {
  const e = h.summarize({}, today)
  check('空记录不崩', e.streak === 0 && e.total === 0)
} catch (e) {
  check('空记录不崩', false, e.message)
}

// 只打了很久以前的一天，连续应该是 0
check('只打了 100 天前 → 连续 0', h.streak(rec(today, [100]), today) === 0)

// 记录里混入脏数据（值为 false / 杂键）不应影响统计
const dirtyRec = rec(today, [0, 1])
dirtyRec['not-a-date'] = true
dirtyRec['2026-10-03'] = false
check('脏数据不影响连续天数', h.streak(dirtyRec, today) === 2,
  'streak=' + h.streak(dirtyRec, today))

// ── 历史最长连续（和「当前连续」是两回事） ──────────

console.log('\n历史最长连续')

check('空记录 → 0', h.longestStreak({}) === 0 && h.longestStreak(null) === 0)
check('只有一天 → 1', h.longestStreak(rec(today, [5]), today) === 1)
check('连着 3 天 → 3', h.longestStreak(rec(today, [0, 1, 2]), today) === 3)

// ★ 这两个函数的区别，用错了成就判定会一直错而界面上看不出来：
// 当前连续取**最近那段**，历史最长取**最大的那段**。
// 用户断过一次之后，两者就不一样了。
const broken = rec(today, [0, 1, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19])
check('断过之后：当前连续只有最近那 2 天',
  h.streak(broken, today) === 2, '当前 ' + h.streak(broken, today))
check('断过之后：历史最长保留之前那 10 天',
  h.longestStreak(broken, today) === 10, '最长 ' + h.longestStreak(broken, today))
check('历史最长 >= 当前连续（恒成立）',
  h.longestStreak(broken, today) > h.streak(broken, today))

// 今天没打卡时，当前连续从昨天数起，但历史最长不受影响
check('今天没打，历史最长照样算',
  h.longestStreak(rec(today, [1, 2, 3, 4]), today) === 4)

// 跨月跨年
const lm = {}
;['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'].forEach(function (k) {
  lm[k] = true
})
check('跨月连续 → 5', h.longestStreak(lm, today) === 5, h.longestStreak(lm, today))

const ly = {}
;['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02'].forEach(function (k) { ly[k] = true })
check('跨年连续 → 4', h.longestStreak(ly, today) === 4, h.longestStreak(ly, today))

// 脏数据：非日期键和值为 false 都要忽略
const dirtyLong = rec(today, [0, 1, 2])
dirtyLong['not-a-date'] = true
dirtyLong['2026-13-99'] = true
dirtyLong['2026-10-09'] = false
check('脏数据混进来不影响结果', h.longestStreak(dirtyLong, today) === 3,
  '最长 ' + h.longestStreak(dirtyLong, today))

// ── 多习惯汇总 ──────────────────────────────────────

console.log('\n多习惯汇总')

const h2 = [{ id: 'A' }, { id: 'B' }, { id: 'C' }]
const recs = {
  A: rec(today, [0, 1, 2]),                    // 3 次，连续 3
  B: rec(today, [0, 5]),                       // 2 次
  C: {}                                        // 0 次
}
const agg = h.aggregate(h2, recs, today)

check('累计次数是所有习惯之和', agg.totalCheckins === 5, agg.totalCheckins + ' 次')
check('习惯数正确', agg.habitCount === 3)
// 同一天多个习惯都打卡，活跃天数只算一天 —— 这是最常见的算错点
check('活跃天数不重复计同一天', agg.activeDays === 4,
  'A 和 B 今天都打了，但今天只算一天 → ' + agg.activeDays + ' 天')
check('bestStreak 取各习惯最大值', agg.bestStreak === 3, agg.bestStreak)
check('今天已完成的习惯数', agg.todayDone === 2, agg.todayDone + ' 个')
check('今天完成率', agg.todayPct === 67, agg.todayPct + '%')

const aggEmpty = h.aggregate([], {}, today)
check('没有习惯时不崩、除零不产生 NaN',
  aggEmpty.habitCount === 0 && aggEmpty.todayPct === 0 && aggEmpty.totalCheckins === 0)

// 空记录的习惯不能把 bestStreak 拉低
check('空记录的习惯不影响 bestStreak',
  h.aggregate([{ id: 'X' }, { id: 'Y' }], { X: rec(today, [0, 1]) }, today).bestStreak === 2)

// ── 成就判定 ────────────────────────────────────────

console.log('\n成就判定')

const evals = ach.evaluate({ totalCheckins: 10, bestStreak: 6, activeDays: 3, habitCount: 2 })

function findEval(id) {
  return evals.filter(function (a) { return a.id === id })[0]
}

// 边界：正好等于目标就算达成。写成 > 的话「连续 7 天」要第 8 天才给
const t10 = findEval('t10')
check('正好等于目标 → 已解锁', t10.unlocked === true, '累计 10 / 目标 ' + t10.target)
check('正好达成时进度 100%', t10.pct === 100, t10.pct + '%')

const s7 = findEval('s7')
check('差一不算解锁', s7.unlocked === false, '连续 6 / 目标 ' + s7.target)
check('差一的进度是 86%', s7.pct === 86, s7.pct + '%')

check('进度不超过 100%（进度条不该画出去）',
  findEval('t10').progress === 10 && findEval('t10').pct <= 100)
check('超额完成时 pct 封顶 100', (function () {
  const e = ach.evaluate({ totalCheckins: 9999, bestStreak: 0, activeDays: 0, habitCount: 0 })
  return e.filter(function (a) { return a.id === 't10' })[0].pct === 100
})())

check('缺指标时按 0 处理，不崩', (function () {
  const e = ach.evaluate({})
  return e.length === ach.ACHIEVEMENTS.length && e.every(function (a) { return a.progress === 0 })
})())

// 这组数据下应该是 first(累计1) / t10(累计10) / s3(连续3) 三条
check('解锁数正确', ach.unlockedCount(evals) === 3, ach.unlockedCount(evals) + ' 个')

// nextUp 要挑「最接近拿到」的那个
const nxt = ach.nextUp(evals)
check('nextUp 挑的是完成度最高的未解锁项', nxt && nxt.pct === 86, nxt ? nxt.name + ' ' + nxt.pct + '%' : 'null')
check('nextUp 不会挑已解锁的', !!nxt && !nxt.unlocked)

check('全部解锁时 nextUp 返回 null', (function () {
  const allIn = ach.evaluate({ totalCheckins: 99999, bestStreak: 99999, activeDays: 99999, habitCount: 99999 })
  return ach.nextUp(allIn) === null
})())

check('空列表 nextUp 返回 null', ach.nextUp([]) === null && ach.nextUp(null) === null)

// 每个成就的定义都要完整，缺字段会在界面上显示成空白
check('每条成就字段完整', ach.ACHIEVEMENTS.every(function (a) {
  return a.id && a.name && a.desc && a.icon && a.metric && a.target > 0
}), ach.ACHIEVEMENTS.length + ' 条')

check('成就 id 不重复', (function () {
  const seen = {}
  for (let i = 0; i < ach.ACHIEVEMENTS.length; i++) {
    const id = ach.ACHIEVEMENTS[i].id
    if (seen[id]) return false
    seen[id] = true
  }
  return true
})())

check('每条成就用的都是已知指标', (function () {
  const known = { totalCheckins: 1, bestStreak: 1, activeDays: 1, habitCount: 1 }
  return ach.ACHIEVEMENTS.every(function (a) { return !!known[a.metric] })
})())

// ── 成就持久化（把解锁记录并回来） ──────────────────

console.log('\n成就持久化')

const locked = ach.evaluate({ totalCheckins: 3, bestStreak: 1, activeDays: 1, habitCount: 1 })
const l10 = locked.filter(function (a) { return a.id === 't10' })[0]
check('指标不够时是未解锁', l10.unlocked === false)

// ★ 持久化的意义：指标掉下来了，但已经记录为解锁的仍然保持解锁
const merged = ach.applyUnlocks(locked, { t10: '2026-09-01' })
const m10 = merged.filter(function (a) { return a.id === 't10' })[0]
check('已记录解锁的，指标回落也保持解锁', m10.unlocked === true)
check('带上达成日期', m10.unlockedAt === '2026-09-01', m10.unlockedAt)
check('并回来后进度按 100% 显示', m10.pct === 100)

const m3 = merged.filter(function (a) { return a.id === 's3' })[0]
check('没记录过的仍按指标算', m3.unlocked === false, 's3 未解锁')

check('空 unlocks 不改变任何东西',
  ach.applyUnlocks(locked, {}).every(function (a, i) { return a.unlocked === locked[i].unlocked }))

// ── 预设习惯库 ──────────────────────────────────────

console.log('\n预设习惯库')

const allPresets = presets.allItems()
check('预设非空', allPresets.length >= 18, allPresets.length + ' 条')

// ⚠️ 功能性约束：habits 页的 add() 有 12 字上限，超了会被拦下来、点了没反应
const tooLong = allPresets.filter(function (p) { return p.name.length > 12 })
check('预设名字都不超过 12 个字（否则加不上）', tooLong.length === 0,
  tooLong.map(function (p) { return p.name + '(' + p.name.length + ')' }).join(', ') || '最长 ' +
    Math.max.apply(null, allPresets.map(function (p) { return p.name.length })) + ' 字')

check('每条预设都有图标和颜色',
  allPresets.every(function (p) { return !!p.icon && /^#[0-9a-f]{6}$/i.test(p.color) }))

check('预设名字全局不重复', (function () {
  const seen = {}
  for (let i = 0; i < allPresets.length; i++) {
    if (seen[allPresets[i].name]) return false
    seen[allPresets[i].name] = true
  }
  return true
})())

check('每个类别都有内容', presets.CATEGORIES.every(function (c) {
  return c.key && c.name && c.items.length >= 4
}), presets.CATEGORIES.map(function (c) { return c.name + c.items.length }).join(' '))

// 用户明确要的三类必须在
const catKeys = presets.CATEGORIES.map(function (c) { return c.key })
check('学习 / 工作 / 健身三类都在',
  ['study', 'work', 'fitness'].every(function (k) { return catKeys.indexOf(k) >= 0 }),
  catKeys.join(','))

check('预设用的图标都在 store.ICONS 里（否则改图标时选不到）', (function () {
  const icons = require(path.join(__dirname, '..', 'utils', 'store.js')).ICONS
  const missing = allPresets.filter(function (p) { return icons.indexOf(p.icon) < 0 })
  return missing.length === 0
})())

// 首装种子
check('种子习惯都能在预设里找到', presets.seedHabits().length === presets.SEED_NAMES.length,
  presets.SEED_NAMES.length + ' 个')
check('种子覆盖多个类别', (function () {
  const cats = {}
  presets.seedHabits().forEach(function (p) { cats[p.category] = true })
  return Object.keys(cats).length >= 3
})(), '覆盖 ' + (function () {
  const cats = {}
  presets.seedHabits().forEach(function (p) { cats[p.category] = true })
  return Object.keys(cats).length
})() + ' 类')

// markAdded：按名字判断，用户手打过的同名习惯也要算「已有」
const marked = presets.markAdded(presets.CATEGORIES, ['早起', '跑步 3 公里'])
const lifeCat = marked.filter(function (c) { return c.key === 'life' })[0]
const fitCat = marked.filter(function (c) { return c.key === 'fitness' })[0]
check('已存在的同名习惯被标为已添加',
  lifeCat.items.filter(function (i) { return i.name === '早起' })[0].added === true)
check('未存在的标为未添加',
  lifeCat.items.filter(function (i) { return i.name === '记账' })[0].added === false)
check('跨类别也能正确标记',
  fitCat.items.filter(function (i) { return i.name === '跑步 3 公里' })[0].added === true)

check('空名单时全部标为未添加',
  presets.markAdded(presets.CATEGORIES, []).every(function (c) {
    return c.items.every(function (i) { return i.added === false })
  }))

check('markAdded 不改动原数据', presets.CATEGORIES[3].items[0].added === undefined)

// ── 预置打卡记录 ────────────────────────────────────

console.log('\n预置打卡记录')

check('记录条数和种子习惯数一一对应',
  presets.SEED_RECORDS.length === presets.SEED_NAMES.length,
  presets.SEED_RECORDS.length + ' / ' + presets.SEED_NAMES.length)

check('偏移量都是合法的非负整数',
  presets.SEED_RECORDS.every(function (list) {
    return list.every(function (o) { return Number.isInteger(o) && o >= 0 && o < 400 })
  }))

// 同一个偏移量写两遍不会出 bug，但说明数据是手滑写重了
check('同一条里没有重复的偏移量', presets.SEED_RECORDS.every(function (list) {
  const seen = {}
  for (let i = 0; i < list.length; i++) {
    if (seen[list[i]]) return false
    seen[list[i]] = true
  }
  return true
}))

check('每条习惯都铺了记录（否则首屏会有空白格）',
  presets.SEED_RECORDS.every(function (l) { return l.length >= 5 }),
  presets.SEED_RECORDS.map(function (l) { return l.length }).join(','))

// 造出播种后应该长成的样子，验证演示状态
const seedToday = new Date(2026, 9, 2)
const seedRecs = {}
presets.SEED_RECORDS.forEach(function (offsets, i) {
  const rec = {}
  offsets.forEach(function (o) {
    rec[h.dateKey(h.shiftDays(seedToday, -o))] = true
  })
  seedRecs['h' + i] = rec
})
const seedList = presets.SEED_NAMES.map(function (n, i) { return { id: 'h' + i, name: n } })
const seedAgg = h.aggregate(seedList, seedRecs, seedToday)
const seedEv = ach.evaluate(seedAgg)

// 首屏别是三条零
check('预置数据下今日有进度', seedAgg.todayDone >= 4 && seedAgg.todayPct >= 60,
  seedAgg.todayDone + '/' + seedAgg.habitCount + ' = ' + seedAgg.todayPct + '%')

// ★ 这组数据存在的意义之一：界面上能直观看到两个 streak 函数的区别。
// 读书那条断了两天，当前连续是 0，但历史最长有 19 天
const brokenOne = seedList.filter(function (x) {
  const rec = seedRecs[x.id]
  return h.longestStreak(rec) > h.streak(rec, seedToday)
})
check('存在「历史最长 > 当前连续」的习惯（否则看不出两个 streak 的区别）',
  brokenOne.length > 0,
  brokenOne.length ? brokenOne.map(function (x) { return x.name }).join('、') +
    '（最长 ' + h.longestStreak(seedRecs[brokenOne[0].id]) +
    ' / 当前 ' + h.streak(seedRecs[brokenOne[0].id], seedToday) + '）' : '找不到')

check('有习惯正在连着（当前连续 > 0）',
  seedList.some(function (x) { return h.streak(seedRecs[x.id], seedToday) > 0 }),
  '最长当前连续 ' + Math.max.apply(null, seedList.map(function (x) {
    return h.streak(seedRecs[x.id], seedToday)
  })) + ' 天')

const seedUnlocked = ach.unlockedCount(seedEv)
check('预置数据下已解锁若干成就（不是全锁着）', seedUnlocked >= 6,
  seedUnlocked + ' / ' + seedEv.length + ' 个')

check('也留了没解锁的（成就墙要有奔头）', seedUnlocked < seedEv.length,
  '还剩 ' + (seedEv.length - seedUnlocked) + ' 个没解锁')

// 今日页那条「下一个成就」的进度条要有东西可推，不能是 0%
check('下一个成就的进度已经过半', (function () {
  const n = ach.nextUp(seedEv)
  return n && n.pct >= 50
})(), (function () {
  const n = ach.nextUp(seedEv)
  return n ? n.name + ' ' + n.progress + ' / ' + n.target + '（' + n.pct + '%）' : 'null'
})())

// 这条钉住的是「演示状态」本身：改 SEED_RECORDS 的数字会让它失败，
// 那是提醒你不是改错了数字，而是把演示状态改掉了
check('下一个成就是「21 天养成」，差 2 天（改动示例数据会让这条失败）',
  (function () {
    const n = ach.nextUp(seedEv)
    return !!n && n.id === 's21'
  })(),
  (function () {
    const n = ach.nextUp(seedEv)
    return n ? n.id + ' ' + n.name : 'null'
  })())

check('累计次数落在合理区间（不至于把所有成就都解锁了）',
  seedAgg.totalCheckins >= 60 && seedAgg.totalCheckins < 100,
  seedAgg.totalCheckins + ' 次')

console.log('\n' + (failed === 0 ? '全部通过' : failed + ' 项失败') + '\n')
process.exitCode = failed === 0 ? 0 : 1
