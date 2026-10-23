/**
 * 打卡的纯逻辑：日期处理、连续天数、完成率、日历网格
 *
 * 不引用 wx，可以直接在 node 里单测。
 *
 * 日期处理是这个作品最容易出错的地方 —— 跨月、跨年、闰年、
 * 以及「今天还没打卡时连续天数该从哪天数起」。这些都不难，
 * 但错了很难发现：界面上永远显示一个看着挺合理的数字。
 */

function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

/** Date → 'YYYY-MM-DD'。用本地日期，不用 toISOString —— 那个是 UTC，会差一天 */
function dateKey(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

/**
 * 日期加减。
 *
 * 关键：用 new Date(y, m, d) 重新构造，把时分秒归零。
 * 直接 setDate 会因为保留了当前时刻而受夏令时影响 ——
 * 在切换夏令时的地区，某些天会变成 23 或 25 小时，加减就偏了。
 * 归零之后每天都是完整的一天，跨月跨年由 Date 自己处理。
 */
function shiftDays(d, n) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() + n)
  return x
}

/**
 * 连续打卡天数。
 *
 * 从今天往前数。**今天还没打卡的话从昨天数起** ——
 * 否则用户早上一打开就看到「连续 0 天」，明明昨天刚打过，观感很差，
 * 还容易让人以为记录丢了。
 */
function streak(record, current) {
  const today = current || new Date()
  let d = today

  if (!record[dateKey(today)]) d = shiftDays(today, -1)

  let n = 0
  // 上限 3650 天，纯粹是防死循环的保险 —— 记录正常不会连打十年
  while (n < 3650 && record[dateKey(d)]) {
    n++
    d = shiftDays(d, -1)
  }
  return n
}

/** 'YYYY-MM-DD' → Date。格式不对返回 null（记录里可能混进脏键） */
function parseKey(k) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(k || ''))
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/**
 * **历史最长**连续天数。
 *
 * 和 `streak()` 是两回事，别混用：
 *   streak()        算的是**当前**这段连续 —— 断了就归零，用来显示「你正在连着几天」
 *   longestStreak() 算的是**历史最长**那段 —— 断过也不抹掉，用来判定成就
 *
 * 用错了的后果很典型：用户连续打了 30 天、断了一天、又连着打 3 天，
 * 成就里那条「连续 30 天」会突然退回未解锁 —— 明明做到过却显示没做到。
 *
 * 要处理两种脏数据：非日期键，以及值为 false 的键。
 * （不用去重 —— 记录的键是对象属性，按定义就不可能有重复的日期。）
 */
function longestStreak(record) {
  if (!record) return 0

  const stamps = []
  Object.keys(record).forEach(function (k) {
    if (!record[k]) return          // 值为 false 的不算
    const d = parseKey(k)
    if (d) stamps.push(d.getTime()) // 非日期键丢掉
  })

  if (!stamps.length) return 0

  stamps.sort(function (a, b) { return a - b })

  let best = 1
  let cur = 1
  for (let i = 1; i < stamps.length; i++) {
    // 除以 86400000 可能是 xxx.99 —— 夏令时那天是 23/25 小时，所以取整
    const gap = Math.round((stamps[i] - stamps[i - 1]) / 86400000)
    cur = gap === 1 ? cur + 1 : 1
    if (cur > best) best = cur
  }
  return best
}

/**
 * 把所有习惯汇总成几个总量指标，给今日页和成就判定用。
 *
 * @param habits           [{ id, ... }]
 * @param recordsByHabit   { habitId: record }
 */
function aggregate(habits, recordsByHabit, current) {
  const list = habits || []
  const recs = recordsByHabit || {}
  const today = current || new Date()
  const todayK = dateKey(today)

  let totalCheckins = 0
  let bestStreak = 0
  let todayDone = 0
  const activeSet = {}

  for (let i = 0; i < list.length; i++) {
    const rec = recs[list[i].id] || {}
    if (rec[todayK]) todayDone++

    const longest = longestStreak(rec)
    if (longest > bestStreak) bestStreak = longest

    Object.keys(rec).forEach(function (k) {
      if (!rec[k]) return
      if (!parseKey(k)) return
      totalCheckins++
      // 用集合去重：多个习惯同一天都打卡，活跃天数只算一天
      activeSet[k] = true
    })
  }

  const count = list.length
  return {
    habitCount: count,
    totalCheckins: totalCheckins,
    activeDays: Object.keys(activeSet).length,
    bestStreak: bestStreak,
    todayDone: todayDone,
    todayPct: count ? Math.round((todayDone * 100) / count) : 0
  }
}

/** 最近 count 天的记录，按时间从老到新 */
function recentDays(record, count, current) {
  const today = current || new Date()
  const out = []
  for (let i = count - 1; i >= 0; i--) {
    const d = shiftDays(today, -i)
    const k = dateKey(d)
    out.push({
      key: k,
      done: !!record[k],
      day: d.getDate(),
      month: d.getMonth() + 1,
      isToday: i === 0
    })
  }
  return out
}

/** 完成率 */
function completionRate(record, count, current) {
  const days = recentDays(record, count, current)
  let done = 0
  for (let i = 0; i < days.length; i++) if (days[i].done) done++
  return {
    done: done,
    total: count,
    pct: count ? Math.round((done * 100) / count) : 0
  }
}

/**
 * 日历热力图：按周分组，每列一周（周一到周日）。
 *
 * 对齐到「周一」而不是「今天往前推 N 天」，
 * 这样网格读起来是真正的日历，而不是一段随便截的时间。
 */
function calendarWeeks(record, weekCount, current) {
  const today = current || new Date()
  const todayK = dateKey(today)

  // getDay(): 0=周日。转成 周一=0
  const wd = today.getDay() === 0 ? 6 : today.getDay() - 1
  const thisMonday = shiftDays(today, -wd)
  const start = shiftDays(thisMonday, -(weekCount - 1) * 7)

  const weeks = []
  for (let w = 0; w < weekCount; w++) {
    const cells = []
    for (let d = 0; d < 7; d++) {
      const date = shiftDays(start, w * 7 + d)
      const k = dateKey(date)
      cells.push({
        key: k,
        day: date.getDate(),
        done: !!record[k],
        // 用字符串比大小即可 —— ISO 日期格式的字典序就是时间序
        future: k > todayK,
        isToday: k === todayK
      })
    }
    weeks.push(cells)
  }
  return weeks
}

/** 统计一个习惯的全部数据 */
function summarize(record, current) {
  return {
    streak: streak(record, current),
    week: completionRate(record, 7, current),
    month: completionRate(record, 30, current),
    total: Object.keys(record).filter(function (k) { return record[k] }).length
  }
}

module.exports = {
  pad: pad,
  dateKey: dateKey,
  parseKey: parseKey,
  shiftDays: shiftDays,
  streak: streak,
  longestStreak: longestStreak,
  aggregate: aggregate,
  recentDays: recentDays,
  completionRate: completionRate,
  calendarWeeks: calendarWeeks,
  summarize: summarize
}
